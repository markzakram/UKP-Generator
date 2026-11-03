// P7 Langkah: kotak teal bernomor (2–6 per slide); langkah berlebih dipindah ke slide lanjutan, nomor berlanjut.
import type { SlideJadi } from '../kotak';
import { EPS, tinggiTeks } from '../metrik';
import type { Naskah, SlideNaskah } from '../naskah';
import { BATAS_BAWAH, judulLanjutan, kepala, LEBAR_ISI, par, parBerlabel, pasAtauPotong, pembukaPendek, Slide, TEPI, W } from './komponen';

type P7 = Extract<SlideNaskah, { pola: 'P7' }>;
const MAKS = 24, MIN = 18, JARAK = 16, PER_SLIDE = 6;

export function tataLangkah(a: P7, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  const gambar = a.gambar ?? 'bertanya';
  const lebar = gambar === 'tanpa' ? LEBAR_ISI : 1020;
  const lebarTeks = lebar - 88 - 22;
  let sisa = a.langkah.slice(), nomor = 1;
  for (let ke = 0; (sisa.length || ke === 0) && ke < 20; ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const yKepala = kepala(s, naskah, s.judul);
    const y0 = ke === 0 ? pembukaPendek(s, a.pembuka, yKepala) : yKepala;
    const avail = BATAS_BAWAH - y0;
    const tinggi = (t: string, pt: number) => Math.max(72, tinggiTeks([parBerlabel(t)], pt, lebarTeks).tinggi + 24);
    const total = (k: number, pt: number) => sisa.slice(0, k).reduce((x, t) => x + tinggi(t, pt), 0) + JARAK * (k - 1);
    let n = Math.min(PER_SLIDE, sisa.length), pt = MAKS;
    for (;;) {
      pt = MAKS;
      while (pt > MIN && total(n, pt) > avail + EPS) pt--;
      if (total(n, pt) <= avail + EPS || n === 1) break;
      n--;
    }
    if (n < sisa.length) s.lapor('dipecah', `${sisa.length - n} langkah dipindah ke slide lanjutan`);
    else if (pt < MAKS) s.lapor('diperkecil', `Langkah ${pt} pt (maks ${MAKS})`);
    if (gambar === 'bertanya') s.gambar('ilustrasi-bertanya', 1110, Math.max(y0 + 30, 300), 240, 240, 'Ilustrasi orang bertanya');
    if (gambar === 'dokumen') s.gambar('ilustrasi-dokumen', 1100, Math.max(y0 + 30, 300), 260, 260, 'Ilustrasi dokumen dan jam');
    let y = y0;
    sisa.slice(0, n).forEach((t) => {
      let h = tinggi(t, pt);
      let isi = t;
      if (y + h > BATAS_BAWAH) {
        h = BATAS_BAWAH - y;
        isi = pasAtauPotong(s, t, lebarTeks, h - 24, pt, pt, { label: 'Langkah' }).teks;
      }
      s.bentuk({ nama: 'Langkah', x: TEPI, y, w: lebar, h, isi: W.teal, radius: 6 });
      s.bentuk({ nama: 'Nomor', x: TEPI + 18, y: y + h / 2 - 25, w: 50, h: 50, isi: W.putih, radius: 25 });
      s.teks({ nama: 'Angka', x: TEPI + 18, y: y + h / 2 - 25, w: 50, h: 50, paragraf: [par(String(nomor), { b: true })], pt: 24, tebal: true, warna: W.teal, rata: 'ctr', jangkar: 'ctr' });
      s.teks({ nama: 'Teks langkah', x: TEPI + 88, y: y + 12, w: lebarTeks, h: h - 24, paragraf: [parBerlabel(isi)], pt, warna: W.putih, jangkar: 'ctr' });
      y += h + JARAK;
      nomor++;
    });
    sisa = sisa.slice(n);
    hasil.push(s.jadi());
  }
  return hasil;
}
