import { poolBank } from './blueprint';
import { catatTerpakai, cobaModel, terpakaiDari, terpakaiKosong, tandaTeks } from './generate';
import type { KonteksModel } from './models/types';
import { dariBank, hitungKunciKosong, pilihUrutan, terapkanUrutan } from './soal';
import type { BankSoal, DataUkp, Paket, Pengaturan, Soal } from './types';
import { rng } from './util';

export interface HasilGanti {
  paket: Paket[];
  diganti: number;
  gagal: { nomor: number; alasan: string }[];
  ringkasan: string;
}

/**
 * Ganti nomor terpilih pada satu paket. Pengganti berasal dari materi, subtema, cakupan tingkat, dan kesulitan
 * yang sama, tidak kembar dengan soal mana pun di semua paket maupun dengan pengganti lain pada aksi yang sama.
 * Soal kasus diganti satu blok utuh dengan blok lain yang ukurannya sama. Nomor dan posisi kunci dipertahankan
 * (kecuali soal berposisi tetap atau beropsi angka yang selalu diurutkan).
 */
export function gantiNomor(data: DataUkp, peng: Pengaturan, semua: Paket[], indeksPaket: number, nomor: number[], seed: string): HasilGanti {
  const paket = semua[indeksPaket];
  const ctx: KonteksModel = { data, tanggalAcuan: peng.tanggalAcuan };
  const pool = poolBank(data, peng);
  const terpakai = terpakaiDari(semua);
  const r = rng(seed);
  const soalBaru = [...paket.soal];
  const gagal: HasilGanti['gagal'] = [];
  let diganti = 0;
  const sudah = new Set<number>();
  const kondisiPaket = new Set(paket.soal.filter((s) => s.modelId).map((s) => s.tanda.split('|').slice(0, 2).join('|')));
  const urutTujuan = [...new Set(nomor)].sort((a, b) => a - b);
  const pasang = (indeks: number, lama: Soal, baru: Soal) => {
    const tujuan = pilihUrutan(baru, r, hitungKunciKosong(), lama.kunci);
    const jadi = terapkanUrutan(baru, tujuan);
    soalBaru[indeks] = jadi;
    catatTerpakai(terpakai, jadi);
  };
  for (const no of urutTujuan) {
    const i = no - 1;
    const lama = paket.soal[i];
    if (!lama) { gagal.push({ nomor: no, alasan: 'nomor tidak ada' }); continue; }
    if (sudah.has(i)) continue;
    if (lama.kasusId) {
      // Seluruh blok kasus diganti bersama.
      const indeksBlok = paket.soal.map((s, j) => (s.kasusId === lama.kasusId ? j : -1)).filter((j) => j >= 0);
      const ukuran = indeksBlok.length;
      const calon = r.shuffle(pool.blok.filter((b) => b.kode === lama.kode && b.id !== lama.kasusId && b.anggota.length === ukuran
        && b.anggota.every((x) => !terpakai.bank.has(x.id) && !terpakai.teks.has(tandaTeks(x)))));
      const pilih = calon.find((b) => b.anggota.some((x) => x.subtema === lama.subtema)) ?? calon[0];
      if (!pilih) { gagal.push({ nomor: no, alasan: 'tidak ada blok kasus ' + lama.kode + ' berisi ' + ukuran + ' soal yang belum dipakai' }); indeksBlok.forEach((j) => sudah.add(j)); continue; }
      indeksBlok.forEach((j, k) => pasang(j, paket.soal[j], dariBank(pilih.anggota[k], data)));
      indeksBlok.forEach((j) => sudah.add(j));
      diganti += ukuran;
      continue;
    }
    sudah.add(i);
    let pengganti: Soal | null = null;
    if (lama.asal === 'model' && lama.modelId) {
      const lokal = terpakaiKosong();
      for (const s of soalBaru) catatTerpakai(lokal, s);
      pengganti = cobaModel({ data, peng: { ...peng, larangKembar: true }, ctx, r, kode: lama.kode, kesulitan: lama.kesulitan, modelId: lama.modelId, global: terpakai, lokal, kondisiPaket })
        ?? cobaModel({ data, peng: { ...peng, larangKembar: true }, ctx, r, kode: lama.kode, kesulitan: lama.kesulitan, subtema: lama.subtema, global: terpakai, lokal, kondisiPaket });
    }
    if (!pengganti) {
      const cocok = (b: BankSoal) => b.kode === lama.kode && b.subtema === lama.subtema && b.kesulitan === lama.kesulitan
        && !terpakai.bank.has(b.id) && !terpakai.teks.has(tandaTeks(b));
      const calon = pool.tunggal.filter(cocok);
      if (calon.length) pengganti = dariBank(r.pick(calon), data);
    }
    if (!pengganti) { gagal.push({ nomor: no, alasan: 'stok ' + lama.kode + ' · ' + lama.subtema + ' · ' + lama.kesulitan + ' habis' }); continue; }
    pasang(i, lama, pengganti);
    diganti++;
  }
  const hasil = semua.map((p, j) => (j === indeksPaket ? { ...p, soal: soalBaru } : p));
  const ringkasan = diganti + ' nomor diganti' + (gagal.length ? ', ' + gagal.length + ' tetap (stok habis)' : '');
  return { paket: hasil, diganti, gagal, ringkasan };
}
