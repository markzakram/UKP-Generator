// P11 Kuis cepat (pernyataan lalu jawaban), P12 Contoh soal, P13 Pembahasan.
import type { Paragraf, SlideJadi } from '../kotak';
import { kalimat, pasUkuran, ruang } from '../metrik';
import type { HurufOpsi, Naskah, SlideNaskah } from '../naskah';
import { BATAS_BAWAH, judulLanjutan, kepala, LEBAR_ISI, par, parBerlabel, pasAtauPotong, pembukaPendek, rencanaTumpukan, Slide, TEPI, W } from './komponen';

type P11 = Extract<SlideNaskah, { pola: 'P11' }>;
type P12 = Extract<SlideNaskah, { pola: 'P12' }>;
type P13 = Extract<SlideNaskah, { pola: 'P13' }>;

const HURUF: HurufOpsi[] = ['A', 'B', 'C', 'D'];

/** Baris bernomor di kotak muda; dipakai kuis dan langkah pembahasan. */
function barisBernomor(s: Slide, y: number, h: number, nomor: number, paragraf: Paragraf[], pt: number, lebarTeks: number, warnaNomor: string, label?: { teks: string; warna: string }) {
  s.bentuk({ nama: 'Baris', x: TEPI, y, w: LEBAR_ISI, h, isi: W.barisMuda, radius: 8 });
  s.bentuk({ nama: 'Nomor', x: TEPI + 20, y: y + h / 2 - 23, w: 46, h: 46, isi: warnaNomor, radius: 23 });
  s.teks({ nama: 'Angka', x: TEPI + 20, y: y + h / 2 - 23, w: 46, h: 46, paragraf: [par(String(nomor), { b: true })], pt: 21, tebal: true, warna: W.putih, rata: 'ctr', jangkar: 'ctr' });
  let x = TEPI + 86;
  if (label) {
    s.bentuk({ nama: 'Label jawaban', x, y: y + h / 2 - 22, w: 118, h: 44, isi: label.warna, radius: 22 });
    s.teks({ nama: 'Label jawaban', x, y: y + h / 2 - 22, w: 118, h: 44, paragraf: [par(label.teks, { b: true })], pt: 20, tebal: true, warna: W.putih, rata: 'ctr', jangkar: 'ctr' });
    x += 118 + 18;
  }
  s.teks({ nama: 'Teks baris', x, y: y + 12, w: lebarTeks, h: h - 24, paragraf, pt, jangkar: 'ctr', antarPar: 0.25 });
}

export function tataKuis(a: P11, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  const tahap: { jawaban: boolean }[] = [{ jawaban: false }, { jawaban: true }];
  let ke = 0;
  for (const { jawaban } of tahap) {
    const lebarTeks = LEBAR_ISI - 86 - 24 - (jawaban ? 136 : 0);
    let sisa = a.butir.map((b, i) => ({ ...b, no: i + 1 }));
    let ptTetap: number | undefined;
    let pertama = true;
    while (sisa.length && ke < 20) {
      const judul = jawaban ? `${a.judul}: jawaban` : judulLanjutan(a.judul, pertama ? 0 : 1);
      const s = new Slide(a, ke, judul);
      const yKepala = kepala(s, naskah, judul);
      const y0 = !jawaban && pertama ? pembukaPendek(s, 'Tentukan apakah setiap pernyataan Benar atau Salah.', yKepala, 26, 20, 1) : yKepala;
      const baris = sisa.map((b) => (jawaban && b.jelas ? [par(b.teks), { runs: [{ t: b.jelas, i: true, warna: W.slate }] }] : [par(b.teks)]));
      const r = rencanaTumpukan(baris, lebarTeks, BATAS_BAWAH - y0, 22, 16, { jarak: 12, tinggiMin: 70, pad: 12, perSlide: 5, ptTetap });
      if (r.n < sisa.length) { s.lapor('dipecah', `${sisa.length - r.n} butir kuis dipindah ke slide berikutnya`); ptTetap = r.pt; }
      let y = y0;
      sisa.slice(0, r.n).forEach((b, i) => {
        let h = r.tinggi[i];
        let paragraf = baris[i];
        if (y + h > BATAS_BAWAH) { h = BATAS_BAWAH - y; paragraf = [par(pasAtauPotong(s, b.teks, lebarTeks, h - 24, r.pt, r.pt, { label: 'Butir kuis' }).teks)]; }
        barisBernomor(s, y, h, b.no, paragraf, r.pt, lebarTeks, W.teal, jawaban ? { teks: b.jawab ? 'Benar' : 'Salah', warna: b.jawab ? W.teal : W.slate } : undefined);
        y += h + 12;
      });
      sisa = sisa.slice(r.n);
      hasil.push(s.jadi());
      ke++; pertama = false;
    }
  }
  return hasil;
}

/** Kotak kasus muda berisi paragraf; kalimat yang tidak muat dikembalikan. */
function kotakKasus(s: Slide, paragrafKasus: string[], soal: string | null, y: number, tinggi: number): { sisa: string[]; pt: number } {
  const lebar = LEBAR_ISI - 56;
  const susun = (k: string[]) => [...(k.length ? [par(k.join(' '))] : []), ...(soal ? [par(soal, { b: true })] : [])];
  let n = paragrafKasus.length;
  let pas = pasUkuran(susun(paragrafKasus), lebar, tinggi - 32, 26, 18);
  while (!pas.muat && n > 0) { n--; pas = pasUkuran(susun(paragrafKasus.slice(0, n)), lebar, tinggi - 32, 26, 18); }
  if (!pas.muat) return { sisa: paragrafKasus, pt: 0 };
  const h = pas.tinggi + 32;
  s.bentuk({ nama: 'Kotak kasus', x: TEPI, y, w: LEBAR_ISI, h, isi: W.kotakMuda, radius: 10 });
  s.teks({ nama: 'Kasus', x: TEPI + 28, y: y + 16, w: lebar, h: h - 32, paragraf: susun(paragrafKasus.slice(0, n)), pt: pas.pt });
  return { sisa: paragrafKasus.slice(n), pt: pas.pt };
}

/** Empat kartu opsi 2 x 2. Mengembalikan tinggi blok, atau null bila tidak muat. */
function rencanaOpsi(opsi: Record<HurufOpsi, string>, tersedia: number) {
  const w = (LEBAR_ISI - 20) / 2, lebarTeks = w - 88 - 20;
  for (let pt = 22; pt >= 16; pt--) {
    const tinggi = Math.max(96, ...HURUF.map((h) => pasUkuran([par(opsi[h])], lebarTeks, 400, pt, pt).tinggi + 28));
    if (2 * tinggi + 16 <= tersedia) return { pt, tinggi, w, lebarTeks };
  }
  return null;
}

export function tataContohSoal(a: P12, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  let sisaKasus = a.kasus ? kalimat(a.kasus) : [];
  for (let ke = 0; ke < 10; ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const y0 = kepala(s, naskah, s.judul);
    const tersedia = BATAS_BAWAH - y0;
    // Coba: sisa kasus + soal + opsi dalam satu slide.
    const opsiPenuh = rencanaOpsi(a.opsi, tersedia - 120);
    if (opsiPenuh) {
      const ruangKasus = tersedia - (2 * opsiPenuh.tinggi + 16) - 20;
      const coba = pasUkuran([...(sisaKasus.length ? [par(sisaKasus.join(' '))] : []), par(a.soal, { b: true })], LEBAR_ISI - 56, ruangKasus - 32, 26, 18);
      if (coba.muat) {
        const k = kotakKasus(s, sisaKasus, a.soal, y0, ruangKasus);
        const yOpsi = y0 + coba.tinggi + 32 + 20;
        const pt = Math.min(opsiPenuh.pt, k.pt || opsiPenuh.pt);
        HURUF.forEach((h, i) => {
          const x = TEPI + (i % 2) * (opsiPenuh.w + 20), y = yOpsi + Math.floor(i / 2) * (opsiPenuh.tinggi + 16);
          s.bentuk({ nama: 'Kartu opsi', x, y, w: opsiPenuh.w, h: opsiPenuh.tinggi, isi: W.slate, radius: 8 });
          s.bentuk({ nama: 'Huruf', x: x + 18, y: y + opsiPenuh.tinggi / 2 - 25, w: 50, h: 50, isi: W.putih, radius: 25 });
          s.teks({ nama: 'Huruf opsi', x: x + 18, y: y + opsiPenuh.tinggi / 2 - 25, w: 50, h: 50, paragraf: [par(h, { b: true })], pt: 24, tebal: true, warna: W.slate, rata: 'ctr', jangkar: 'ctr' });
          s.teks({ nama: 'Opsi', x: x + 88, y: y + 14, w: opsiPenuh.lebarTeks, h: opsiPenuh.tinggi - 28, paragraf: [par(a.opsi[h])], pt: Math.min(pt, opsiPenuh.pt), warna: W.putih, jangkar: 'ctr' });
        });
        hasil.push(s.jadi());
        return hasil;
      }
    }
    // Kasus terlalu panjang: slide ini berisi kasus saja, soal dan opsi di slide lanjutan.
    if (!sisaKasus.length) {
      // tanpa kasus pun tidak muat: opsi sangat panjang, dipotong agar muat
      const p = pasAtauPotong(s, a.soal, LEBAR_ISI - 56, 120, 18, 18, { tebal: true, label: 'Soal' });
      s.teks({ nama: 'Kasus', x: TEPI + 28, y: y0, w: LEBAR_ISI - 56, h: 120, paragraf: [par(p.teks, { b: true })], pt: 18 });
      hasil.push(s.jadi());
      return hasil;
    }
    const k = kotakKasus(s, sisaKasus, null, y0, tersedia);
    if (k.sisa.length === sisaKasus.length) {
      const p = pasAtauPotong(s, sisaKasus[0], LEBAR_ISI - 56, tersedia - 32, 18, 18, { label: 'Kasus' });
      kotakKasus(s, [p.teks], null, y0, tersedia);
      sisaKasus = sisaKasus.slice(1);
    } else sisaKasus = k.sisa;
    s.lapor('dipecah', 'Kasus panjang; soal dan opsi dipindah ke slide lanjutan');
    hasil.push(s.jadi());
  }
  return hasil;
}

export function tataPembahasan(a: P13, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  let sisaLangkah = a.langkah.filter(Boolean);
  let ptTetap: number | undefined;
  for (let ke = 0; ke < 10; ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    let y = kepala(s, naskah, s.judul);
    let batas = BATAS_BAWAH;
    if (ke === 0) {
      const kunci = pasAtauPotong(s, `Jawaban ${a.kunci}: ${a.teksKunci}`, LEBAR_ISI - 56, ruang(3, 26), 26, 18, { tebal: true, maksBaris: 3, label: 'Judul kunci' });
      const hk = kunci.hasil.tinggi + 32;
      s.bentuk({ nama: 'Kartu kunci', x: TEPI, y, w: LEBAR_ISI, h: hk, isi: W.teal, radius: 8 });
      s.teks({ nama: 'Kunci', x: TEPI + 28, y: y + 16, w: LEBAR_ISI - 56, h: hk - 32, paragraf: [par(kunci.teks, { b: true })], pt: kunci.hasil.pt, tebal: true, warna: W.putih, jangkar: 'ctr' });
      y += hk + 18;
      if (a.dasar) {
        const d = pasAtauPotong(s, a.dasar, LEBAR_ISI - 150, ruang(3, 20), 20, 15, { maksBaris: 3, label: 'Dasar hukum' });
        const hd = Math.max(40, d.hasil.tinggi);
        s.teks({ nama: 'Dasar', x: TEPI, y: BATAS_BAWAH - hd, w: LEBAR_ISI, h: hd, paragraf: [{ runs: [{ t: 'Dasar hukum: ', b: true }, { t: d.teks }] }], pt: d.hasil.pt, warna: W.slate, jangkar: 'ctr' });
        batas = BATAS_BAWAH - hd - 14;
      }
      if (a.inti) {
        const pas = pasUkuran([parBerlabel(a.inti)], LEBAR_ISI, Math.max(60, (batas - y) * (sisaLangkah.length ? 0.45 : 1)), 24, 18);
        const inti = pas.muat ? { teks: a.inti, hasil: pas } : pasAtauPotong(s, a.inti, LEBAR_ISI, Math.max(60, (batas - y) * 0.45), 18, 18, { label: 'Inti pembahasan' });
        s.teks({ nama: 'Inti', x: TEPI, y, w: LEBAR_ISI, h: inti.hasil.tinggi + 2, paragraf: [parBerlabel(inti.teks)], pt: inti.hasil.pt });
        y += inti.hasil.tinggi + 2 + 16;
      }
    }
    if (sisaLangkah.length) {
      const lebarTeks = LEBAR_ISI - 86 - 24;
      const baris = sisaLangkah.map((t) => [parBerlabel(t)]);
      const r = rencanaTumpukan(baris, lebarTeks, batas - y, 20, 16, { jarak: 10, tinggiMin: 60, pad: 12, perSlide: 6, ptTetap });
      const muatSatu = r.tinggi[0] <= batas - y;
      if (muatSatu) {
        if (r.n < sisaLangkah.length) { s.lapor('dipecah', `${sisaLangkah.length - r.n} langkah pembahasan dipindah ke slide lanjutan`); ptTetap = r.pt; }
        const awal = a.langkah.length - sisaLangkah.length;
        sisaLangkah.slice(0, r.n).forEach((t, i) => {
          barisBernomor(s, y, r.tinggi[i], awal + i + 1, baris[i], r.pt, lebarTeks, W.teal);
          y += r.tinggi[i] + 10;
        });
        sisaLangkah = sisaLangkah.slice(r.n);
      } else s.lapor('dipecah', 'Langkah pembahasan dipindah ke slide lanjutan');
    }
    hasil.push(s.jadi());
    if (!sisaLangkah.length) break;
  }
  return hasil;
}
