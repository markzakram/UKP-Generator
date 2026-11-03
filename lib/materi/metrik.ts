// Pengukur teks Poppins dari tabel lebar huruf hasil ukur PowerPoint (assets/materi/metrik-poppins.json).
// Tidak bergantung pada browser atau Node, sehingga pratinjau, CLI, dan .pptx memakai hitungan yang sama.
import METRIK from '../../assets/materi/metrik-poppins.json';
import type { Paragraf } from './kotak';

const TABEL = METRIK as unknown as { tinggiBaris: number; cadangan: number; regular: Record<string, number>; bold: Record<string, number> };
/** Cadangan aman di atas lebar terukur (pembulatan PowerPoint, kerning). */
export const CADANGAN_LEBAR = 0.03;
/** Tinggi satu baris Poppins pada spasi tunggal, kelipatan ukuran huruf (1,2). */
export const TINGGI_BARIS = TABEL.tinggiBaris;

export function lebarHuruf(ch: string, tebal: boolean): number {
  const kode = String(ch.codePointAt(0));
  return (tebal ? TABEL.bold : TABEL.regular)[kode] ?? TABEL.cadangan;
}

/** Lebar teks satu baris dalam pt. */
export function lebarTeks(teks: string, pt: number, tebal = false): number {
  let w = 0;
  for (const ch of teks) w += lebarHuruf(ch, tebal);
  return w * pt * (1 + CADANGAN_LEBAR);
}

interface Huruf { c: string; b: boolean }

function hurufParagraf(p: Paragraf, tebalDasar: boolean): Huruf[] {
  const out: Huruf[] = [];
  for (const r of p.runs) for (const c of r.t) out.push({ c, b: r.b ?? tebalDasar });
  return out;
}

/**
 * Bungkus satu paragraf menjadi baris (pemutusan di spasi, seperti PowerPoint).
 * Kata yang lebih panjang dari lebar kotak diputus per huruf.
 * Mengembalikan teks setiap baris (tanpa gaya) untuk diukur dan diuji.
 */
export function bungkusParagraf(p: Paragraf, pt: number, lebar: number, tebalDasar = false): string[] {
  const huruf = hurufParagraf(p, tebalDasar);
  const skala = pt * (1 + CADANGAN_LEBAR);
  const baris: string[] = [];
  let isi = '', w = 0;
  const dorong = () => { baris.push(isi); isi = ''; w = 0; };
  let i = 0;
  while (i < huruf.length) {
    const h = huruf[i];
    if (h.c === '\n') { dorong(); i++; continue; }
    if (h.c === ' ') { i++; continue; }
    // Satu potongan = kata sampai spasi, atau sampai tanda hubung yang diikuti huruf: PowerPoint memutus
    // baris setelah "-" ("anti-|pemecahan"), tetapi tidak setelah "/" (diuji lewat COM, 3 Nov 2026).
    let j = i, kata = '', wk = 0;
    while (j < huruf.length && huruf[j].c !== ' ' && huruf[j].c !== '\n') {
      kata += huruf[j].c; wk += lebarHuruf(huruf[j].c, huruf[j].b) * skala; j++;
      if (huruf[j - 1].c === '-' && kata.length > 1 && j < huruf.length && /\p{L}/u.test(huruf[j].c)) break;
    }
    const adaSpasi = i > 0 && huruf[i - 1].c === ' ';
    const spasi = adaSpasi ? lebarHuruf(' ', huruf[i - 1].b) * skala : 0;
    if (isi !== '' && w + spasi + wk <= lebar) { isi += (adaSpasi ? ' ' : '') + kata; w += spasi + wk; }
    else if (wk <= lebar) { if (isi !== '') dorong(); isi = kata; w = wk; }
    else {
      // kata lebih panjang dari kotak: putus per huruf
      if (isi !== '') dorong();
      for (let k = i; k < j; k++) {
        const wc = lebarHuruf(huruf[k].c, huruf[k].b) * skala;
        if (isi !== '' && w + wc > lebar) dorong();
        isi += huruf[k].c; w += wc;
      }
    }
    i = j;
  }
  if (isi !== '' || baris.length === 0) dorong();
  return baris;
}

export interface OpsiUkur {
  tebal?: boolean;
  /** Tinggi baris, kelipatan pt. */
  jarak?: number;
  /** Jarak antarparagraf, kelipatan pt. */
  antarPar?: number;
}

/** Cadangan tinggi di bawah baris terakhir (kelipatan pt). */
export const CADANGAN_TINGGI = 0.15;

/** Tinggi ruang untuk n baris pada ukuran dan jarak tertentu, termasuk cadangan baris terakhir. */
export const ruang = (baris: number, pt: number, jarak = 1.2) => baris * pt * jarak + pt * CADANGAN_TINGGI;

/** Lekuk butir: lebar teks berkurang sebesar ini (kelipatan pt). */
export const LEKUK_BUTIR = 1.1;

export function tinggiTeks(paragraf: Paragraf[], pt: number, lebar: number, opsi: OpsiUkur = {}): { tinggi: number; baris: number } {
  const jarak = opsi.jarak ?? 1.2, antar = opsi.antarPar ?? 0.35;
  let tinggi = 0, baris = 0;
  paragraf.forEach((p, i) => {
    const w = p.butir ? lebar - LEKUK_BUTIR * pt : lebar;
    const n = bungkusParagraf(p, pt, w, opsi.tebal).length;
    baris += n;
    tinggi += n * pt * jarak + (i ? pt * antar : 0);
  });
  // PowerPoint menambah sedikit ruang huruf turunan di baris terakhir (terukur ±1,5 pt pada 18 pt).
  if (baris) tinggi += pt * CADANGAN_TINGGI;
  return { tinggi, baris };
}

/** Toleransi pembanding tinggi (galat pecahan desimal). */
export const EPS = 0.01;

export interface HasilPas { pt: number; muat: boolean; tinggi: number; baris: number }

/** Ukuran huruf terbesar (langkah 1 pt) dari maks ke min yang membuat teks muat di w x h. */
export function pasUkuran(paragraf: Paragraf[], lebar: number, tinggi: number, maks: number, min: number, opsi: OpsiUkur = {}, maksBaris?: number): HasilPas {
  let akhir: HasilPas | null = null;
  for (let pt = maks; pt >= min; pt -= 1) {
    const u = tinggiTeks(paragraf, pt, lebar, opsi);
    akhir = { pt, muat: u.tinggi <= tinggi + EPS && (maksBaris == null || u.baris <= maksBaris), tinggi: u.tinggi, baris: u.baris };
    if (akhir.muat) return akhir;
  }
  return akhir ?? { pt: min, muat: false, tinggi: Infinity, baris: 0 };
}

/** Teks polos menjadi paragraf: setiap baris baru = paragraf baru. */
export function paragrafDari(teks: string, opsi: { butir?: boolean; tebal?: boolean } = {}): Paragraf[] {
  return String(teks).split('\n').map((t) => t.trim()).filter(Boolean).map((t) => ({ runs: [{ t, b: opsi.tebal }], butir: opsi.butir }));
}

/** Potong teks agar muat dalam maksBaris di lebar tertentu; menambahkan "…". */
export function potongAgarMuat(teks: string, pt: number, lebar: number, maksBaris: number, tebal = false): string {
  const p = (t: string): Paragraf => ({ runs: [{ t, b: tebal }] });
  if (bungkusParagraf(p(teks), pt, lebar, tebal).length <= maksBaris) return teks;
  const kata = teks.split(' ');
  let lo = 0, hi = kata.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const coba = kata.slice(0, mid).join(' ').replace(/[,;:.\s]+$/, '') + '…';
    if (bungkusParagraf(p(coba), pt, lebar, tebal).length <= maksBaris) lo = mid; else hi = mid - 1;
  }
  return kata.slice(0, Math.max(1, lo)).join(' ').replace(/[,;:.\s]+$/, '') + '…';
}

/** Pecah teks per kalimat (titik/tanda tanya/seru diikuti spasi dan huruf kapital atau angka). */
export function kalimat(teks: string): string[] {
  return teks.split(/(?<=[.?!])\s+(?=[A-Z0-9("“])/).map((s) => s.trim()).filter(Boolean);
}
