import { KESULITAN, PORSI_BARU_CAMPURAN, URUTAN_KODE } from './config';
import { dalamCakupan, naik, tingkatSoal } from './data';
import { kapasitasModel, kondisiTersedia, modelUntuk } from './models';
import type { KonteksModel } from './models/types';
import type { BankSoal, BarisKuota, DataUkp, Kesulitan, Kode, Pengaturan, Tingkat } from './types';

export interface BlokKasus { id: string; kode: Kode; anggota: BankSoal[] }
export interface Pool {
  tunggal: BankSoal[];
  blok: BlokKasus[];
}

/** Soal yang menguji ketentuan berubah: punya pengecoh "salah_periode" atau catatan aturan lama. */
export const soalJebakan = (b: BankSoal) => Object.values(b.penyebabSalah).includes('salah_periode') || !!b.catatanAturan;

function cocok(b: BankSoal, peng: Pengaturan): boolean {
  if (!peng.materi.includes(b.kode)) return false;
  if (peng.jenis === 'subtema' && !peng.subtema.includes(b.kode + '::' + b.subtema)) return false;
  if (peng.jenis === 'jebakan' && !soalJebakan(b)) return false;
  return true;
}

/** Soal bank (dan orisinal) yang boleh masuk paket menurut tingkat, jenis, materi, dan subtema. */
export function poolBank(data: DataUkp, peng: Pengaturan): Pool {
  const semua = [...data.bank, ...data.orisinal];
  const tunggal: BankSoal[] = [];
  const grup = new Map<string, BankSoal[]>();
  for (const b of semua) {
    if (b.kasusId) grup.set(b.kasusId, [...(grup.get(b.kasusId) ?? []), b]);
    else if (dalamCakupan(tingkatSoal(b, data.mapping), peng.tingkat) && cocok(b, peng)) tunggal.push(b);
  }
  const blok: BlokKasus[] = [];
  for (const [id, anggota] of grup) {
    const tingkatBlok = anggota.map((b) => tingkatSoal(b, data.mapping)).reduce<Tingkat>((a, t) => (naik(t) > naik(a) ? t : a), 'A');
    if (dalamCakupan(tingkatBlok, peng.tingkat) && anggota.every((b) => cocok(b, peng))) blok.push({ id, kode: anggota[0].kode, anggota });
  }
  return { tunggal, blok };
}

export type Sel = Record<Kesulitan, number>;
const selKosong = (): Sel => ({ mudah: 0, sedang: 0, sulit: 0 });

export interface Stok {
  bank: Record<Kode, Sel>;
  /** Bagian `bank` yang berada di blok kasus; hanya terpakai sebanyak kuota soal kasus. */
  blok: Record<Kode, Sel>;
  kasus: Record<Kode, number>;
  model: Record<Kode, Sel>;
}

export function hitungStok(data: DataUkp, peng: Pengaturan, ctx: KonteksModel): Stok {
  const pool = poolBank(data, peng);
  const bank = Object.fromEntries(URUTAN_KODE.map((k) => [k, selKosong()])) as Record<Kode, Sel>;
  const blok = Object.fromEntries(URUTAN_KODE.map((k) => [k, selKosong()])) as Record<Kode, Sel>;
  const kasus = Object.fromEntries(URUTAN_KODE.map((k) => [k, 0])) as Record<Kode, number>;
  const model = Object.fromEntries(URUTAN_KODE.map((k) => [k, selKosong()])) as Record<Kode, Sel>;
  // Sumber "baru" = model + bank orisinal (bukan salinan LatihUKP).
  const boleh = (b: BankSoal) => peng.sumber !== 'baru' || b.bank === 'orisinal';
  for (const b of pool.tunggal) if (boleh(b)) bank[b.kode][b.kesulitan]++;
  for (const bl of pool.blok) if (bl.anggota.every(boleh)) for (const b of bl.anggota) { bank[b.kode][b.kesulitan]++; blok[b.kode][b.kesulitan]++; kasus[b.kode]++; }
  if (peng.sumber !== 'bank' && peng.jenis !== 'jebakan') {
    for (const k of URUTAN_KODE) {
      if (!peng.materi.includes(k)) continue;
      for (const m of modelUntuk(k)) {
        if (!dalamCakupan(tingkatSoal(m, data.mapping), peng.tingkat)) continue;
        if (peng.jenis === 'subtema' && !peng.subtema.includes(k + '::' + m.subtema)) continue;
        const tersedia = kondisiTersedia(m, ctx);
        if (!tersedia.length) continue;
        const perKondisi = kapasitasModel(m, ctx) / tersedia.length;
        for (const kd of tersedia) model[k][m.kesulitan(kd)] += perKondisi;
      }
    }
  }
  return { bank, blok, kasus, model };
}

/**
 * Soal yang benar-benar bisa mengisi sel (materi, kesulitan): soal tunggal, model, dan anggota blok kasus
 * paling banyak sejumlah soal kasus yang dipakai. Sisa anggota blok tidak bisa menjadi soal tunggal.
 */
export function stokSel(stok: Stok, k: Kode, d: Kesulitan, pakaiKasus: number, sumber: Pengaturan['sumber']): number {
  const tunggal = stok.bank[k][d] - stok.blok[k][d];
  return tunggal + Math.min(stok.blok[k][d], pakaiKasus) + (sumber === 'bank' ? 0 : stok.model[k][d]);
}

const jumlahSel = (s: Sel) => s.mudah + s.sedang + s.sulit;
export const totalBaris = (b: BarisKuota) => b.mudah + b.sedang + b.sulit;

/** Pembagian sisa terbesar: bagi `n` menurut bobot, hasil bulat dengan jumlah tepat n. */
export function bagiSisaTerbesar(n: number, bobot: number[], batas?: number[]): number[] {
  const total = bobot.reduce((a, b) => a + b, 0);
  if (n <= 0 || total <= 0) return bobot.map(() => 0);
  const ideal = bobot.map((w) => (n * w) / total);
  const hasil = ideal.map((x, i) => Math.min(Math.floor(x), batas?.[i] ?? Infinity));
  let sisa = n - hasil.reduce((a, b) => a + b, 0);
  const urut = ideal.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  // Putaran pertama menurut sisa pecahan, berikutnya ke siapa pun yang masih punya ruang.
  for (let putaran = 0; sisa > 0 && putaran < n + bobot.length; putaran++) {
    let maju = false;
    for (const [, i] of urut) {
      if (sisa <= 0) break;
      if (bobot[i] <= 0 || hasil[i] >= (batas?.[i] ?? Infinity)) continue;
      hasil[i]++; sisa--; maju = true;
    }
    if (!maju) break;
  }
  return hasil;
}

/** Kuota otomatis: jumlah soal dibagi proporsional stok per materi, lalu per kesulitan menurut komposisi. */
export function hitungKuota(data: DataUkp, peng: Pengaturan, ctx: KonteksModel): BarisKuota[] {
  const stok = hitungStok(data, peng, ctx);
  const faktor = peng.larangKembar ? Math.max(1, peng.jumlahPaket) : 1;
  const kode = URUTAN_KODE.filter((k) => peng.materi.includes(k));
  const tersedia = (k: Kode): Sel => {
    const s = selKosong();
    for (const d of KESULITAN) s[d] = stok.bank[k][d] + (peng.sumber === 'bank' ? 0 : stok.model[k][d]);
    return s;
  };
  // Bobot materi memakai stok bank (bila ada) supaya komposisi tryout mengikuti sebaran materi sumber.
  const bobot = kode.map((k) => (peng.sumber === 'baru' ? jumlahSel(stok.model[k]) : jumlahSel(stok.bank[k])));
  const batasBaris = kode.map((k) => Math.floor(jumlahSel(tersedia(k)) / faktor));
  const perKode = bagiSisaTerbesar(peng.jumlahSoal, bobot, batasBaris);
  const totalKomposisi = KESULITAN.reduce((a, d) => a + Math.max(0, peng.komposisi[d]), 0) || 1;
  return kode.map((k, i) => {
    const q = perKode[i];
    const shareKasus = peng.sumber === 'baru' || !jumlahSel(stok.bank[k]) ? 0 : stok.kasus[k] / jumlahSel(stok.bank[k]);
    const kasus = Math.min(Math.round(q * shareKasus), Math.floor(stok.kasus[k] / faktor));
    const batas = KESULITAN.map((d) => Math.floor(stokSel(stok, k, d, kasus * faktor, peng.sumber) / faktor));
    let bagi = bagiSisaTerbesar(q, KESULITAN.map((d) => Math.max(0, peng.komposisi[d]) / totalKomposisi), batas);
    // Kesulitan yang stoknya kurang dialihkan ke kesulitan lain yang masih punya ruang (urutan sedang, mudah, sulit).
    let kurang = q - bagi.reduce((a, b) => a + b, 0);
    for (const d of ['sedang', 'mudah', 'sulit'] as Kesulitan[]) {
      const j = KESULITAN.indexOf(d);
      const tambah = Math.min(kurang, batas[j] - bagi[j]);
      if (tambah > 0) { bagi = bagi.map((v, x) => (x === j ? v + tambah : v)); kurang -= tambah; }
    }
    return { kode: k, mudah: bagi[0], sedang: bagi[1], sulit: bagi[2], kasus };
  });
}

export interface HasilCek {
  ok: boolean;
  pesan: string[];
  total: number;
  palingKetat: { kode: Kode; butuh: number; stok: number } | null;
  /** Persentase stok yang terpakai per materi untuk semua paket. */
  pakai: Record<Kode, number>;
  soalBaru: number;
}

/** Cek persediaan sebelum merakit. Kekurangan dilaporkan dengan angka, tanpa mengganti materi diam-diam. */
export function cekPersediaan(data: DataUkp, peng: Pengaturan, baris: BarisKuota[], ctx: KonteksModel): HasilCek {
  const stok = hitungStok(data, peng, ctx);
  const faktor = peng.larangKembar ? Math.max(1, peng.jumlahPaket) : 1;
  const pesan: string[] = [];
  const pakai = Object.fromEntries(URUTAN_KODE.map((k) => [k, 0])) as Record<Kode, number>;
  let palingKetat: HasilCek['palingKetat'] = null, rasioMaks = -1, soalBaru = 0;
  const total = baris.reduce((a, b) => a + totalBaris(b), 0);
  if (total < peng.jumlahSoal && !peng.kuota) pesan.push('Stok hanya cukup untuk ' + total + ' dari ' + peng.jumlahSoal + ' soal per paket bila ' + faktor + ' paket tidak boleh kembar. Kurangi jumlah paket atau jumlah soal, atau izinkan soal kembar antarpaket.');
  else if (total !== peng.jumlahSoal) pesan.push('Jumlah kuota ' + total + ' tidak sama dengan jumlah soal ' + peng.jumlahSoal + '.');
  for (const b of baris) {
    const q = totalBaris(b);
    if (!q) continue;
    const stokBaris = jumlahSel(stok.bank[b.kode]) + (peng.sumber === 'bank' ? 0 : jumlahSel(stok.model[b.kode]));
    for (const d of KESULITAN) {
      const butuh = b[d] * faktor;
      const ada = stokSel(stok, b.kode, d, b.kasus * faktor, peng.sumber);
      if (butuh > ada) pesan.push(b.kode + ' · ' + d + ': butuh ' + butuh + ' soal untuk ' + faktor + ' paket, tersedia ' + Math.floor(ada) + '.');
    }
    if (b.kasus > q) pesan.push(b.kode + ': soal kasus (' + b.kasus + ') melebihi kuota materi (' + q + ').');
    if (b.kasus * faktor > stok.kasus[b.kode]) pesan.push(b.kode + ': butuh ' + b.kasus * faktor + ' soal kasus, tersedia ' + stok.kasus[b.kode] + '.');
    const butuhBaris = q * faktor;
    pakai[b.kode] = stokBaris ? Math.round((butuhBaris / stokBaris) * 100) : 0;
    const rasio = stokBaris ? butuhBaris / stokBaris : Infinity;
    if (rasio > rasioMaks) { rasioMaks = rasio; palingKetat = { kode: b.kode, butuh: butuhBaris, stok: Math.floor(stokBaris) }; }
    if (peng.sumber === 'baru') soalBaru += q;
    else if (peng.sumber === 'campuran' && jumlahSel(stok.model[b.kode]) > 0) soalBaru += Math.min(Math.round((q - b.kasus) * PORSI_BARU_CAMPURAN), Math.floor(jumlahSel(stok.model[b.kode]) / faktor));
  }
  return { ok: pesan.length === 0, pesan, total, palingKetat, pakai, soalBaru };
}
