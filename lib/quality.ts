import { HURUF } from './config';
import { tandaTeks } from './generate';
import { modelById } from './models';
import { opsiAngkaUrut } from './soal';
import type { CekMutu, DataUkp, Huruf, Jebakan, LevelMutu, Paket, Soal } from './types';
import { galatSoalPaket } from './validate';
import { normalTeks, rupiah } from './util';

export interface KonteksMutu { data: DataUkp; tanggalAcuan: string }

const RE_MUTLAK = /semua (jawaban |pernyataan )?(benar|salah)|tidak ada (jawaban |pilihan )?yang (benar|tepat)/i;

function regexJebakan(j: Jebakan) {
  return { pola: new RegExp(j.pola, j.flags ?? 'i'), konteks: j.konteks ? new RegExp(j.konteks, 'i') : null, kecuali: j.kecuali ? new RegExp(j.kecuali, 'i') : null };
}

/** Pola bahan lama yang cocok dengan teks (memperhatikan materi, konteks aturan, dan pengecualian sah). */
export function cariJebakan(teks: string, s: Pick<Soal, 'kode' | 'soal' | 'kasus'>, daftar: Jebakan[]): Jebakan[] {
  const semuaTeks = (s.kasus ?? '') + ' ' + s.soal + ' ' + teks;
  return daftar.filter((j) => {
    if (j.kode && !j.kode.includes(s.kode)) return false;
    const { pola, konteks, kecuali } = regexJebakan(j);
    return pola.test(teks) && (!konteks || konteks.test(semuaTeks)) && !(kecuali && kecuali.test(semuaTeks));
  });
}

export function cekSoal(s: Soal, k: KonteksMutu): CekMutu[] {
  const hasil: CekMutu[] = [];
  const tambah = (id: string, level: LevelMutu, judul: string, ket: string, aksi?: CekMutu['aksi']) => hasil.push({ id, level, judul, ket, aksi });
  const galat = galatSoalPaket(s);
  if (galat.length) tambah('struktur', 'gagal', 'Struktur', galat.join('; '));
  else tambah('struktur', 'lolos', 'Struktur', '4 opsi berbeda, 1 kunci');

  if (s.modelId) {
    const m = modelById(s.modelId);
    if (!m) tambah('hitung', 'gagal', 'Hitung ulang', 'model ' + s.modelId + ' tidak dikenal');
    else if (s.disunting) tambah('hitung', 'peringatan', 'Hitung ulang', 'soal disunting, bukti model batal; periksa kunci secara manual');
    else {
      try {
        const ulang = m.hitungUlang(s.params ?? {}, { data: k.data, tanggalAcuan: k.tanggalAcuan });
        const kunci = s.opsi[s.kunci];
        if (normalTeks(ulang) !== normalTeks(kunci)) tambah('hitung', 'gagal', 'Hitung ulang', 'hasil mesin ' + ulang + ' berbeda dengan kunci ' + kunci);
        else if (s.kunciModel && normalTeks(s.kunciModel) !== normalTeks(kunci)) tambah('hitung', 'gagal', 'Hitung ulang', 'kunci berubah dari hasil model ' + s.kunciModel);
        else tambah('hitung', 'lolos', 'Hitung ulang', 'model ' + m.nama + ': ' + kunci + ', cocok dengan kunci');
      } catch (e) {
        tambah('hitung', 'gagal', 'Hitung ulang', (e as Error).message);
      }
    }
  }

  const aturan = new Map(k.data.aturan.map((a) => [a.id, a]));
  const hilang = s.ruleIds.filter((id) => !aturan.has(id));
  if (hilang.length) tambah('rujukan', 'peringatan', 'Rujukan', 'kartu aturan ' + hilang.join(', ') + ' tidak ada');
  else if (!s.ruleIds.length) tambah('rujukan', 'info', 'Rujukan', 'tidak terhubung ke kartu aturan; ' + s.dasarHukum.length + ' dasar hukum');
  else tambah('rujukan', 'lolos', 'Rujukan', s.ruleIds.join(', ') + ' ada; ' + s.dasarHukum.length + ' dasar hukum');
  if (!s.dasarHukum.length) tambah('dasar', 'peringatan', 'Dasar hukum', 'dasar hukum kosong');

  for (const id of s.ruleIds) {
    const a = aturan.get(id);
    if (!a) continue;
    if (a.berlaku.mulai && a.berlaku.mulai > k.tanggalAcuan) tambah('berlaku-' + id, 'peringatan', 'Masa berlaku', id + ' baru berlaku ' + a.berlaku.mulai + ', setelah tanggal acuan ' + k.tanggalAcuan);
    if (a.berlaku.sampai && a.berlaku.sampai < k.tanggalAcuan) tambah('berlaku-' + id, 'peringatan', 'Masa berlaku', id + ' berakhir ' + a.berlaku.sampai + ', sebelum tanggal acuan ' + k.tanggalAcuan);
  }

  const kunciLama = cariJebakan(s.opsi[s.kunci] + ' ' + s.inti, s, k.data.jebakan);
  for (const j of kunciLama) tambah('lama-' + j.id, 'peringatan', 'Aturan lama', 'kunci atau inti memuat ketentuan lama: ' + j.pesan);
  for (const h of HURUF) {
    if (h === s.kunci) continue;
    const lama = cariJebakan(s.opsi[h], s, k.data.jebakan);
    if (lama.length) tambah('pengecoh-' + h, 'info', 'Aturan lama', 'opsi ' + h + ' memakai ketentuan lama (' + lama[0].topik + '); pengecoh, bukan kunci');
  }

  const panjang = HURUF.map((h) => s.opsi[h].length);
  const rasio = Math.max(...panjang) / Math.max(1, Math.min(...panjang));
  if (!s.opsiAngka && rasio > 3) tambah('panjang', 'peringatan', 'Panjang opsi', 'timpang, rasio ' + rasio.toFixed(1).replace('.', ',') + '×');
  const urut = [...HURUF].sort((a, b) => s.opsi[b].length - s.opsi[a].length);
  if (!s.opsiAngka && urut[0] === s.kunci && s.opsi[urut[0]].length > 1.2 * s.opsi[urut[1]].length) tambah('terpanjang', 'peringatan', 'Panjang opsi', 'kunci opsi terpanjang');
  else if (!s.opsiAngka && rasio <= 3) tambah('panjang', 'lolos', 'Panjang opsi', 'seimbang, rasio ' + rasio.toFixed(2).replace('.', ',') + '×');
  if (s.opsiAngka && !opsiAngkaUrut(s)) tambah('urutan', 'peringatan', 'Urutan opsi', 'opsi angka belum urut naik', 'urutkan');
  if (HURUF.some((h) => RE_MUTLAK.test(s.opsi[h]))) tambah('mutlak', 'peringatan', 'Opsi mutlak', 'ada opsi "semua benar/salah"');
  if (s.asal === 'bank' || s.asal === 'adaptasi') tambah('asal', 'info', 'Asal', (s.asal === 'adaptasi' ? 'adaptasi identitas dari ' : 'acuan sumber LatihUKP ') + s.sumberId + '; ekspor produksi butuh konfirmasi', s.asal === 'bank' ? 'adaptasi' : undefined);
  if (s.disunting && !s.modelId) tambah('sunting', 'info', 'Revisi', 'disunting, revisi ' + s.revisi);
  if (!s.bloom) tambah('bloom', 'info', 'Label', 'level Bloom belum dilabel di sumber');
  return hasil;
}

export interface MutuPaket {
  perSoal: Map<string, CekMutu[]>;
  paket: CekMutu[];
  lolos: number;
  catatan: number;
  gagal: number;
}

export const levelSoal = (c: CekMutu[]): 'gagal' | 'catatan' | 'lolos' => (c.some((x) => x.level === 'gagal') ? 'gagal' : c.some((x) => x.level === 'peringatan') ? 'catatan' : 'lolos');

const shingle = (t: string) => {
  const w = normalTeks(t).replace(/rp[\d.,]+|\d[\d.,]*/g, '#').split(/[^a-z#]+/).filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) s.add(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]);
  return s;
};
export function kemiripan(a: string, b: string) {
  const x = shingle(a), y = shingle(b);
  if (!x.size || !y.size) return 0;
  let sama = 0;
  for (const v of x) if (y.has(v)) sama++;
  return sama / (x.size + y.size - sama);
}

/** Mutu satu paket: cek per soal + sebaran kunci, kembar, kemiripan, keutuhan blok kasus, dan keragaman konteks. */
export function cekPaket(p: Paket, k: KonteksMutu, semua: Paket[] = [p], larangKembar = true): MutuPaket {
  const perSoal = new Map<string, CekMutu[]>();
  for (const s of p.soal) perSoal.set(s.uid, cekSoal(s, k));
  const paket: CekMutu[] = [];
  const n = p.soal.length;
  const hitung: Record<Huruf, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const s of p.soal) hitung[s.kunci]++;
  const bawah = Math.floor(n / 4) - 2, atas = Math.ceil(n / 4) + 2;
  const timpang = HURUF.filter((h) => hitung[h] < bawah || hitung[h] > atas);
  paket.push(timpang.length
    ? { id: 'kunci', level: 'peringatan', judul: 'Posisi kunci', ket: 'tidak merata: ' + HURUF.map((h) => h + hitung[h]).join(' ') + ' (batas ' + bawah + '–' + atas + ')' }
    : { id: 'kunci', level: 'lolos', judul: 'Posisi kunci', ket: HURUF.map((h) => h + hitung[h]).join(' ') });
  const tambahSoal = (s: Soal, c: CekMutu) => perSoal.get(s.uid)!.push(c);
  // Kembar di dalam paket dan antarpaket.
  const lihat = new Map<string, string>();
  for (const q of semua) for (const s of q.soal) {
    for (const kunci of [s.sumberId ? 'id|' + s.sumberId : '', 'tanda|' + s.tanda, 'teks|' + tandaTeks(s)].filter(Boolean)) {
      const sebelum = lihat.get(kunci);
      if (sebelum && (q.id === p.id || larangKembar) && p.soal.includes(s)) tambahSoal(s, { id: 'kembar', level: 'gagal', judul: 'Kembar', ket: 'sama dengan soal ' + sebelum });
      if (!sebelum) lihat.set(kunci, q.id + ' no ' + (q.soal.indexOf(s) + 1));
    }
  }
  // Kemiripan teks di dalam paket (selain blok kasus yang memang berbagi stimulus).
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = p.soal[i], b = p.soal[j];
    if (a.kasusId && a.kasusId === b.kasusId) continue;
    if (a.modelId && a.modelId === b.modelId) continue;
    const m = kemiripan(a.soal, b.soal);
    if (m > 0.8) {
      tambahSoal(a, { id: 'mirip-' + (j + 1), level: 'peringatan', judul: 'Kemiripan', ket: 'batang soal mirip ' + Math.round(m * 100) + '% dengan nomor ' + (j + 1) });
      tambahSoal(b, { id: 'mirip-' + (i + 1), level: 'peringatan', judul: 'Kemiripan', ket: 'batang soal mirip ' + Math.round(m * 100) + '% dengan nomor ' + (i + 1) });
    }
  }
  // Blok kasus harus utuh dan berurutan.
  const posisi = new Map<string, number[]>();
  p.soal.forEach((s, i) => s.kasusId && posisi.set(s.kasusId, [...(posisi.get(s.kasusId) ?? []), i]));
  const ukuranBlok = new Map<string, number>();
  for (const b of [...k.data.bank, ...k.data.orisinal]) if (b.kasusId) ukuranBlok.set(b.kasusId, (ukuranBlok.get(b.kasusId) ?? 0) + 1);
  for (const [id, idx] of posisi) {
    const urut = idx.every((v, x) => x === 0 || v === idx[x - 1] + 1);
    if (!urut || idx.length !== ukuranBlok.get(id)) paket.push({ id: 'blok-' + id, level: 'gagal', judul: 'Blok kasus', ket: 'kasus ' + id + ' tidak utuh atau terpisah (nomor ' + idx.map((v) => v + 1).join(', ') + ')' });
  }
  // Keragaman konteks: satu kota tidak mendominasi paket.
  const kota = [...new Set([...k.data.konteks.kota, 'Morowali'])];
  const batasKota = Math.max(5, Math.ceil(n * 0.1));
  for (const kt of kota) {
    const re = new RegExp('\\b' + kt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    const jumlah = p.soal.filter((s) => re.test((s.kasus ?? '') + ' ' + s.soal)).length;
    if (jumlah > batasKota) paket.push({ id: 'kota-' + kt, level: 'peringatan', judul: 'Keragaman konteks', ket: kt + ' muncul di ' + jumlah + ' soal (batas ' + batasKota + ')' });
  }
  let lolos = 0, catatan = 0, gagal = 0;
  for (const c of perSoal.values()) {
    const l = levelSoal(c);
    if (l === 'gagal') gagal++; else if (l === 'catatan') catatan++; else lolos++;
  }
  return { perSoal, paket, lolos, catatan, gagal };
}

export const ringkasNilai = (n: number) => rupiah(n);
