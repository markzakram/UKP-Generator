// P6 Tabel: kepala slate, baris berselang; baris berlebih dipindah ke slide lanjutan dengan kepala diulang.
// `rapat` (daftar isi deck gabungan): baris minimal 40 pt dan bantalan 8 pt agar 8 baris muat satu slide.
import type { SlideJadi } from '../kotak';
import { EPS, ruang, tinggiTeks } from '../metrik';
import type { Naskah, SlideNaskah } from '../naskah';
import { BATAS_BAWAH, judulLanjutan, kepala, par, pasAtauPotong, pembukaPendek, Slide, W } from './komponen';

type P6 = Extract<SlideNaskah, { pola: 'P6' }>;

const X0 = 65, LEBAR = 1310, PAD = 12, MAKS = 24, MIN = 16, PT_PECAH = 18;

function lebarKolom(a: P6): number[] {
  const n = a.kolom.length;
  if (a.lebar && a.lebar.length === n) {
    const total = a.lebar.reduce((x, y) => x + y, 0);
    return a.lebar.map((f) => (LEBAR * f) / total);
  }
  const bobot = a.kolom.map((k, j) => Math.sqrt(Math.max(k.length, ...a.baris.map((b) => (b[j] ?? '').length), 4)));
  const total = bobot.reduce((x, y) => x + y, 0);
  const min = LEBAR * 0.14;
  const awal = bobot.map((b) => Math.max(min, (LEBAR * b) / total));
  const skala = LEBAR / awal.reduce((x, y) => x + y, 0);
  return awal.map((w) => w * skala);
}

const tinggiBaris = (baris: string[], lebar: number[], pt: number, rapat?: boolean) => {
  const pad = rapat ? 8 : PAD;
  return Math.max(rapat ? 40 : 54, ...baris.map((t, j) => tinggiTeks([par(t ?? '', { b: j === 0 })], pt, lebar[j] - 2 * pad, { tebal: j === 0 }).tinggi + 2 * pad));
};

export function tataTabel(a: P6, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  const lebar = lebarKolom(a);
  const pad = a.rapat ? 8 : PAD;
  const tinggi = (b: string[], pt: number) => tinggiBaris(b, lebar, pt, a.rapat);
  let sisa = a.baris.slice();
  // Setelah tabel dipecah, semua slide lanjutan memakai ukuran yang sama.
  let ptTetap: number | null = null;
  for (let ke = 0; (sisa.length || ke === 0) && ke < 20; ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const yKepala = kepala(s, naskah, s.judul);
    const y0 = ke === 0 ? pembukaPendek(s, a.pembuka, yKepala, 26, 20, 2) : yKepala;
    // Kepala tabel
    const kepalaTeks = a.kolom.map((k, j) => pasAtauPotong(s, k, lebar[j] - 2 * PAD - 8, ruang(2, 26, 1.15), 26, 18, { tebal: true, jarak: 1.15, maksBaris: 2, label: 'Kepala kolom' }));
    const hKepala = Math.max(60, ...kepalaTeks.map((k) => k.hasil.tinggi + 20));
    const avail = BATAS_BAWAH - (y0 + hKepala);
    // Ukuran seragam: terbesar yang memuat semua baris; bila tidak ada, pecah pada PT_PECAH.
    let pt: number = ptTetap ?? MAKS, n = sisa.length;
    while (ptTetap == null && pt > MIN && sisa.reduce((t, b) => t + tinggi(b, pt), 0) > avail + EPS) pt--;
    if (sisa.reduce((t, b) => t + tinggi(b, pt), 0) > avail + EPS) {
      pt = ptTetap ?? Math.max(MIN, PT_PECAH);
      ptTetap = pt;
      let total = 0; n = 0;
      while (n < sisa.length && total + tinggi(sisa[n], pt) <= avail + EPS) { total += tinggi(sisa[n], pt); n++; }
      n = Math.max(1, n);
      s.lapor('dipecah', `${sisa.length - n} baris tabel dipindah ke slide lanjutan`);
    } else if (pt < MAKS) s.lapor('diperkecil', `Isi tabel ${pt} pt (maks ${MAKS})`);
    let x = X0;
    s.bentuk({ nama: 'Kepala tabel', x: X0, y: y0, w: LEBAR, h: hKepala, isi: W.slate, radius: 0 });
    kepalaTeks.forEach((k, j) => {
      s.teks({ nama: 'Kepala kolom', x: x + PAD + 4, y: y0, w: lebar[j] - 2 * PAD - 8, h: hKepala, paragraf: [par(k.teks, { b: true })], pt: k.hasil.pt, tebal: true, warna: W.putih, jangkar: 'ctr', jarak: 1.15 });
      x += lebar[j];
    });
    let y = y0 + hKepala;
    sisa.slice(0, n).forEach((b, i) => {
      let h = tinggi(b, pt);
      if (y + h > BATAS_BAWAH) h = BATAS_BAWAH - y;
      s.bentuk({ nama: 'Baris', x: X0, y, w: LEBAR, h, isi: i % 2 ? W.barisMuda : W.putih, radius: 0, garis: { warna: W.garisTabel, tebal: 0.75 } });
      x = X0;
      b.forEach((t, j) => {
        const sel = pasAtauPotong(s, t ?? '', lebar[j] - 2 * pad, h - 2 * pad, pt, pt, { tebal: j === 0, label: 'Sel tabel' });
        s.teks({ nama: 'Sel', x: x + pad, y: y + pad, w: lebar[j] - 2 * pad, h: h - 2 * pad, paragraf: [par(sel.teks, { b: j === 0 })], pt, tebal: j === 0, warna: j === 0 ? W.teal : W.hitam, jangkar: 'ctr' });
        if (j < b.length - 1) s.garis(x + lebar[j], y, x + lebar[j], y + h, W.garisTabel, 0.75);
        x += lebar[j];
      });
      y += h;
    });
    sisa = sisa.slice(n);
    hasil.push(s.jadi());
  }
  return hasil;
}
