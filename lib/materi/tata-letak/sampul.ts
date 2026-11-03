// P1 Sampul, P15 Penutup, P16 Pembatas bagian: foto latar pudar + judul gradien di tengah.
import type { SlideJadi } from '../kotak';
import { lebarTeks, potongAgarMuat, ruang } from '../metrik';
import type { SlideNaskah } from '../naskah';
import { GRADIEN_JUDUL, pasAtauPotong, par, Slide, W } from './komponen';

type P1 = Extract<SlideNaskah, { pola: 'P1' }>;
type P15 = Extract<SlideNaskah, { pola: 'P15' }>;
type P16 = Extract<SlideNaskah, { pola: 'P16' }>;

const FOTO_OPASITAS = 31;
const LEBAR_JUDUL = 1120;

function latar(s: Slide) {
  s.gambar('foto-latar', 0, 0, 1440, 810, 'Latar meja kerja', FOTO_OPASITAS);
}

/** Pil gelap berisi teks putih; bila tidak muat satu baris, pil disusun bertumpuk. */
function pil(s: Slide, teks: string[], y: number): number {
  const isi = teks.map((t) => t.trim()).filter(Boolean).slice(0, 2);
  if (!isi.length) return y;
  const maksLebar = 1240;
  let pt = 30;
  const lebarPil = (t: string, p: number) => lebarTeks(t, p, true) + 64;
  const total = (p: number) => isi.reduce((a, t) => a + lebarPil(t, p), 0) + 24 * (isi.length - 1);
  while (pt > 22 && total(pt) > maksLebar) pt--;
  const baris = total(pt) > maksLebar ? isi.map((t) => [t]) : [isi];
  let yy = y;
  for (const row of baris) {
    const teksRow = row.map((t) => (lebarPil(t, pt) > maksLebar ? (s.lapor('dipotong', `Pil sampul dipotong: "${t}"`), potongAgarMuat(t, pt, maksLebar - 64, 1, true)) : t));
    const lebar = teksRow.map((t) => lebarPil(t, pt));
    let x = (1440 - (lebar.reduce((a, b) => a + b, 0) + 24 * (teksRow.length - 1))) / 2;
    teksRow.forEach((t, i) => {
      const miring = isi.indexOf(row[i]) === 1;
      s.bentuk({ nama: 'Pil', x, y: yy, w: lebar[i], h: 56, isi: W.slate, radius: 8 });
      s.teks({ nama: 'Teks pil', x: x + 8, y: yy, w: lebar[i] - 16, h: 56, paragraf: [{ runs: [{ t, b: true, i: miring }] }], pt, tebal: true, miring, warna: W.putih, rata: 'ctr', jangkar: 'ctr', jarak: 1.2 });
      x += lebar[i] + 24;
    });
    yy += 56 + 16;
  }
  return yy - 16;
}

function judulTengah(s: Slide, teks: string, maks: number, min: number, maksBaris: number) {
  const { teks: isi, hasil } = pasAtauPotong(s, teks, LEBAR_JUDUL, ruang(maksBaris, maks, 1.05), maks, min, { tebal: true, jarak: 1.05, maksBaris, label: 'Judul' });
  return { isi, pt: hasil.pt, tinggi: hasil.tinggi };
}

export function tataSampul(a: P1 | P16): SlideJadi[] {
  const s = new Slide(a, 0, a.judul);
  latar(s);
  const cover = a.pola === 'P1';
  const j = judulTengah(s, cover ? a.judul.toUpperCase() : a.judul, cover ? 92 : 80, cover ? 56 : 48, 3);
  const pilTeks = a.pola === 'P1' ? a.pil : a.subjudul ? [a.subjudul] : [];
  const nBarisPil = pilTeks.length ? 1 : 0;
  const tinggiGrup = j.tinggi + (nBarisPil ? 36 + 56 : 0);
  const atas = Math.max(60, (810 - tinggiGrup) / 2 - 10);
  s.teks({ nama: 'Judul sampul', x: (1440 - LEBAR_JUDUL) / 2, y: atas, w: LEBAR_JUDUL, h: j.tinggi + 6, paragraf: [par(j.isi, { b: true })], pt: j.pt, tebal: true, gradien: GRADIEN_JUDUL, rata: 'ctr', jangkar: 't', jarak: 1.05 });
  pil(s, pilTeks, atas + j.tinggi + 36);
  return [s.jadi()];
}

export function tataPenutup(a: P15): SlideJadi[] {
  const s = new Slide(a, 0, a.judul);
  latar(s);
  const j = judulTengah(s, (a.judul || 'Terima kasih').toUpperCase(), 96, 60, 2);
  s.teks({ nama: 'Judul penutup', x: (1440 - LEBAR_JUDUL) / 2, y: 330 - j.tinggi / 2, w: LEBAR_JUDUL, h: j.tinggi + 6, paragraf: [par(j.isi, { b: true })], pt: j.pt, tebal: true, gradien: GRADIEN_JUDUL, rata: 'ctr', jangkar: 't', jarak: 1.05 });
  return [s.jadi()];
}
