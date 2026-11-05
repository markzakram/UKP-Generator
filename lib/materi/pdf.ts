// Penulis .pdf deck materi tanpa PowerPoint: kotak hasil tata letak yang sama dengan .pptx digambar sebagai vektor.
// Font Poppins dan gambar diambil dari paket dasar, jadi hasilnya sama di browser dan CLI. Catatan pembicara tidak ikut.
import { unzipSync } from 'fflate';
import { jsPDF, GState, ShadingPattern } from 'jspdf';
import { KANVAS, type Aset, type Gradien, type Kotak, type KotakBentuk, type KotakGambar, type KotakTeks, type Paragraf } from './kotak';
import { bungkusParagraf, CADANGAN_LEBAR, LEKUK_BUTIR } from './metrik';
import { adaTeksAcuan, type Naskah } from './naskah';
import { tataLetak } from './tata-letak';

/** Halaman 16 x 9 inci (1 inci = 72 pt); kanvas 1440 x 810 diskalakan ke sini. */
export const HALAMAN_PDF = { w: 16 * 72, h: 9 * 72 } as const;
const S = HALAMAN_PDF.w / KANVAS.w;
const FONT = 'Poppins';
/** Posisi garis dasar dari atas baris, kelipatan tinggi baris; dikalibrasi terhadap ekspor PDF PowerPoint. */
const GARIS_DASAR = 0.755;
/** Kemiringan buatan untuk teks miring: paket dasar hanya memuat Poppins Regular dan Bold. */
const MIRING = 0.2;

/**
 * Huruf yang tidak ada di Poppins digambar dengan font Symbol bawaan PDF (kode huruf dan lebarnya per 1 em).
 * PowerPoint melakukan hal serupa dengan font cadangan; `→` saja muncul ratusan kali di deck.
 */
const SIMBOL: Record<string, [number, number]> = { '→': [0xae, 0.987], '←': [0xac, 0.987], '↔': [0xab, 1.042], '↑': [0xad, 0.603], '↓': [0xaf, 0.603], 'Σ': [0x53, 0.592], '∑': [0xe5, 0.713] };
const RE_SIMBOL = new RegExp('([' + Object.keys(SIMBOL).join('') + '])', 'u');

export interface HasilPdf { berkas: Uint8Array; halaman: number; drafInternal: boolean }

interface Sumber { regular: string; bold: string; media: Record<string, Uint8Array> }
const cacheSumber = new WeakMap<Uint8Array, Sumber>();

function base64(b: Uint8Array) {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
/** .fntdata paket dasar adalah EOT tanpa kompresi: TTF utuh ada di ujung berkas, sepanjang FontDataSize di header. */
function ttfDariEot(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const panjang = v.getUint32(4, true);
  if (v.getUint32(12, true) & 0x10000004) throw new Error('Font paket dasar terkompresi; PDF tidak dapat dibuat.');
  return b.subarray(b.length - panjang);
}
function sumberDari(dasar: Uint8Array): Sumber {
  const ada = cacheSumber.get(dasar);
  if (ada) return ada;
  const z = unzipSync(dasar, { filter: (f) => f.name.startsWith('ppt/fonts/') || (f.name.startsWith('ppt/media/') && f.name.endsWith('.png')) });
  const reg = z['ppt/fonts/poppins-regular.fntdata'], bold = z['ppt/fonts/poppins-bold.fntdata'];
  if (!reg || !bold) throw new Error('Paket dasar tidak memuat font Poppins.');
  const media: Record<string, Uint8Array> = {};
  for (const [nama, isi] of Object.entries(z)) if (nama.startsWith('ppt/media/')) media[nama.slice(10, -4)] = isi;
  const hasil = { regular: base64(ttfDariEot(reg)), bold: base64(ttfDariEot(bold)), media };
  cacheSumber.set(dasar, hasil);
  return hasil;
}

const rgb = (h: string): [number, number, number] => { const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const campur = (a: string, b: string, t: number): [number, number, number] => {
  const x = rgb(a), y = rgb(b);
  return [0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t)) as [number, number, number];
};

/** Bungkus seperti PowerPoint, lalu kembalikan gaya tiap huruf pada setiap baris. */
function barisBergaya(p: Paragraf, pt: number, lebar: number, tebal: boolean, miring: boolean) {
  const huruf: { c: string; b: boolean; i: boolean; w?: string }[] = [];
  for (const r of p.runs) for (const c of r.t) huruf.push({ c, b: r.b ?? tebal, i: r.i ?? miring, w: r.warna });
  let kursor = 0;
  // Cadangan lebar pengukur hanya untuk pembulatan PowerPoint; di PDF lebar huruf pasti, jadi baris dipakai penuh.
  return bungkusParagraf(p, pt, lebar * (1 + CADANGAN_LEBAR), tebal).map((baris) => {
    const potong: { t: string; b: boolean; i: boolean; w?: string }[] = [];
    for (const c of baris) {
      while (kursor < huruf.length && huruf[kursor].c !== c) kursor++;
      const h = huruf[kursor++] ?? { c, b: tebal, i: miring };
      const akhir = potong[potong.length - 1];
      if (akhir && akhir.b === h.b && akhir.i === h.i && akhir.w === h.w) akhir.t += c;
      else potong.push({ t: c, b: h.b, i: h.i, w: h.w });
    }
    return potong;
  });
}

class Penggambar {
  private nPola = 0;
  constructor(private doc: jsPDF, private sumber: Sumber) {}

  private alfa(a: number | undefined) { this.doc.setGState(new GState({ opacity: a == null ? 1 : a / 100 })); }

  private jalur(k: Pick<KotakBentuk, 'x' | 'y' | 'w' | 'h' | 'radius'>, gaya: string | null, dx = 0, dy = 0) {
    const r = Math.min(k.radius ?? 0, k.w / 2, k.h / 2) * S;
    if (r > 0) this.doc.roundedRect((k.x + dx) * S, (k.y + dy) * S, k.w * S, k.h * S, r, r, gaya);
    else this.doc.rect((k.x + dx) * S, (k.y + dy) * S, k.w * S, k.h * S, gaya);
  }

  /** Gradien linear: sudut mengikuti DrawingML (0° = kiri ke kanan, 90° = atas ke bawah), rentang menutup seluruh kotak. */
  private gradien(k: KotakBentuk, g: Gradien) {
    const doc = this.doc, rad = (g.sudut * Math.PI) / 180;
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    const setengah = (Math.abs(k.w * Math.cos(rad)) + Math.abs(k.h * Math.sin(rad))) / 2;
    const dx = Math.cos(rad) * setengah, dy = Math.sin(rad) * setengah;
    const titik = [(cx - dx) * S, (cy - dy) * S, (cx + dx) * S, (cy + dy) * S];
    const kunci = 'gradien' + ++this.nPola;
    const gs = g.alfa != null && g.alfa < 100 ? new GState({ opacity: g.alfa / 100 }) : undefined;
    doc.advancedAPI((d) => {
      d.addShadingPattern(kunci, new ShadingPattern('axial', titik as [number, number, number, number], [{ offset: 0, color: rgb(g.dari) }, { offset: 1, color: rgb(g.ke) }], gs));
      this.jalur(k, null);
      d.fill({ key: kunci, matrix: d.Matrix(1, 0, 0, 1, 0, 0) });
    });
  }

  private bentuk(k: KotakBentuk) {
    const doc = this.doc;
    if (k.bayangan) {
      // Bayangan lembut: beberapa lapis tipis bergeser ke bawah, mendekati outerShdw di .pptx.
      doc.setFillColor(0, 0, 0);
      for (const [lebar, a] of [[8, 2], [5, 3], [3, 4], [1, 5]]) {
        this.alfa(a);
        const lapis = { x: k.x - lebar, y: k.y - lebar, w: k.w + 2 * lebar, h: k.h + 2 * lebar, radius: (k.radius ?? 0) + lebar };
        this.jalur(lapis, 'F', 0, 5);
      }
      this.alfa(undefined);
    }
    if (k.gradien) this.gradien(k, k.gradien);
    else if (k.isi) {
      doc.setFillColor(...rgb(k.isi));
      this.alfa(k.alfa);
      this.jalur(k, 'F');
      this.alfa(undefined);
    }
    if (k.garis) {
      doc.setDrawColor(...rgb(k.garis.warna));
      doc.setLineWidth(k.garis.tebal * S);
      this.jalur(k, 'S');
    }
  }

  private gambar(k: KotakGambar) {
    const isi = this.sumber.media[k.aset as Aset];
    if (!isi) throw new Error('Gambar tidak ada di paket dasar: ' + k.aset);
    this.alfa(k.opasitas);
    // Alias membuat gambar yang sama hanya tertanam satu kali dalam satu berkas.
    this.doc.addImage(isi, 'PNG', k.x * S, k.y * S, k.w * S, k.h * S, k.aset, 'FAST');
    this.alfa(undefined);
  }

  private teks(k: KotakTeks) {
    const doc = this.doc;
    const tebal = !!k.tebal, miring = !!k.miring, tinggiBaris = k.pt * k.jarak;
    doc.setFontSize(k.pt * S);
    const baris = k.paragraf.map((p) => {
      const lekuk = p.butir ? LEKUK_BUTIR * k.pt : 0, ruang = k.w - lekuk;
      const isi = barisBergaya(p, k.pt, ruang, tebal, miring).map((potong) => {
        const lebar = potong.reduce((a, r) => a + this.lebar(r.t, r.b, k.pt), 0);
        return { potong, lebar, x: k.x + lekuk + (k.rata === 'ctr' ? (ruang - lebar) / 2 : k.rata === 'r' ? ruang - lebar : 0) };
      });
      return { p, isi };
    });
    const tinggi = baris.reduce((a, b, i) => a + b.isi.length * tinggiBaris + (i ? k.pt * k.antarPar : 0), 0);
    let y = k.y + (k.jangkar === 'ctr' ? (k.h - tinggi) / 2 : k.jangkar === 'b' ? k.h - tinggi : 0);
    // Gradien teks merentang sepanjang teks, bukan sepanjang kotak (sama dengan PowerPoint).
    const semua = baris.flatMap((b) => b.isi);
    const rentang = { x0: Math.min(...semua.map((l) => l.x)), x1: Math.max(...semua.map((l) => l.x + l.lebar)), y0: y, y1: y + tinggi };
    baris.forEach(({ p, isi }, ip) => {
      if (ip) y += k.pt * k.antarPar;
      isi.forEach((l, ib) => {
        const dasar = y + tinggiBaris * GARIS_DASAR;
        if (p.butir && ib === 0) { doc.setFont(FONT, 'normal'); doc.setTextColor(...rgb(k.warna)); doc.text('•', k.x * S, dasar * S); }
        let x = l.x;
        for (const r of l.potong) x = this.potongan(k, r, x, dasar, rentang);
        y += tinggiBaris;
      });
    });
  }

  /** Lebar teks di kanvas; bagian simbol memakai lebar Symbol. */
  private lebar(t: string, b: boolean, pt: number) {
    const doc = this.doc;
    let w = 0;
    for (const bagian of t.split(RE_SIMBOL)) {
      if (!bagian) continue;
      if (SIMBOL[bagian]) w += SIMBOL[bagian][1] * pt;
      else { doc.setFont(FONT, b ? 'bold' : 'normal'); w += doc.getTextWidth(bagian) / S; }
    }
    return w;
  }

  /** Tulis satu bagian teks. Matriks miring ikut mengalikan posisi Y halaman, jadi posisi X dikompensasi. */
  private tulis(t: string, x: number, dasar: number, r: { b: boolean; i: boolean }, pt: number) {
    const doc = this.doc;
    const px = (nilai: number) => nilai * S - (r.i ? MIRING * (HALAMAN_PDF.h - dasar * S) : 0);
    const opsi = r.i ? { angle: doc.Matrix(1, 0, MIRING, 1, 0, 0) as unknown as number } : {};
    let w = 0;
    for (const bagian of t.split(RE_SIMBOL)) {
      if (!bagian) continue;
      if (SIMBOL[bagian]) {
        doc.setFont('symbol', 'normal');
        doc.text(String.fromCharCode(SIMBOL[bagian][0]), px(x + w), dasar * S, opsi);
        w += SIMBOL[bagian][1] * pt;
      } else {
        doc.setFont(FONT, r.b ? 'bold' : 'normal');
        doc.text(bagian, px(x + w), dasar * S, opsi);
        w += doc.getTextWidth(bagian) / S;
      }
    }
    return x + w;
  }

  /** Satu potongan bergaya; teks bergradien diwarnai per huruf menurut posisinya dalam rentang teks. */
  private potongan(k: KotakTeks, r: { t: string; b: boolean; i: boolean; w?: string }, x: number, dasar: number, c: { x0: number; x1: number; y0: number; y1: number }) {
    const doc = this.doc;
    if (k.gradien && !r.w) {
      const g = k.gradien, rad = (g.sudut * Math.PI) / 180;
      const lebar = c.x1 - c.x0, tinggi = c.y1 - c.y0;
      const setengah = (Math.abs(lebar * Math.cos(rad)) + Math.abs(tinggi * Math.sin(rad))) / 2 || 1;
      for (const h of r.t) {
        const w = this.lebar(h, r.b, k.pt);
        const pos = ((x + w / 2 - (c.x0 + lebar / 2)) * Math.cos(rad) + (dasar - k.pt * 0.35 - (c.y0 + tinggi / 2)) * Math.sin(rad)) / (2 * setengah) + 0.5;
        doc.setTextColor(...campur(g.dari, g.ke, Math.min(1, Math.max(0, pos))));
        x = this.tulis(h, x, dasar, r, k.pt);
      }
      return x;
    }
    doc.setTextColor(...rgb(r.w ?? k.warna));
    return this.tulis(r.t, x, dasar, r, k.pt);
  }

  kotak(k: Kotak) {
    if (k.jenis === 'bentuk') return this.bentuk(k);
    if (k.jenis === 'gambar') return this.gambar(k);
    if (k.jenis === 'teks') return this.teks(k);
    this.doc.setDrawColor(...rgb(k.warna));
    this.doc.setLineWidth(k.tebal * S);
    this.doc.line(k.x1 * S, k.y1 * S, k.x2 * S, k.y2 * S);
  }

  tandaDraf() {
    const doc = this.doc;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 60, 40);
    doc.text('DRAF INTERNAL: bukan untuk peserta', HALAMAN_PDF.w - 12, 14, { align: 'right' });
  }
}

function dokumenBaru(sumber: Sumber, kompres: boolean) {
  const doc = new jsPDF({ unit: 'pt', format: [HALAMAN_PDF.w, HALAMAN_PDF.h], orientation: 'landscape', compress: kompres });
  doc.addFileToVFS('Poppins-Regular.ttf', sumber.regular);
  doc.addFileToVFS('Poppins-Bold.ttf', sumber.bold);
  doc.addFont('Poppins-Regular.ttf', FONT, 'normal');
  doc.addFont('Poppins-Bold.ttf', FONT, 'bold');
  return doc;
}

/** Huruf dalam `teks` yang tidak bisa digambar: tidak ada di Poppins dan tidak ada padanannya di Symbol. */
export function hurufTanpaGambar(dasar: Uint8Array, teks: string) {
  const doc = dokumenBaru(sumberDari(dasar), false);
  const huruf = [...new Set(teks)];
  const tanpa = (gaya: string) => {
    doc.setFont(FONT, gaya);
    const font = doc.getFont() as unknown as { metadata: { characterToGlyph: (c: number) => number } };
    return huruf.filter((c) => !SIMBOL[c] && c !== '\n' && !font.metadata.characterToGlyph(c.codePointAt(0)!));
  };
  return [...new Set([...tanpa('normal'), ...tanpa('bold')])];
}

export function tulisPdf(naskah: Naskah, dasar: Uint8Array, opsi: { ditelaah?: boolean; kompres?: boolean } = {}): HasilPdf {
  // Sama dengan .pptx: deck bertek acuan yang belum ditelaah bertanda Draf internal (PRD-Materi KM2), di sini tampak di tiap halaman.
  const draf = adaTeksAcuan(naskah) && !opsi.ditelaah;
  const slides = tataLetak(naskah, { tandaDraf: draf });
  if (!slides.length) throw new Error('Naskah tidak punya slide yang ditampilkan.');
  const sumber = sumberDari(dasar);
  const doc = dokumenBaru(sumber, opsi.kompres ?? true);
  doc.setProperties({
    title: naskah.judul, subject: [naskah.materi, naskah.subtema].filter(Boolean).join(' · ') + (draf ? ' · Draf internal, bukan untuk peserta' : ''), creator: 'UKP Studio', author: 'UKP Studio',
    keywords: ['UKP', naskah.kode, naskah.tingkat && 'Tingkat ' + naskah.tingkat, 'aturan per ' + naskah.tanggalAcuan, draf && 'Draf internal'].filter(Boolean).join('; '),
  });
  const g = new Penggambar(doc, sumber);
  slides.forEach((s, i) => {
    if (i) doc.addPage([HALAMAN_PDF.w, HALAMAN_PDF.h], 'landscape');
    s.kotak.forEach((k) => g.kotak(k));
    if (draf) g.tandaDraf();
  });
  return { berkas: new Uint8Array(doc.output('arraybuffer')), halaman: slides.length, drafInternal: draf };
}
