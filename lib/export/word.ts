import type { Paket, Pengaturan } from '../types';
import { blokDokumen, PEMBUAT, type Blok, type ModeIsi } from './common';

/** Word biasa untuk penyuntingan naskah: Times New Roman 12 pt, spasi 1,5. */
export async function wordPaket(paket: Paket[], peng: Pick<Pengaturan, 'judul' | 'tingkat' | 'durasi' | 'tanggalAcuan'>, mode: ModeIsi): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, HeadingLevel } = await import('docx');
  type Anak = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const anak: Anak[] = [];
  const para = (runs: { teks: string; tebal?: boolean }[], opsi: { indent?: number; sebelum?: number; halamanBaru?: boolean; heading?: boolean } = {}) =>
    new Paragraph({
      ...(opsi.heading ? { heading: HeadingLevel.HEADING_1 } : {}),
      pageBreakBefore: opsi.halamanBaru,
      spacing: { after: 80, before: opsi.sebelum ?? 0 },
      indent: opsi.indent ? { left: opsi.indent } : undefined,
      children: runs.map((r) => new TextRun({ text: r.teks, ...(r.tebal ? { bold: true } : {}) })),
    });
  const garis = { style: BorderStyle.SINGLE, size: 4, color: 'D0D7DE' };
  let halamanBaru = false;
  const render = (b: Blok) => {
    const hb = halamanBaru; halamanBaru = false;
    switch (b.k) {
      case 'halamanBaru': halamanBaru = true; break;
      case 'judul': anak.push(para([{ teks: b.teks, tebal: true }], { heading: true, halamanBaru: hb })); break;
      case 'meta': anak.push(para([{ teks: b.teks }])); break;
      case 'jarak': break;
      case 'kasus':
        anak.push(new Table({ width: { size: 9600, type: WidthType.DXA }, columnWidths: [9600], rows: [new TableRow({ children: [new TableCell({
          width: { size: 9600, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F4F7' },
          margins: { top: 100, bottom: 100, left: 140, right: 140 }, borders: { top: garis, bottom: garis, left: garis, right: garis },
          children: [para([{ teks: 'Kasus', tebal: true }]), para([{ teks: b.teks }])],
        })] })] }));
        break;
      case 'soal': anak.push(para([{ teks: b.nomor + '. ', tebal: true }, { teks: b.teks }], { sebelum: 160 })); break;
      case 'opsi': anak.push(para([{ teks: b.huruf + '. ' }, { teks: b.teks }], { indent: 360 })); break;
      case 'jawaban': anak.push(para([{ teks: b.teks, tebal: true }])); break;
      case 'label': anak.push(para([{ teks: b.teks, tebal: true }])); break;
      case 'para': anak.push(para([...(b.tebal ? [{ teks: b.tebal, tebal: true }] : []), { teks: b.teks }])); break;
      case 'daftar': b.items.forEach((it, i) => anak.push(para([{ teks: (b.bernomor ? i + 1 + '. ' : '– ') + it }], { indent: 360 }))); break;
      case 'tabelKunci': {
        const kolom = 5, lebar = 1920;
        const baris: InstanceType<typeof TableRow>[] = [];
        for (let i = 0; i < b.baris.length; i += kolom) {
          const sel = b.baris.slice(i, i + kolom);
          while (sel.length < kolom) sel.push(['', '']);
          baris.push(new TableRow({ children: sel.map(([no, k]) => new TableCell({ width: { size: lebar, type: WidthType.DXA }, borders: { top: garis, bottom: garis, left: garis, right: garis },
            children: [para(no ? [{ teks: no + '. ' }, { teks: k, tebal: true }] : [{ teks: '' }])] })) }));
        }
        anak.push(new Table({ width: { size: lebar * kolom, type: WidthType.DXA }, columnWidths: Array(kolom).fill(lebar), rows: baris }));
        break;
      }
    }
  };
  for (const b of blokDokumen(paket, peng, mode)) render(b);
  const doc = new Document({
    creator: PEMBUAT, title: peng.judul,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { line: 360 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children: anak }],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
