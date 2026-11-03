// Naskah materi: kerangka deck yang bisa disunting, diimpor, dan dirender menjadi .pptx.
// Satu SlideNaskah bisa menjadi lebih dari satu slide jadi bila isinya dipecah ke slide "(lanjutan)".

export type Pola = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P10' | 'P15' | 'P16';
export type AsalBlok = 'acuan' | 'tulis' | 'orisinal' | 'model' | 'otomatis';
export type Ikon = 1 | 2 | 3 | 4 | 5;
export type Gambar = 'dokumen' | 'bertanya' | 'tanpa';

export const NAMA_POLA: Record<Pola, string> = {
  P1: 'Sampul', P2: 'Ikhtisar', P3: 'Konsep', P4: 'Definisi', P5: 'Dua kartu kontras', P6: 'Tabel',
  P7: 'Langkah', P10: 'Kesalahan umum', P15: 'Penutup', P16: 'Pembatas bagian'
};

interface SlideDasar {
  id: string;
  /** Label bagian di bilah navigasi yang ditampilkan aktif. Kosong = semua label tampil biasa. */
  bagian?: string;
  /** Teks chip judul bagian di kiri atas (slide isi). */
  chip?: string;
  ikon?: Ikon;
  /** Catatan pembicara (ikut di .pptx mulai tahap M2). */
  catatanPembicara?: string;
  asal?: AsalBlok;
  sumber?: string[];
  sembunyi?: boolean;
}

export interface Sorotan { label?: string; teks: string }
export interface KartuIkhtisar { judul: string; isi: string; ikon?: Ikon }
export interface Definisi { label: string; isi: string }
export interface SisiKontras { judul: string; poin: string[] }
export interface SisiKesalahan { judul: string; isi: string }

export type SlideNaskah = SlideDasar & (
  | { pola: 'P1'; judul: string; pil: string[] }
  | { pola: 'P2'; judul: string; subjudul?: string; kartu: KartuIkhtisar[] }
  | { pola: 'P3'; judul: string; pembuka?: string; isi: string; sorotan?: Sorotan; gambar?: Gambar }
  | { pola: 'P4'; judul: string; pembuka?: string; item: Definisi[] }
  | { pola: 'P5'; judul: string; pembuka?: string; kiri: SisiKontras; kanan: SisiKontras }
  | { pola: 'P6'; judul: string; pembuka?: string; kolom: string[]; baris: string[][]; lebar?: number[] }
  | { pola: 'P7'; judul: string; pembuka?: string; langkah: string[]; gambar?: Gambar }
  | { pola: 'P10'; judul: string; pembuka?: string; keliru: SisiKesalahan; benar: SisiKesalahan }
  | { pola: 'P15'; judul: string }
  | { pola: 'P16'; judul: string; subjudul?: string }
);

export interface Naskah {
  versi: 1;
  judul: string;
  subjudul?: string;
  kode?: string;
  materi?: string;
  subtema?: string;
  tingkat?: string;
  /** Tanggal acuan aturan, YYYY-MM-DD. */
  tanggalAcuan: string;
  /** Waktu pembuatan ISO; dipakai untuk properti berkas sehingga hasilnya deterministik. */
  dibuat: string;
  /** Label bilah navigasi, paling banyak 6. */
  nav: string[];
  slides: SlideNaskah[];
}
