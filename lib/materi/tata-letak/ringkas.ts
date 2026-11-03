// P8 Rumus, P9 Angka besar, P14 Rangkuman.
import type { Paragraf, SlideJadi } from '../kotak';
import { pasUkuran, ruang } from '../metrik';
import type { Naskah, SlideNaskah } from '../naskah';
import { BATAS_BAWAH, GRADIEN_JUDUL, judulLanjutan, kepala, LEBAR_ISI, par, parBerlabel, pasAtauPotong, pembukaPendek, rencanaTumpukan, Slide, TEPI, W } from './komponen';

type P8 = Extract<SlideNaskah, { pola: 'P8' }>;
type P9 = Extract<SlideNaskah, { pola: 'P9' }>;
type P14 = Extract<SlideNaskah, { pola: 'P14' }>;

type BagianLampiran = 'ket' | 'contoh';
const KEPALA_CONTOH = 20 + ruang(1, 26) + 14;

const paragrafKet = (a: P8, teks = a.keterangan ?? ''): Paragraf[] => [{ runs: [{ t: 'Keterangan: ', b: true }, { t: teks }] }];
const paragrafContoh = (a: P8): Paragraf[] => {
  const c = (a.contoh ?? []).filter(Boolean);
  return c.map((t) => ({ ...parBerlabel(t), butir: c.length > 1 }));
};

/** Ukuran bagian lampiran pada lebar tertentu: tinggi kotak yang dibutuhkan bila muat dalam `maks`. */
function ukurBagian(a: P8, b: BagianLampiran, lebar: number, maks: number) {
  if (b === 'ket') {
    const p = pasUkuran(paragrafKet(a), lebar, maks, 22, 16);
    return { muat: p.muat, pt: p.pt, tinggi: p.tinggi };
  }
  const p = pasUkuran(paragrafContoh(a), lebar - 56, maks - KEPALA_CONTOH - 20, 22, 16, { antarPar: 0.3 });
  return { muat: p.muat, pt: p.pt, tinggi: KEPALA_CONTOH + p.tinggi + 20 };
}

function gambarBagian(s: Slide, a: P8, b: BagianLampiran, x: number, y: number, lebar: number, maks: number) {
  if (b === 'ket') {
    const u = ukurBagian(a, 'ket', lebar, maks);
    let paragraf = paragrafKet(a), pt = u.pt, tinggi = u.tinggi;
    if (!u.muat) {
      const p = pasAtauPotong(s, a.keterangan ?? '', lebar - 140, maks, 16, 16, { label: 'Keterangan rumus' });
      paragraf = paragrafKet(a, p.teks); pt = 16; tinggi = maks;
    }
    s.teks({ nama: 'Keterangan', x, y, w: lebar, h: Math.min(maks, tinggi + 2), paragraf, pt, warna: W.slate });
    return Math.min(maks, tinggi + 2);
  }
  const u = ukurBagian(a, 'contoh', lebar, maks);
  let paragraf = paragrafContoh(a), pt = u.pt;
  if (!u.muat) {
    const p = pasAtauPotong(s, (a.contoh ?? []).join(' '), lebar - 56, maks - KEPALA_CONTOH - 20, 16, 16, { label: 'Contoh rumus' });
    paragraf = [par(p.teks)]; pt = 16;
  }
  const h = Math.min(maks, u.muat ? u.tinggi : maks);
  s.bentuk({ nama: 'Kartu contoh', x, y, w: lebar, h, isi: W.teal, radius: 8 });
  s.teks({ nama: 'Judul kartu', x: x + 28, y: y + 20, w: lebar - 56, h: ruang(1, 26) + 2, paragraf: [par('Contoh', { b: true })], pt: 26, tebal: true, warna: W.putih });
  s.teks({ nama: 'Contoh', x: x + 28, y: y + KEPALA_CONTOH, w: lebar - 56, h: h - KEPALA_CONTOH - 20, paragraf, pt, warna: W.putih, antarPar: 0.3 });
  return h;
}

/**
 * Taruh keterangan dan contoh di bawah kartu rumus: berdampingan bila muat, lalu bertumpuk, lalu satu per slide.
 * Mengembalikan bagian yang belum tertaruh. Pada slide kosong, bagian pertama dipaksa (dipotong bila perlu).
 */
function lampiranRumus(s: Slide, a: P8, sisa: BagianLampiran[], y: number, kosong: boolean): BagianLampiran[] {
  const maks = BATAS_BAWAH - y;
  if (!sisa.length || maks < 80) return sisa;
  const separuh = (LEBAR_ISI - 34) / 2;
  if (sisa.length === 2 && sisa.every((b) => ukurBagian(a, b, separuh, maks).muat)) {
    gambarBagian(s, a, 'ket', TEPI, y, separuh, maks);
    gambarBagian(s, a, 'contoh', TEPI + separuh + 34, y, separuh, maks);
    return [];
  }
  const pertama = ukurBagian(a, sisa[0], LEBAR_ISI, maks);
  if (pertama.muat || kosong) {
    const h = gambarBagian(s, a, sisa[0], TEPI, y, LEBAR_ISI, maks);
    const lanjut = sisa.slice(1);
    if (lanjut.length && ukurBagian(a, lanjut[0], LEBAR_ISI, maks - h - 20).muat) {
      gambarBagian(s, a, lanjut[0], TEPI, y + h + 20, LEBAR_ISI, maks - h - 20);
      return [];
    }
    return lanjut;
  }
  return sisa;
}

export function tataRumus(a: P8, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  let sisa = a.rumus.filter(Boolean);
  let lampiran: BagianLampiran[] = [...(a.keterangan ? ['ket' as const] : []), ...((a.contoh ?? []).some(Boolean) ? ['contoh' as const] : [])];
  let ptTetap: number | undefined;
  for (let ke = 0; (sisa.length || lampiran.length) && ke < 10; ke++) {
    const lampiranSelesai = !lampiran.length;
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const yKepala = kepala(s, naskah, s.judul);
    let y = yKepala;
    if (sisa.length) {
      const baris: Paragraf[][] = sisa.map((t) => [{ ...parBerlabel(t), runs: parBerlabel(t).runs.map((r) => ({ ...r, b: true })) }]);
      // Bila sisa rumus muat di 60% ruang, sisakan 40% untuk keterangan/contoh di slide yang sama;
      // bila tidak, rumus memakai seluruh ruang dan lampiran menyusul.
      const penuh = BATAS_BAWAH - y - 40;
      const rencana = (t: number) => rencanaTumpukan(baris, LEBAR_ISI - 56, t, 28, 18, { jarak: 8, tinggiMin: 0, pad: 0, perSlide: 12, ptTetap });
      const r60 = lampiranSelesai ? null : rencana((BATAS_BAWAH - y) * 0.6 - 40);
      const r = r60 && r60.n === sisa.length ? r60 : rencana(penuh);
      const tersedia = r === r60 ? (BATAS_BAWAH - y) * 0.6 - 40 : penuh;
      let paragraf: Paragraf[] = baris.slice(0, r.n).flat();
      let pt = r.pt;
      let tinggi = r.tinggi.reduce((x, t) => x + t, 0) + 8 * (r.n - 1);
      if (tinggi > tersedia) {
        const p = pasAtauPotong(s, sisa[0], LEBAR_ISI - 56, tersedia, 18, 18, { tebal: true, label: 'Rumus' });
        paragraf = [par(p.teks, { b: true })]; pt = p.hasil.pt; tinggi = p.hasil.tinggi;
      }
      if (r.n < sisa.length) { s.lapor('dipecah', `${sisa.length - r.n} baris rumus dipindah ke slide lanjutan`); ptTetap = pt; }
      s.bentuk({ nama: 'Kartu rumus', x: TEPI, y, w: LEBAR_ISI, h: tinggi + 40, isi: W.slate, radius: 8 });
      s.teks({ nama: 'Rumus', x: TEPI + 28, y: y + 20, w: LEBAR_ISI - 56, h: tinggi + 2, paragraf, pt, tebal: true, warna: W.putih, antarPar: 8 / pt });
      y += tinggi + 40 + 24;
      sisa = sisa.slice(r.n);
    }
    if (!sisa.length && lampiran.length) {
      lampiran = lampiranRumus(s, a, lampiran, y, y === yKepala);
      if (lampiran.length) s.lapor('dipecah', 'Keterangan atau contoh rumus dipindah ke slide lanjutan');
    }
    hasil.push(s.jadi());
  }
  return hasil;
}

export function tataAngka(a: P9, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  const PER = 4, JARAK = 24;
  for (let i = 0, ke = 0; i < Math.max(1, a.angka.length); i += PER, ke++) {
    const angka = a.angka.slice(i, i + PER);
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    if (ke > 0) s.lapor('dipecah', `${a.angka.length} angka dibagi ke beberapa slide`);
    const y0 = ke === 0 ? pembukaPendek(s, a.pembuka, kepala(s, naskah, s.judul)) : kepala(s, naskah, s.judul);
    const n = angka.length;
    const w = (LEBAR_ISI - JARAK * (n - 1)) / Math.max(1, n);
    const h = Math.min(330, BATAS_BAWAH - y0);
    angka.forEach((k, j) => {
      const x = TEPI + j * (w + JARAK);
      s.bentuk({ nama: 'Kartu angka', x, y: y0, w, h, isi: W.kotakMuda, radius: 14 });
      const nilai = pasAtauPotong(s, k.nilai, w - 48, h * 0.55, 72, 28, { tebal: true, jarak: 1.1, maksBaris: 3, label: 'Judul angka' });
      s.teks({ nama: 'Nilai', x: x + 24, y: y0 + 24, w: w - 48, h: h * 0.55, paragraf: [par(nilai.teks, { b: true })], pt: nilai.hasil.pt, tebal: true, gradien: GRADIEN_JUDUL, rata: 'ctr', jangkar: 'b', jarak: 1.1 });
      const label = pasAtauPotong(s, k.label, w - 48, h * 0.45 - 48, 22, 16, { label: 'Label angka' });
      s.teks({ nama: 'Label angka', x: x + 24, y: y0 + 24 + h * 0.55 + 12, w: w - 48, h: h * 0.45 - 48, paragraf: [par(label.teks)], pt: label.hasil.pt, warna: W.slate, rata: 'ctr' });
    });
    hasil.push(s.jadi());
  }
  return hasil;
}

export function tataRangkuman(a: P14, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  const lebarTeks = LEBAR_ISI - 96 - 24;
  let sisa = a.poin.slice(), nomor = 1;
  let ptTetap: number | undefined;
  for (let ke = 0; (sisa.length || ke === 0) && ke < 20; ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const y0 = kepala(s, naskah, s.judul);
    const baris = sisa.map((p) => [par(p.judul, { b: true }), par(p.isi)]);
    const r = rencanaTumpukan(baris, lebarTeks, BATAS_BAWAH - y0, 22, 16, { jarak: 12, tinggiMin: 64, pad: 12, perSlide: 6, ptTetap });
    if (r.n < sisa.length) { s.lapor('dipecah', `${sisa.length - r.n} poin rangkuman dipindah ke slide lanjutan`); ptTetap = r.pt; }
    let y = y0;
    sisa.slice(0, r.n).forEach((p, i) => {
      let h = r.tinggi[i];
      let isi = p.isi;
      if (y + h > BATAS_BAWAH) { h = BATAS_BAWAH - y; isi = pasAtauPotong(s, p.isi, lebarTeks, h - 24 - ruang(1, r.pt), r.pt, r.pt, { label: 'Rangkuman' }).teks; }
      s.bentuk({ nama: 'Baris rangkuman', x: TEPI, y, w: LEBAR_ISI, h, isi: W.barisMuda, radius: 8 });
      s.bentuk({ nama: 'Nomor', x: TEPI + 22, y: y + h / 2 - 24, w: 48, h: 48, isi: W.teal, radius: 24 });
      s.teks({ nama: 'Angka', x: TEPI + 22, y: y + h / 2 - 24, w: 48, h: 48, paragraf: [par(String(nomor++), { b: true })], pt: 22, tebal: true, warna: W.putih, rata: 'ctr', jangkar: 'ctr' });
      s.teks({ nama: 'Poin', x: TEPI + 96, y: y + 12, w: lebarTeks, h: h - 24, paragraf: [{ runs: [{ t: p.judul, b: true, warna: W.teal }] }, par(isi)], pt: r.pt, jangkar: 'ctr', antarPar: 0.2 });
      y += h + 12;
    });
    sisa = sisa.slice(r.n);
    hasil.push(s.jadi());
  }
  return hasil;
}
