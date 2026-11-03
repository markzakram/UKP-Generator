// Hasil tata letak: daftar kotak berposisi mutlak (satuan pt pada kanvas 1440 x 810).
// Kotak yang sama dipakai penulis .pptx dan pratinjau di browser.
import type { Pola } from './naskah';

export const KANVAS = { w: 1440, h: 810 } as const;

export interface Run { t: string; b?: boolean; i?: boolean; warna?: string }
export interface Paragraf { runs: Run[]; butir?: boolean }

export type Aset =
  | 'foto-latar' | 'ikon-1' | 'ikon-2' | 'ikon-3' | 'ikon-4' | 'ikon-5'
  | 'peringatan' | 'ilustrasi-dokumen' | 'ilustrasi-bertanya';

/** Aset yang punya pasangan SVG di paket dasar. */
export const ASET_SVG: Aset[] = ['ikon-1', 'ikon-2', 'ikon-3', 'ikon-4', 'ikon-5', 'peringatan', 'ilustrasi-bertanya'];

export interface Gradien { dari: string; ke: string; sudut: number; alfa?: number }

export interface KotakTeks {
  jenis: 'teks'; nama: string; x: number; y: number; w: number; h: number;
  paragraf: Paragraf[]; pt: number; warna: string; gradien?: Gradien;
  tebal?: boolean; miring?: boolean;
  rata: 'l' | 'ctr' | 'r'; jangkar: 't' | 'ctr' | 'b';
  /** Tinggi baris dalam kelipatan ukuran huruf. */
  jarak: number;
  /** Jarak antarparagraf dalam kelipatan ukuran huruf. */
  antarPar: number;
}
export interface KotakBentuk {
  jenis: 'bentuk'; nama: string; x: number; y: number; w: number; h: number;
  isi?: string; alfa?: number; gradien?: Gradien;
  /** Jari-jari sudut dalam pt; 0 = persegi. */
  radius?: number;
  garis?: { warna: string; tebal: number };
  bayangan?: boolean;
}
export interface KotakGambar {
  jenis: 'gambar'; nama: string; x: number; y: number; w: number; h: number;
  aset: Aset; opasitas?: number; alt: string;
}
export interface KotakGaris {
  jenis: 'garis'; nama: string; x1: number; y1: number; x2: number; y2: number; warna: string; tebal: number;
}
export type Kotak = KotakTeks | KotakBentuk | KotakGambar | KotakGaris;

export type JenisLaporan = 'diperkecil' | 'dipecah' | 'dipotong' | 'label-panjang';
export interface Laporan { jenis: JenisLaporan; pesan: string }

export interface SlideJadi {
  /** id SlideNaskah asal. */
  asal: string;
  pola: Pola;
  /** 0 = slide utama, 1.. = slide lanjutan. */
  lanjutan: number;
  judul: string;
  kotak: Kotak[];
  catatan: string;
  laporan: Laporan[];
}
