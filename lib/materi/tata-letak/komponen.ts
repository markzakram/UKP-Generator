// Token desain template dan komponen bersama slide (chip, judul, bilah navigasi).
// Semua ukuran dalam pt pada kanvas 1440 x 810 (PRD-Materi bagian 5 dan 11).
import type { Aset, Gradien, JenisLaporan, Kotak, KotakTeks, Laporan, Paragraf, SlideJadi } from '../kotak';
import { CADANGAN_TINGGI, EPS, type HasilPas, kalimat, lebarTeks, pasUkuran, potongAgarMuat, ruang, tinggiTeks } from '../metrik';
import type { Ikon, Naskah, Pola, SlideNaskah } from '../naskah';

export const W = {
  langit: '00AEEF', tua: '004B66', teal: '0A6486', slate: '364D61', mint: 'CFE2BE',
  putih: 'FFFFFF', hitam: '1A1A1A', navPudar: '5E8EA3', barisMuda: 'F3F8FA', garisTabel: 'C9D6DE', kotakMuda: 'EAF5F9'
} as const;

export const GRADIEN_JUDUL: Gradien = { dari: W.langit, ke: W.tua, sudut: 45 };
export const TEPI = 57;
export const LEBAR_ISI = 1326;
/** Isi slide tidak boleh melewati garis ini (bilah navigasi mulai di 720). */
export const BATAS_BAWAH = 700;
export const NAV = { x: 57, y: 720, w: 1327, h: 64 } as const;

/** Pengumpul kotak dan laporan untuk satu slide jadi. */
export class Slide {
  kotak: Kotak[] = [];
  laporan: Laporan[] = [];
  constructor(public asal: SlideNaskah, public lanjutan: number, public judul: string) {}

  lapor(jenis: JenisLaporan, pesan: string) { this.laporan.push({ jenis, pesan }); }

  teks(o: Omit<KotakTeks, 'jenis' | 'nama' | 'rata' | 'jangkar' | 'jarak' | 'antarPar' | 'warna'> & Partial<Pick<KotakTeks, 'nama' | 'rata' | 'jangkar' | 'jarak' | 'antarPar' | 'warna'>>) {
    const k: KotakTeks = { jenis: 'teks', nama: 'Teks', rata: 'l', jangkar: 't', jarak: 1.2, antarPar: 0.35, warna: W.hitam, ...o };
    this.kotak.push(k);
    return k;
  }
  bentuk(o: Omit<Extract<Kotak, { jenis: 'bentuk' }>, 'jenis' | 'nama'> & { nama?: string }) {
    this.kotak.push({ jenis: 'bentuk', nama: 'Bentuk', ...o });
  }
  gambar(aset: Aset, x: number, y: number, w: number, h: number, alt: string, opasitas?: number) {
    this.kotak.push({ jenis: 'gambar', nama: 'Gambar', aset, x, y, w, h, alt, opasitas });
  }
  garis(x1: number, y1: number, x2: number, y2: number, warna: string, tebal = 1.25) {
    this.kotak.push({ jenis: 'garis', nama: 'Garis', x1, y1, x2, y2, warna, tebal });
  }
  jadi(catatan = ''): SlideJadi {
    return { asal: this.asal.id, pola: this.asal.pola as Pola, lanjutan: this.lanjutan, judul: this.judul, kotak: this.kotak, catatan, laporan: this.laporan };
  }
}

export const par = (t: string, o: { b?: boolean; i?: boolean; butir?: boolean } = {}): Paragraf => ({ runs: [{ t, b: o.b, i: o.i }], butir: o.butir });

/** Paragraf "Label: isi" dengan label tebal bila ada titik dua di awal (≤ 48 huruf). */
export function parBerlabel(t: string): Paragraf {
  const m = t.match(/^([^:]{2,48}):\s+(.+)$/s);
  return m ? { runs: [{ t: m[1] + ': ', b: true }, { t: m[2] }] } : par(t);
}

/**
 * Pas teks ke kotak: ukuran turun dari maks ke min; bila masih tidak muat, teks dipotong dengan "…"
 * (hanya untuk teks pendek seperti judul/label) dan dilaporkan.
 */
export function pasAtauPotong(s: Slide, teks: string, lebar: number, tinggi: number, maks: number, min: number, opsi: { tebal?: boolean; jarak?: number; maksBaris?: number; label: string }): { teks: string; hasil: HasilPas } {
  const jarak = opsi.jarak ?? 1.2;
  const muatBaris = Math.max(1, Math.floor((tinggi - min * CADANGAN_TINGGI) / (min * jarak) + EPS));
  const maksBaris = opsi.maksBaris ?? muatBaris;
  let hasil = pasUkuran([par(teks, { b: opsi.tebal })], lebar, tinggi, maks, min, { tebal: opsi.tebal, jarak }, maksBaris);
  if (hasil.muat) return { teks, hasil };
  const baris = Math.min(maksBaris, muatBaris);
  const dipotong = potongAgarMuat(teks, min, lebar, baris, opsi.tebal);
  s.lapor('dipotong', `${opsi.label} dipotong agar muat (${min} pt): "${teks.slice(0, 60)}…"`);
  hasil = pasUkuran([par(dipotong, { b: opsi.tebal })], lebar, tinggi, min, min, { tebal: opsi.tebal, jarak }, baris);
  return { teks: dipotong, hasil };
}

/** Chip judul bagian di kiri atas: kotak gradien muda, ubin ikon putih, teks gradien. */
export function chip(s: Slide, teks: string, ikon: Ikon) {
  const maksTeks = 760;
  let pt = 29;
  while (pt > 20 && lebarTeks(teks, pt, true) > maksTeks) pt--;
  let isi = teks;
  if (lebarTeks(isi, pt, true) > maksTeks) {
    isi = potongAgarMuat(teks, pt, maksTeks, 1, true);
    s.lapor('label-panjang', `Teks chip terlalu panjang, dipotong: "${teks}"`);
  }
  const lebar = Math.min(900, Math.max(360, 82 + lebarTeks(isi, pt, true) + 34));
  s.bentuk({ nama: 'Chip', x: 56, y: 29, w: lebar, h: 77, gradien: { dari: W.langit, ke: W.mint, sudut: 45, alfa: 48 }, radius: 6 });
  s.bentuk({ nama: 'Ubin ikon', x: 70, y: 41, w: 54, h: 54, isi: W.putih, radius: 12, bayangan: true });
  s.gambar(`ikon-${ikon}` as Aset, 80, 51, 34, 34, 'Ikon bagian');
  s.teks({ nama: 'Judul bagian', x: 138, y: 29, w: lebar - 82 - 10, h: 77, paragraf: [par(isi, { b: true })], pt, tebal: true, gradien: GRADIEN_JUDUL, jangkar: 'ctr', jarak: 1.2 });
}

/** Judul slide isi (teal, tebal, kiri). Mengembalikan y bawah judul. */
export function judulSlide(s: Slide, teks: string, y = 128): number {
  // Utamakan satu baris (54→44 pt); bila tidak muat, dua baris (54→38 pt).
  const satu = pasUkuran([par(teks, { b: true })], LEBAR_ISI, ruang(1, 54, 1.15), 54, 44, { tebal: true, jarak: 1.15 }, 1);
  const { teks: isi, hasil } = satu.muat ? { teks, hasil: satu } : pasAtauPotong(s, teks, LEBAR_ISI, ruang(2, 54, 1.15), 54, 38, { tebal: true, jarak: 1.15, maksBaris: 2, label: 'Judul slide' });
  const tinggi = hasil.tinggi;
  s.teks({ nama: 'Judul', x: TEPI, y, w: LEBAR_ISI, h: tinggi + 4, paragraf: [par(isi, { b: true })], pt: hasil.pt, tebal: true, warna: W.teal, jarak: 1.15 });
  return y + tinggi + 4;
}

/** Bilah navigasi bawah; label bagian aktif berwarna tua, lainnya pudar. */
export function navBar(s: Slide, label: string[], aktif?: string) {
  if (!label.length) return;
  s.bentuk({ nama: 'Navigasi', x: NAV.x, y: NAV.y, w: NAV.w, h: NAV.h, gradien: { dari: W.langit, ke: W.mint, sudut: 0, alfa: 65 }, radius: 0 });
  const lebar = NAV.w / label.length;
  label.forEach((t, i) => {
    const w = lebar - 24;
    const { teks, hasil } = pasAtauPotong(s, t, w, NAV.h - 8, 17, 14, { tebal: true, jarak: 1.15, maksBaris: 2, label: 'Label navigasi' });
    const nyala = !aktif || aktif === t;
    s.teks({ nama: 'Nav ' + (i + 1), x: NAV.x + i * lebar + 12, y: NAV.y + 4, w, h: NAV.h - 8, paragraf: [par(teks, { b: true })], pt: hasil.pt, tebal: true, warna: nyala ? W.tua : W.navPudar, rata: 'ctr', jangkar: 'ctr', jarak: 1.15 });
  });
}

/** Chip + judul + bilah navigasi untuk slide isi. Mengembalikan y awal isi. */
export function kepala(s: Slide, naskah: Naskah, judul: string): number {
  const a = s.asal;
  chip(s, a.chip || naskah.subtema || naskah.judul, a.ikon ?? 1);
  navBar(s, a.nav ?? naskah.nav, a.bagian);
  return judulSlide(s, judul) + 16;
}

/**
 * Teks pembuka (slate) di bawah judul. Kalimat yang tidak muat dalam maksBaris tidak dipotong,
 * tetapi dikembalikan sebagai `sisa` agar pemanggil memindahkannya ke isi.
 */
export function pembuka(s: Slide, teks: string | undefined, y: number, lebar = LEBAR_ISI, maks = 30, min = 22, maksBaris = 3): { y: number; sisa: string } {
  if (!teks) return { y, sisa: '' };
  const tinggiMaks = ruang(maksBaris, maks, 1.2);
  let hasil = pasUkuran([par(teks)], lebar, tinggiMaks, maks, min, {}, maksBaris);
  let isi = teks, sisa = '';
  if (!hasil.muat) {
    const k = kalimat(teks);
    let n = k.length - 1;
    while (n > 0 && !(hasil = pasUkuran([par(k.slice(0, n).join(' '))], lebar, tinggiMaks, maks, min, {}, maksBaris)).muat) n--;
    if (n <= 0) return { y, sisa: teks };
    isi = k.slice(0, n).join(' ');
    sisa = k.slice(n).join(' ');
  }
  const tinggi = hasil.tinggi;
  s.teks({ nama: 'Pembuka', x: TEPI, y, w: lebar, h: tinggi + 2, paragraf: [par(isi)], pt: hasil.pt, warna: W.slate });
  return { y: y + tinggi + 2 + 18, sisa };
}

/** Pembuka untuk pola tanpa isi paragraf: sisa kalimat yang tidak muat dilaporkan untuk disunting. */
export function pembukaPendek(s: Slide, teks: string | undefined, y: number, maks = 28, min = 20, maksBaris = 3): number {
  const p = pembuka(s, teks, y, LEBAR_ISI, maks, min, maksBaris);
  if (p.sisa) s.lapor('dipotong', `Teks pembuka terlalu panjang untuk pola ini; tidak tampil: "${p.sisa.slice(0, 60)}…"`);
  return p.y;
}

export const judulLanjutan = (judul: string, ke: number) => (ke > 0 ? `${judul} (lanjutan)` : judul);


export interface RencanaTumpukan { n: number; pt: number; tinggi: number[] }

/**
 * Rencana baris berkotak yang ditumpuk (langkah, kuis, rangkuman): ukuran seragam terbesar (maks→min)
 * yang memuat n baris pertama dalam `tersedia`; bila tidak ada, n dikurangi (sisanya ke slide lanjutan).
 */
export function rencanaTumpukan(baris: Paragraf[][], lebarTeks: number, tersedia: number, maks: number, min: number,
  opsi: { jarak: number; tinggiMin: number; pad: number; perSlide: number; ptTetap?: number }): RencanaTumpukan {
  const tinggiBaris = (p: Paragraf[], pt: number) => Math.max(opsi.tinggiMin, tinggiTeks(p, pt, lebarTeks).tinggi + 2 * opsi.pad);
  const total = (n: number, pt: number) => baris.slice(0, n).reduce((x, p) => x + tinggiBaris(p, pt), 0) + opsi.jarak * (n - 1);
  let n = Math.min(opsi.perSlide, baris.length), pt = opsi.ptTetap ?? maks;
  for (;;) {
    pt = opsi.ptTetap ?? maks;
    while (opsi.ptTetap == null && pt > min && total(n, pt) > tersedia + EPS) pt--;
    if (total(n, pt) <= tersedia + EPS || n <= 1) break;
    n--;
  }
  return { n, pt, tinggi: baris.slice(0, n).map((p) => tinggiBaris(p, pt)) };
}
