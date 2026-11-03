// Ekspor SiAdu: Word (dibaca Auto Input/importir SiAdu, format sama dengan SKD Generator) dan Excel template Bank Soal SiAdu.
import { strToU8, zipSync } from 'fflate';
import { HURUF, LABEL_KESULITAN } from '../config';
import type { Mapping, Paket, Pengaturan, Soal } from '../types';
import { PEMBUAT } from './common';

export type IsiSiadu = 'pembahasan' | 'soal-jawaban';
export const SIADU_BAWAAN: Mapping['siadu'] = { category: 'UKP Tingkat {tingkat}', lesson: '{materi}', chapter: '{subtema}' };

/** Category/Lesson/Chapter menurut data/ukp-mapping.json (PRD K5). */
export function petaSiadu(s: Soal, peta: Mapping['siadu'] = SIADU_BAWAAN) {
  const isi = (t: string) => t.replace('{tingkat}', s.tingkat).replace('{materi}', s.materi).replace('{subtema}', s.subtema).replace('{kode}', s.kode);
  return { category: isi(peta.category), lesson: isi(peta.lesson), chapter: isi(peta.chapter) };
}

/** Baris pembahasan polos (dipakai Word SiAdu dan kolom pembahasan Excel). */
export function barisPembahasan(s: Soal): string[] {
  const b = ['Inti. ' + s.inti];
  s.langkah.forEach((l, i) => b.push(i + 1 + '. ' + l));
  const salah = HURUF.filter((h) => h !== s.kunci && s.kenapaSalah[h]);
  if (salah.length) { b.push('Mengapa opsi lain salah:'); for (const h of salah) b.push(h + '. ' + s.kenapaSalah[h]); }
  if (s.dasarHukum.length) b.push('Dasar hukum: ' + s.dasarHukum.join('; '));
  if (s.poinIngat) b.push('Poin ingat: ' + s.poinIngat);
  return b;
}

/** Soal acuan sumber (LatihUKP) atau adaptasinya: ekspor SiAdu butuh konfirmasi (PRD K2). */
export const soalAcuan = (paket: Paket[]) => paket.flatMap((p) => p.soal).filter((s) => s.asal === 'bank' || s.asal === 'adaptasi');

export async function siaduWord(paket: Paket[], peng: Pick<Pengaturan, 'judul' | 'seed'>, isi: IsiSiadu = 'pembahasan', peta?: Mapping['siadu']): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const anak: InstanceType<typeof Paragraph>[] = [];
  // Auto Input menganggap setiap w:b sebagai tebal; properti bold hanya ditulis bila memang tebal.
  const para = (teks: string, tebal = false, keepNext = false) => new Paragraph({ keepNext, spacing: { after: 100 }, children: teks.split(/\r?\n/).map((l, i) => new TextRun({ text: l, ...(tebal ? { bold: true } : {}), ...(i ? { break: 1 } : {}) })) });
  const soal = paket.flatMap((p) => p.soal);
  anak.push(para(peng.judul + ' — ' + paket.map((p) => p.id).join(' + '), true), para('Format input Word SiAdu · ' + soal.length + ' soal · benih ' + peng.seed));
  if (isi === 'soal-jawaban') anak.push(para('Isi dokumen: Soal + jawaban tanpa pembahasan'));
  soal.forEach((s, i) => {
    const m = petaSiadu(s, peta);
    anak.push(new Paragraph({ style: 'SiaduQuestion', keepNext: true, spacing: { after: 100 }, children: [new TextRun('Soal ' + (i + 1))] }));
    anak.push(para('Category: ' + m.category, true, true), para('Lesson: ' + m.lesson, true, true), para('Chapter: ' + m.chapter, true, true));
    anak.push(para('Bentuk Soal: Option New', false, true), para('Tingkat Kesulitan: ' + LABEL_KESULITAN[s.kesulitan], false, true));
    // Setiap soal kasus memuat teks kasusnya sendiri karena SiAdu menyimpan soal satu per satu.
    if (s.kasus) anak.push(para(s.kasus.replace(/\s+/g, ' ').trim()));
    anak.push(para(s.soal.replace(/\s+/g, ' ').trim()));
    for (const h of HURUF) anak.push(para(h + '. ' + s.opsi[h]));
    anak.push(new Paragraph({ style: 'SiaduAnswer', keepNext: isi === 'pembahasan', spacing: { after: 100 }, children: [new TextRun('Jawaban: ' + s.kunci)] }));
    if (isi === 'pembahasan') {
      anak.push(para('Pembahasan:', true, true));
      for (const b of barisPembahasan(s)) anak.push(para(b));
    }
  });
  const doc = new Document({
    creator: PEMBUAT, title: peng.judul + ' · SiAdu',
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 24, color: '000000' }, paragraph: { spacing: { line: 360 } } } },
      paragraphStyles: [
        { id: 'SiaduAnswer', name: 'Jawaban SiAdu', basedOn: 'Normal', run: { bold: true, font: 'Times New Roman', size: 24 } },
        { id: 'SiaduQuestion', name: 'Nomor soal SiAdu', basedOn: 'Normal', run: { bold: true, font: 'Times New Roman', size: 24 } },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children: anak }],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}

// ---------------------------------------------------------------- Excel template Bank Soal SiAdu
/** Header sheet SOAL persis seperti Template_Bank_Soal_SiAdu.xlsx (parser membaca nama header). */
export const HEADER_SIADU = ['no', 'level', 'soal', 'opsi_a', 'opsi_b', 'opsi_c', 'opsi_d', 'opsi_e', 'jawaban_benar', 'skor_a', 'skor_b', 'skor_c', 'skor_d', 'skor_e', 'skor_f', 'pembahasan', 'answer_type', 'table_header_0', 'table_header_1', 'answer_options', 'is_strict_mode'];

export function barisExcelSiadu(soal: Soal[], isi: IsiSiadu = 'pembahasan'): (string | number)[][] {
  return soal.map((s, i) => [
    i + 1, LABEL_KESULITAN[s.kesulitan], (s.kasus ? s.kasus.trim() + '\n\n' : '') + s.soal.trim(),
    s.opsi.A, s.opsi.B, s.opsi.C, s.opsi.D, '', s.kunci, '', '', '', '', '', '',
    isi === 'pembahasan' ? barisPembahasan(s).join('\n') : '', 'option_new', '', '', '', '',
  ]);
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const kolom = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** XLSX minimal (inline string, satu gaya wrap) tanpa pustaka spreadsheet. */
export function xlsx(lembar: { nama: string; baris: (string | number)[][]; lebar?: number[] }[]): Uint8Array {
  const sheet = (baris: (string | number)[][], lebar?: number[]) => {
    const cols = lebar ? '<cols>' + lebar.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '';
    const rows = baris.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      const ref = kolom(ci) + (ri + 1), gaya = ri === 0 ? ' s="2"' : ' s="1"';
      if (v === '' || v === null || v === undefined) return '';
      return typeof v === 'number' ? '<c r="' + ref + '"' + gaya + '><v>' + v + '</v></c>' : '<c r="' + ref + '"' + gaya + ' t="inlineStr"><is><t xml:space="preserve">' + esc(String(v)) + '</t></is></c>';
    }).join('') + '</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' + cols + '<sheetData>' + rows + '</sheetData></worksheet>';
  };
  const berkas: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + lembar.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + lembar.map((l, i) => '<sheet name="' + esc(l.nama) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + lembar.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (lembar.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
  };
  lembar.forEach((l, i) => { berkas['xl/worksheets/sheet' + (i + 1) + '.xml'] = strToU8(sheet(l.baris, l.lebar)); });
  return zipSync(berkas);
}

export function siaduExcel(paket: Paket[], isi: IsiSiadu = 'pembahasan'): Uint8Array {
  const soal = paket.flatMap((p) => p.soal);
  const lebar = [6, 9, 70, 32, 32, 32, 32, 10, 13, 8, 8, 8, 8, 8, 8, 80, 13, 14, 14, 16, 14];
  const petunjuk = [
    ['CATATAN UKP STUDIO'],
    ['Sheet SOAL mengikuti header template Bank Soal SiAdu (parser membaca nama header).'],
    ['Semua soal pilihan ganda 4 opsi (A–D): answer_type = option_new, opsi_e dan skor dikosongkan.'],
    ['Soal kasus memuat teks kasus di awal kolom soal karena SiAdu menyimpan soal satu per satu.'],
    ['Isi: ' + (isi === 'pembahasan' ? 'soal + jawaban + pembahasan' : 'soal + jawaban tanpa pembahasan') + ' · ' + soal.length + ' soal · paket ' + paket.map((p) => p.id).join(', ')],
  ];
  return xlsx([{ nama: 'SOAL', baris: [HEADER_SIADU, ...barisExcelSiadu(soal, isi)], lebar }, { nama: 'PETUNJUK', baris: petunjuk, lebar: [110] }]);
}
