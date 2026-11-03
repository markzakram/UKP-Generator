// P3 Konsep, P4 Definisi, P5 Dua kartu kontras, P10 Kesalahan umum.
import type { SlideJadi } from '../kotak';
import { EPS, kalimat, pasUkuran, ruang, tinggiTeks } from '../metrik';
import type { Naskah, SlideNaskah } from '../naskah';
import { BATAS_BAWAH, judulLanjutan, kepala, LEBAR_ISI, par, parBerlabel, pasAtauPotong, pembuka, pembukaPendek, Slide, TEPI, W } from './komponen';

type P3 = Extract<SlideNaskah, { pola: 'P3' }>;
type P4 = Extract<SlideNaskah, { pola: 'P4' }>;
type P5 = Extract<SlideNaskah, { pola: 'P5' }>;
type P10 = Extract<SlideNaskah, { pola: 'P10' }>;

const ISI_MAKS = 26, ISI_MIN = 22;
const DEF_MAKS = 24, DEF_MIN = 16;
const POIN_MAKS = 24, POIN_MIN = 18;
const KARTU_MIN = 20;

/** Ambil kalimat sebanyak mungkin yang muat; sisanya dikembalikan untuk slide berikutnya. */
function ambilYangMuat(potong: string[], lebar: number, tinggi: number, min: number): number {
  let n = 0;
  for (let k = 1; k <= potong.length; k++) {
    if (tinggiTeks([par(potong.slice(0, k).join(' '))], min, lebar).tinggi <= tinggi + EPS) n = k; else break;
  }
  return n;
}

export function tataKonsep(a: P3, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  const gambar = a.gambar ?? 'dokumen';
  const lebar = gambar === 'tanpa' ? LEBAR_ISI : 930;
  // Kalimat sangat panjang dipecah per titik koma agar bisa berpindah slide tanpa dipotong.
  const pecahPanjang = (k: string[]) => k.flatMap((t) => (t.length > 500 ? t.split(/(?<=;)\s+/) : [t]));
  let sisa = pecahPanjang(kalimat(a.isi));
  if (!sisa.length) sisa = [a.isi];
  let ptLanjutan = 0;
  for (let ke = 0; ke < 20 && (sisa.length || ke === 0); ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const yIsi = kepala(s, naskah, s.judul);
    let y = yIsi;
    if (ke === 0) {
      const p = pembuka(s, a.pembuka, yIsi, lebar);
      y = p.y;
      if (p.sisa) sisa = [...pecahPanjang(kalimat(p.sisa)), ...sisa];
    }
    const batas = ke === 0 && a.sorotan ? sorotan(s, a.sorotan) - 16 : BATAS_BAWAH;
    if (gambar === 'dokumen') s.gambar('ilustrasi-dokumen', 1062, Math.max(yIsi, 230), 300, 300, 'Ilustrasi dokumen dan jam');
    if (gambar === 'bertanya') s.gambar('ilustrasi-bertanya', 1072, Math.max(yIsi, 230), 280, 280, 'Ilustrasi orang bertanya');
    const tinggi = batas - y;
    const semua = sisa.join(' ');
    // Slide lanjutan memakai ukuran yang sama dengan slide sebelumnya.
    const maksIni = ke > 0 && ptLanjutan ? ptLanjutan : ISI_MAKS;
    let pas = pasUkuran([par(semua)], lebar, tinggi, maksIni, Math.min(ISI_MIN, maksIni));
    let dipakai = sisa.length;
    if (!pas.muat) {
      dipakai = ambilYangMuat(sisa, lebar, tinggi, ISI_MIN);
      if (dipakai === 0 && ke === 0 && (a.pembuka || a.sorotan)) {
        // ruang di bawah pembuka/sorotan terlalu sempit untuk kalimat pertama: seluruh isi pindah ke slide lanjutan
        s.lapor('dipecah', 'Isi dipindah ke slide lanjutan karena ruang di bawah pembuka terlalu sempit');
        hasil.push(s.jadi());
        continue;
      }
      dipakai = Math.max(1, dipakai);
      pas = pasUkuran([par(sisa.slice(0, dipakai).join(' '))], lebar, tinggi, maksIni, ISI_MIN);
      if (!pas.muat) {
        // satu kalimat pun tidak muat di slide kosong: potong kalimat itu
        const p = pasAtauPotong(s, sisa[0], lebar, tinggi, ISI_MIN, ISI_MIN, { label: 'Isi' });
        sisa = [p.teks, ...sisa.slice(1)];
        pas = p.hasil;
      }
      s.lapor('dipecah', `Isi terlalu panjang; ${sisa.length - dipakai} kalimat dipindah ke slide lanjutan`);
    } else if (pas.pt < ISI_MAKS) s.lapor('diperkecil', `Isi ${pas.pt} pt (maks ${ISI_MAKS})`);
    s.teks({ nama: 'Isi', x: TEPI, y, w: lebar, h: tinggi, paragraf: [par(sisa.slice(0, dipakai).join(' '))], pt: pas.pt });
    if (dipakai < sisa.length) ptLanjutan = pas.pt;
    sisa = sisa.slice(dipakai);
    hasil.push(s.jadi());
    if (!sisa.length) break;
  }
  return hasil;
}

/** Catatan bertanda ⚠ di bawah slide; tingginya mengikuti isi (maks. 5 baris). Mengembalikan y atasnya. */
function sorotan(s: Slide, so: NonNullable<P3['sorotan']>): number {
  const label = so.label ? so.label.replace(/:?\s*$/, ': ') : '';
  const runs = (t: string) => (label ? [{ t: label, b: true }, { t }] : [{ t }]);
  const lebar = 1196;
  let teks = so.teks;
  let pas = pasUkuran([{ runs: runs(teks) }], lebar, ruang(5, 24, 1.2), 24, 16, {}, 5);
  if (!pas.muat) {
    teks = pasAtauPotong(s, so.teks, lebar - 8 * label.length, ruang(5, 16, 1.2), 16, 16, { maksBaris: 5, label: 'Sorotan' }).teks;
    pas = pasUkuran([{ runs: runs(teks) }], lebar, ruang(5, 16, 1.2), 16, 16, {}, 5);
  }
  const h = Math.max(56, pas.tinggi + 4);
  const y = BATAS_BAWAH - h;
  s.gambar('peringatan', TEPI, y + (h - 48) / 2, 56, 48, 'Ikon peringatan');
  s.teks({ nama: 'Sorotan', x: 130, y, w: lebar, h, paragraf: [{ runs: runs(teks) }], pt: pas.pt, jangkar: 'ctr' });
  return y;
}

export function tataDefinisi(a: P4, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  let sisa = a.item.slice();
  for (let ke = 0; sisa.length && ke < 10; ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const y0 = ke === 0 ? pembukaPendek(s, a.pembuka, kepala(s, naskah, s.judul)) : kepala(s, naskah, s.judul);
    const avail = BATAS_BAWAH - y0;
    // Coba 2 kolom dengan semua item, lalu 1 kolom, lalu kurangi jumlah item per slide.
    const coba = (n: number, kolom: 1 | 2) => {
      const baris = Math.ceil(n / kolom), jarak = 20;
      const h = Math.min(kolom === 2 ? 200 : n === 1 ? avail : 180, (avail - jarak * (baris - 1)) / baris);
      const w = kolom === 2 ? (LEBAR_ISI - jarak) / 2 : LEBAR_ISI;
      const lebarLabel = w * (kolom === 2 ? 0.3 : 0.22), lebarIsi = w - lebarLabel - 80;
      const ok = sisa.slice(0, n).every((it) => pasUkuran([par(it.isi)], lebarIsi, h - 24, DEF_MAKS, DEF_MIN).muat && pasUkuran([par(it.label, { b: true })], lebarLabel, h - 16, 34, 20, { tebal: true, jarak: 1.1 }, 3).muat);
      return { ok, h, w, baris, jarak, lebarLabel, lebarIsi, kolom, n };
    };
    let rancang = null as ReturnType<typeof coba> | null;
    for (let n = Math.min(4, sisa.length); n >= 1 && !rancang; n--) {
      for (const kolom of [2, 1] as const) { const c = coba(n, kolom); if (c.ok) { rancang = c; break; } }
    }
    rancang ??= coba(1, 1);
    const { n, h, w, jarak, lebarLabel, lebarIsi, kolom } = rancang;
    if (n < sisa.length) s.lapor('dipecah', `${sisa.length - n} definisi dipindah ke slide lanjutan`);
    sisa.slice(0, n).forEach((it, i) => {
      const r = Math.floor(i / kolom), c = i % kolom;
      const terakhirGanjil = kolom === 2 && n % 2 === 1 && i === n - 1;
      const x = terakhirGanjil ? TEPI + (LEBAR_ISI - w) / 2 : TEPI + c * (w + jarak);
      const y = y0 + r * (h + jarak);
      s.bentuk({ nama: 'Kartu definisi', x, y, w, h, isi: W.slate, radius: 8 });
      const l = pasAtauPotong(s, it.label, lebarLabel, h - 16, 34, 20, { tebal: true, jarak: 1.1, maksBaris: 3, label: 'Label definisi' });
      s.teks({ nama: 'Label', x: x + 28, y: y + 8, w: lebarLabel, h: h - 16, paragraf: [par(l.teks, { b: true })], pt: l.hasil.pt, tebal: true, warna: W.putih, jangkar: 'ctr', jarak: 1.1 });
      s.garis(x + 28 + lebarLabel + 14, y + 14, x + 28 + lebarLabel + 14, y + h - 14, W.putih);
      const d = pasAtauPotong(s, it.isi, lebarIsi, h - 24, DEF_MAKS, DEF_MIN, { label: 'Isi definisi' });
      s.teks({ nama: 'Isi definisi', x: x + 28 + lebarLabel + 36, y: y + 12, w: lebarIsi, h: h - 24, paragraf: [par(d.teks)], pt: d.hasil.pt, warna: W.putih, jangkar: 'ctr' });
    });
    sisa = sisa.slice(n);
    hasil.push(s.jadi());
  }
  return hasil;
}

export function tataKontras(a: P5, naskah: Naskah): SlideJadi[] {
  const hasil: SlideJadi[] = [];
  const w = 646;
  let kiri = a.kiri.poin.slice(), kanan = a.kanan.poin.slice();
  let maksPoin = POIN_MAKS;
  for (let ke = 0; (kiri.length || kanan.length || ke === 0) && ke < 10; ke++) {
    const s = new Slide(a, ke, judulLanjutan(a.judul, ke));
    const yKepala = kepala(s, naskah, s.judul);
    const y0 = ke === 0 ? pembukaPendek(s, a.pembuka, yKepala) : yKepala;
    const hMaks = BATAS_BAWAH - y0;
    // Tahap 1: rencanakan isi setiap sisi pada tinggi maksimum.
    const rencana = [
      { x: TEPI, warna: W.slate, judul: a.kiri.judul, poin: kiri },
      { x: TEPI + w + 34, warna: W.teal, judul: a.kanan.judul, poin: kanan }
    ].map((sd) => {
      const jd = pasAtauPotong(s, sd.judul, w - 56, ruang(2, 38, 1.1), 38, 26, { tebal: true, jarak: 1.1, maksBaris: 2, label: 'Judul kartu' });
      const tj = jd.hasil.tinggi;
      const hp = hMaks - 18 - tj - 16 - 24;
      if (!sd.poin.length) {
        const paragraf = [par(ke ? 'Lihat slide sebelumnya.' : '—', { i: true })];
        return { ...sd, jd, tj, paragraf, pt: 20, n: 0, tinggiPoin: 20 * 1.2 };
      }
      const bp = (k: number) => sd.poin.slice(0, k).map((t) => ({ ...parBerlabel(t), butir: true }));
      let n = sd.poin.length;
      let pas = pasUkuran(bp(n), w - 56, hp, maksPoin, POIN_MIN, { antarPar: 0.3 });
      while (!pas.muat && n > 1) { n--; pas = pasUkuran(bp(n), w - 56, hp, maksPoin, POIN_MIN, { antarPar: 0.3 }); }
      let paragraf = bp(n);
      if (!pas.muat) {
        const p = pasAtauPotong(s, sd.poin[0], w - 56 - 22, hp, POIN_MIN, POIN_MIN, { label: 'Poin' });
        paragraf = [{ ...par(p.teks), butir: true }];
        pas = pasUkuran(paragraf, w - 56, hp, POIN_MIN, POIN_MIN, { antarPar: 0.3 });
      }
      if (n < sd.poin.length) s.lapor('dipecah', `${sd.poin.length - n} poin "${sd.judul}" dipindah ke slide lanjutan`);
      return { ...sd, jd, tj, paragraf, pt: pas.pt, n, tinggiPoin: pas.tinggi };
    });
    // Tahap 2: kedua kartu setinggi isi terpanjang (minimal 260 pt), tidak melewati batas bawah.
    const h = Math.min(hMaks, Math.max(260, ...rencana.map((r) => 18 + r.tj + 16 + r.tinggiPoin + 28)));
    for (const r of rencana) {
      s.bentuk({ nama: 'Kartu', x: r.x, y: y0, w, h, isi: r.warna, radius: 8 });
      s.teks({ nama: 'Judul kartu', x: r.x + 28, y: y0 + 18, w: w - 56, h: r.tj + 4, paragraf: [par(r.jd.teks, { b: true })], pt: r.jd.hasil.pt, tebal: true, warna: W.putih, jarak: 1.1 });
      const yp = y0 + 18 + r.tj + 16;
      s.teks({ nama: 'Poin', x: r.x + 28, y: yp, w: w - 56, h: y0 + h - 20 - yp, paragraf: r.paragraf, pt: r.pt, miring: r.n === 0, warna: W.putih, antarPar: 0.3 });
    }
    kiri = rencana[0].poin.slice(rencana[0].n);
    kanan = rencana[1].poin.slice(rencana[1].n);
    if (kiri.length || kanan.length) maksPoin = Math.min(...rencana.filter((r) => r.n > 0).map((r) => r.pt), maksPoin);
    hasil.push(s.jadi());
  }
  return hasil;
}

const LEBAR_KARTU = 646;

/** Tinggi judul kartu kesalahan pada ukuran yang muat. */
function tinggiJudulKartu(judul: string) {
  const p = pasUkuran([par(judul, { b: true })], LEBAR_KARTU - 56, ruang(2, 34, 1.1), 34, 24, { tebal: true, jarak: 1.1 }, 2);
  return p.tinggi;
}

/** Dua kartu (keliru/benar) setinggi isi terpanjang, minimal 240 pt, tidak melewati batas bawah. */
function kartuKesalahan(s: Slide, a: P10, y: number) {
  const hMaks = BATAS_BAWAH - y, w = LEBAR_KARTU;
  const rencana = [{ x: TEPI, warna: W.slate, d: a.keliru }, { x: TEPI + w + 34, warna: W.teal, d: a.benar }].map((r) => {
    const j = pasAtauPotong(s, r.d.judul, w - 56, ruang(2, 34, 1.1), 34, 24, { tebal: true, jarak: 1.1, maksBaris: 2, label: 'Judul kartu' });
    const tj = j.hasil.tinggi;
    const isi = pasAtauPotong(s, r.d.isi, w - 56, hMaks - 18 - tj - 14 - 20, 24, KARTU_MIN, { label: 'Isi kartu' });
    return { ...r, j, tj, isi };
  });
  const h = Math.min(hMaks, Math.max(240, ...rencana.map((r) => 18 + r.tj + 14 + r.isi.hasil.tinggi + 28)));
  for (const r of rencana) {
    s.bentuk({ nama: 'Kartu', x: r.x, y, w, h, isi: r.warna, radius: 8 });
    s.teks({ nama: 'Judul kartu', x: r.x + 28, y: y + 18, w: w - 56, h: r.tj + 4, paragraf: [par(r.j.teks, { b: true })], pt: r.j.hasil.pt, tebal: true, warna: W.putih, jarak: 1.1 });
    const yi = y + 18 + r.tj + 14;
    s.teks({ nama: 'Isi kartu', x: r.x + 28, y: yi, w: w - 56, h: y + h - 20 - yi, paragraf: [par(r.isi.teks)], pt: r.isi.hasil.pt, warna: W.putih });
  }
}

const kartuMuat = (a: P10, y: number) => [a.keliru, a.benar].every((d) => {
  const hi = BATAS_BAWAH - y - 18 - tinggiJudulKartu(d.judul) - 14 - 20;
  return pasUkuran([par(d.isi)], LEBAR_KARTU - 56, hi, KARTU_MIN, KARTU_MIN).muat;
});

/** Pembuka bertanda ⚠. Mengembalikan y bawah. */
function pembukaPeringatan(s: Slide, teks: string, y: number, pt: number) {
  const t = tinggiTeks([par(teks)], pt, LEBAR_ISI - 70).tinggi;
  s.gambar('peringatan', TEPI, y + 4, 52, 45, 'Ikon peringatan');
  s.teks({ nama: 'Pembuka', x: TEPI + 70, y, w: LEBAR_ISI - 70, h: Math.max(t, 52) + 2, paragraf: [par(teks)], pt, jangkar: 'ctr' });
  return y + Math.max(t, 52) + 22;
}

/**
 * Satu slide (pembuka ≤ 3 baris + dua kartu) bila muat. Bila tidak, dipecah:
 * slide pertama berisi pembuka, slide lanjutan berisi kedua kartu.
 */
export function tataKesalahan(a: P10, naskah: Naskah): SlideJadi[] {
  const s = new Slide(a, 0, a.judul);
  const y0 = kepala(s, naskah, a.judul);
  const pas = a.pembuka ? pasUkuran([par(a.pembuka)], LEBAR_ISI - 70, ruang(3, 26, 1.2), 26, 18, {}, 3) : null;
  const yKartu = pas ? y0 + Math.max(pas.tinggi, 52) + 22 : y0;
  if ((!pas || pas.muat) && kartuMuat(a, yKartu)) {
    if (a.pembuka && pas) pembukaPeringatan(s, a.pembuka, y0, pas.pt);
    kartuKesalahan(s, a, yKartu);
    return [s.jadi()];
  }
  s.lapor('dipecah', 'Pembuka dan kartu tidak muat satu slide; kartu dipindah ke slide lanjutan');
  if (a.pembuka) {
    const p = pasAtauPotong(s, a.pembuka, LEBAR_ISI - 70, BATAS_BAWAH - y0, ISI_MAKS, ISI_MIN, { label: 'Teks pembuka' });
    pembukaPeringatan(s, p.teks, y0, p.hasil.pt);
  }
  const s2 = new Slide(a, 1, judulLanjutan(a.judul, 1));
  kartuKesalahan(s2, a, kepala(s2, naskah, s2.judul));
  return [s.jadi(), s2.jadi()];
}
