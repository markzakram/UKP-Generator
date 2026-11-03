import type { Huruf, Kesulitan, Kode, Pengaturan, Tingkat } from './types';

// K1 (PRD bagian 15): nama kerja dan aksen sampai merek diputuskan.
export const NAMA_APLIKASI = 'UKP Studio';
export const AKSEN = '#B45309';

export const HURUF: Huruf[] = ['A', 'B', 'C', 'D'];
export const TINGKAT: Tingkat[] = ['A', 'B', 'C'];
export const KESULITAN: Kesulitan[] = ['mudah', 'sedang', 'sulit'];
export const LABEL_KESULITAN: Record<Kesulitan, string> = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' };
export const URUTAN_KODE: Kode[] = ['KUP', 'OP', 'PP', 'PPN', 'BM', 'PBB', 'AKT', 'BDN', 'BTI', 'INT'];

export const BATAS = { paket: 50, soalPerPaket: 200, soalPerProses: 4000, riwayat: 20 };

/** Komposisi kesulitan bawaan per tingkat (persen mudah, sedang, sulit); tetap bisa diubah per paket. */
export const KOMPOSISI_TINGKAT: Record<Tingkat, Record<Kesulitan, number>> = {
  A: { mudah: 40, sedang: 45, sulit: 15 },
  B: { mudah: 30, sedang: 50, sulit: 20 },
  C: { mudah: 20, sedang: 50, sulit: 30 },
};

/** Bagian slot materi bermodel yang diisi soal baru pada sumber "campuran". */
export const PORSI_BARU_CAMPURAN = 0.5;

export const hariIni = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export function pengaturanAwal(): Pengaturan {
  return {
    judul: 'Tryout UKP',
    tingkat: 'C',
    jenis: 'tryout',
    jumlahSoal: 100,
    durasi: 180,
    jumlahPaket: 3,
    seed: 'UKP-C-01',
    tanggalAcuan: hariIni(),
    larangKembar: true,
    sumber: 'campuran',
    komposisi: { ...KOMPOSISI_TINGKAT.C },
    materi: [...URUTAN_KODE],
    subtema: [],
    urutan: 'materi',
    kuota: null,
  };
}
