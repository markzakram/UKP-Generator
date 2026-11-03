import { jsPDF } from 'jspdf';
import type { Paket, Pengaturan } from '../types';
import { amanPdf, blokDokumen, PEMBUAT, type Blok, type ModeIsi } from './common';

// A4, Times 12 pt, spasi 1,5 (selaras gaya dokumen akademik generator lain).
const MM = { kiri: 20, kanan: 20, atas: 20, bawah: 18 };
const PT = 0.3528;
const UKURAN = 12;
const BARIS = UKURAN * 1.5 * PT;

/** `kompres: false` hanya untuk pemeriksa (teks PDF bisa dicari). */
export function pdfPaket(paket: Paket[], peng: Pick<Pengaturan, 'judul' | 'tingkat' | 'durasi' | 'tanggalAcuan'>, mode: ModeIsi, kompres = true): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: kompres });
  doc.setProperties({ title: peng.judul, creator: PEMBUAT });
  const lebar = doc.internal.pageSize.getWidth() - MM.kiri - MM.kanan;
  const tinggi = doc.internal.pageSize.getHeight();
  let y = MM.atas;
  const ruang = (h: number) => { if (y + h > tinggi - MM.bawah) { doc.addPage(); y = MM.atas; } };
  const tulis = (teks: string, opsi: { tebal?: boolean; ukuran?: number; indent?: number; awalan?: string } = {}) => {
    const ukuran = opsi.ukuran ?? UKURAN, indent = opsi.indent ?? 0;
    doc.setFont('times', opsi.tebal ? 'bold' : 'normal');
    doc.setFontSize(ukuran);
    const tinggiBaris = ukuran * 1.5 * PT;
    const awalan = opsi.awalan ? amanPdf(opsi.awalan) : '';
    const lebarAwalan = awalan ? doc.getTextWidth(awalan + ' ') : 0;
    const baris = doc.splitTextToSize(amanPdf(teks), lebar - indent - lebarAwalan) as string[];
    baris.forEach((b, i) => {
      ruang(tinggiBaris);
      if (i === 0 && awalan) doc.text(awalan, MM.kiri + indent, y + tinggiBaris * 0.75);
      doc.text(b, MM.kiri + indent + lebarAwalan, y + tinggiBaris * 0.75);
      y += tinggiBaris;
    });
  };
  const tulisTebalAwal = (tebal: string, teks: string) => {
    // Label tebal pada baris sendiri bila teks panjang, supaya pemotongan baris tetap rapi.
    if (!teks) return tulis(tebal, { tebal: true });
    tulis(tebal.trim(), { tebal: true });
    tulis(teks);
  };
  const render = (b: Blok) => {
    switch (b.k) {
      case 'halamanBaru': doc.addPage(); y = MM.atas; break;
      case 'judul': tulis(b.teks, { tebal: true, ukuran: 15 }); y += 1; break;
      case 'meta': tulis(b.teks, { ukuran: 10 }); y += 2; break;
      case 'jarak': y += BARIS * 0.5; break;
      case 'kasus': {
        doc.setFont('times', 'normal'); doc.setFontSize(UKURAN);
        const baris = doc.splitTextToSize(amanPdf(b.teks), lebar - 6) as string[];
        const h = (baris.length + 1) * BARIS + 3;
        if (h < tinggi - MM.atas - MM.bawah) ruang(h);
        const yAwal = y;
        doc.setFillColor(242, 244, 247);
        doc.rect(MM.kiri, yAwal, lebar, Math.min(h, tinggi - MM.bawah - yAwal), 'F');
        y += 1.5;
        tulis('Kasus', { tebal: true, indent: 3 });
        for (const l of baris) { ruang(BARIS); doc.setFont('times', 'normal'); doc.text(l, MM.kiri + 3, y + BARIS * 0.75); y += BARIS; }
        y += 2;
        break;
      }
      case 'soal': tulis(b.teks, { awalan: b.nomor + '.' }); break;
      case 'opsi': tulis(b.teks, { awalan: b.huruf + '.', indent: 6 }); break;
      case 'jawaban': tulis(b.teks, { tebal: true }); break;
      case 'label': tulis(b.teks, { tebal: true }); break;
      case 'para': b.tebal ? tulisTebalAwal(b.tebal, b.teks) : tulis(b.teks); break;
      case 'daftar': b.items.forEach((it, i) => tulis(it, { awalan: b.bernomor ? i + 1 + '.' : '-', indent: 4 })); break;
      case 'tabelKunci': {
        const kolom = 5, lebarSel = lebar / kolom, tinggiSel = 8;
        doc.setFontSize(UKURAN);
        b.baris.forEach(([no, k], i) => {
          const c = i % kolom;
          if (c === 0) ruang(tinggiSel);
          doc.setDrawColor(208, 215, 222);
          doc.rect(MM.kiri + c * lebarSel, y, lebarSel, tinggiSel);
          doc.setFont('times', 'normal'); doc.text(no + '.', MM.kiri + c * lebarSel + 3, y + 5.5);
          doc.setFont('times', 'bold'); doc.text(k, MM.kiri + c * lebarSel + lebarSel / 2, y + 5.5);
          if (c === kolom - 1 || i === b.baris.length - 1) y += tinggiSel;
        });
        break;
      }
    }
  };
  for (const b of blokDokumen(paket, peng, mode)) render(b);
  const halaman = doc.getNumberOfPages();
  for (let i = 1; i <= halaman; i++) {
    doc.setPage(i);
    doc.setFont('times', 'normal'); doc.setFontSize(9);
    doc.text('Halaman ' + i + ' dari ' + halaman, doc.internal.pageSize.getWidth() - MM.kanan, tinggi - 8, { align: 'right' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
