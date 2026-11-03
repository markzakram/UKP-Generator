// P2 Ikhtisar: judul gradien besar, subjudul miring, 3–6 kartu per slide.
// Jumlah kartu per slide dikurangi (kartu makin lebar) bila deskripsi tidak muat; sisanya ke slide berikutnya.
import type { Aset, SlideJadi } from '../kotak';
import { pasUkuran, ruang } from '../metrik';
import type { Ikon, Naskah, SlideNaskah } from '../naskah';
import { GRADIEN_JUDUL, navBar, pasAtauPotong, par, Slide, W } from './komponen';

type P2 = Extract<SlideNaskah, { pola: 'P2' }>;
const MAKS_PER_SLIDE = 6, MIN_PER_SLIDE = 3, JARAK = 18;

const lebarKartu = (n: number) => Math.min(n <= 4 ? 320 : 260, (1340 - JARAK * (n - 1)) / Math.max(1, n));

export function tataIkhtisar(a: P2, naskah: Naskah): SlideJadi[] {
  // Ukuran judul tidak bergantung pada kartu: hitung sekali untuk menentukan posisi kartu.
  const uji = new Slide(a, 0, a.judul);
  // Utamakan satu baris (100→64 pt); bila tidak muat, dua baris (100→48 pt).
  const satuBaris = pasUkuran([par(a.judul, { b: true })], 1200, ruang(1, 100, 1.1), 100, 64, { tebal: true, jarak: 1.1 }, 1);
  const judul = satuBaris.muat
    ? { teks: a.judul, hasil: satuBaris }
    : pasAtauPotong(uji, a.judul, 1200, ruang(2, 100, 1.1), 100, 48, { tebal: true, jarak: 1.1, maksBaris: 2, label: 'Judul ikhtisar' });
  const tinggiJudul = judul.hasil.tinggi;
  const yJudul = Math.max(40, 200 - tinggiJudul);
  const sub = a.subjudul ? pasAtauPotong(uji, a.subjudul, 1200, ruang(1, 34, 1.2), 34, 24, { tebal: true, maksBaris: 1, label: 'Subjudul ikhtisar' }) : null;
  const yBawah = yJudul + tinggiJudul + 4 + (sub ? sub.hasil.tinggi + 6 : 0);
  const yKartu = Math.max(310, yBawah + 40);
  const tinggi = 660 - yKartu;
  const tinggiIsi = tinggi - 122 - 82;
  const isiMuat = (k: P2['kartu'][number], n: number) => pasUkuran([par(k.isi)], lebarKartu(n) - 36, tinggiIsi, 14, 11).muat;

  const kelompok: P2['kartu'][] = [];
  let sisa = a.kartu.slice();
  while (sisa.length) {
    let n = Math.min(MAKS_PER_SLIDE, sisa.length);
    while (n > MIN_PER_SLIDE && !sisa.slice(0, n).every((k) => isiMuat(k, n))) n--;
    kelompok.push(sisa.slice(0, n));
    sisa = sisa.slice(n);
  }
  if (!kelompok.length) kelompok.push([]);

  let nomorKartu = 0;
  return kelompok.map((kartu, ke) => {
    const s = new Slide(a, ke, a.judul);
    s.laporan.push(...(ke === 0 ? uji.laporan : []));
    if (ke > 0) s.lapor('dipecah', `Ikhtisar ${a.kartu.length} kartu dibagi ke ${kelompok.length} slide`);
    s.teks({ nama: 'Judul ikhtisar', x: 120, y: yJudul, w: 1200, h: tinggiJudul + 4, paragraf: [par(judul.teks, { b: true })], pt: judul.hasil.pt, tebal: true, gradien: GRADIEN_JUDUL, rata: 'ctr', jarak: 1.1 });
    if (sub) s.teks({ nama: 'Subjudul', x: 120, y: yJudul + tinggiJudul + 6, w: 1200, h: sub.hasil.tinggi + 4, paragraf: [{ runs: [{ t: sub.teks, b: true, i: true }] }], pt: sub.hasil.pt, tebal: true, miring: true, gradien: GRADIEN_JUDUL, rata: 'ctr' });
    const n = kartu.length;
    const lebar = lebarKartu(n);
    const x0 = (1440 - (lebar * n + JARAK * (n - 1))) / 2;
    kartu.forEach((k, i) => {
      const x = x0 + i * (lebar + JARAK), y = yKartu;
      const utama = ke === 0 && i === 0;
      s.bentuk({ nama: utama ? 'Kartu utama' : 'Kartu', x, y, w: lebar, h: tinggi, radius: 14, ...(utama ? { gradien: { dari: W.langit, ke: W.tua, sudut: 90 } } : { isi: W.slate }) });
      const jk = pasAtauPotong(s, k.judul, lebar - 36, 88, 21, 15, { tebal: true, jarak: 1.15, maksBaris: 3, label: 'Judul kartu' });
      s.teks({ nama: 'Judul kartu', x: x + 18, y: y + 22, w: lebar - 36, h: 88, paragraf: [par(jk.teks, { b: true })], pt: jk.hasil.pt, tebal: true, warna: W.putih, rata: 'ctr', jangkar: 'b', jarak: 1.15 });
      const ik = pasAtauPotong(s, k.isi, lebar - 36, tinggiIsi, 14, 11, { jarak: 1.2, label: 'Isi kartu' });
      s.teks({ nama: 'Isi kartu', x: x + 18, y: y + 120, w: lebar - 36, h: tinggiIsi, paragraf: [par(ik.teks)], pt: ik.hasil.pt, warna: W.putih, rata: 'ctr' });
      const ikon: Ikon = k.ikon ?? ((nomorKartu % 5) + 1) as Ikon;
      nomorKartu++;
      s.bentuk({ nama: 'Ubin ikon', x: x + lebar / 2 - 30, y: y + tinggi - 70, w: 60, h: 56, isi: W.putih, radius: 12, bayangan: true });
      s.gambar(`ikon-${ikon}` as Aset, x + lebar / 2 - 17, y + tinggi - 59, 34, 34, 'Ikon kartu');
    });
    navBar(s, naskah.nav, a.bagian);
    return s.jadi();
  });
}
