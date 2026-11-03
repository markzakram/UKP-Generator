import type { Mapping, Paket, Pengaturan } from '../types';
import { namaBerkas, type ModeIsi } from './common';
import { csvPaket, jsonPaket } from './data';
import { pdfPaket } from './pdf';
import { siaduExcel, siaduWord, soalAcuan } from './siadu';
import { htmlUji } from '../uji';
import { MIME, zip } from './unduh';
import { wordPaket } from './word';

export type FormatEkspor = 'pdf' | 'word' | 'siadu-word' | 'siadu-excel' | 'csv' | 'json' | 'uji-html';
export const LABEL_FORMAT: Record<FormatEkspor, string> = {
  pdf: 'PDF',
  word: 'Word biasa (penyuntingan naskah)',
  'siadu-word': 'Word SiAdu (importir Auto Input)',
  'siadu-excel': 'Excel SiAdu (template Bank Soal, sheet SOAL)',
  csv: 'CSV (bank, memuat kunci)',
  json: 'JSON (data + bukti model)',
  'uji-html': 'Berkas uji HTML untuk peserta (tanpa kunci)',
};
/** Isi dokumen yang tersedia per format. */
export const MODE_FORMAT: Partial<Record<FormatEkspor, ModeIsi[]>> = {
  pdf: ['naskah', 'kunci', 'soal-jawaban', 'lengkap'],
  word: ['naskah', 'kunci', 'soal-jawaban', 'lengkap'],
  'siadu-word': ['lengkap', 'soal-jawaban'],
  'siadu-excel': ['lengkap', 'soal-jawaban'],
};
export const FORMAT_SIADU: FormatEkspor[] = ['siadu-word', 'siadu-excel'];

export interface PermintaanEkspor {
  format: FormatEkspor;
  mode: ModeIsi;
  paket: Paket[];
  peng: Pengaturan;
  /** true = satu berkas untuk semua paket; false = ZIP per paket. */
  gabung: boolean;
  siadu?: Mapping['siadu'];
  /** Konfirmasi PRD K2: pengguna menyetujui ekspor SiAdu yang memuat soal acuan sumber LatihUKP. */
  setujuAcuan?: boolean;
}
export interface Berkas { nama: string; isi: Uint8Array; mime: string }

export class GalatAcuan extends Error {}

async function satu(req: PermintaanEkspor, paket: Paket[]): Promise<Berkas> {
  const { format, mode, peng } = req;
  const akhirMode = mode === 'lengkap' ? '' : '-' + mode;
  const isiSiadu = mode === 'soal-jawaban' ? 'soal-jawaban' : 'pembahasan';
  switch (format) {
    case 'pdf': return { nama: namaBerkas(peng, paket, akhirMode + '.pdf'), isi: pdfPaket(paket, peng, mode), mime: MIME.pdf };
    case 'word': return { nama: namaBerkas(peng, paket, akhirMode + '.docx'), isi: await wordPaket(paket, peng, mode), mime: MIME.docx };
    case 'siadu-word': return { nama: namaBerkas(peng, paket, '-siadu' + (isiSiadu === 'soal-jawaban' ? '-tanpa-pembahasan' : '') + '.docx'), isi: await siaduWord(paket, peng, isiSiadu, req.siadu), mime: MIME.docx };
    case 'siadu-excel': return { nama: namaBerkas(peng, paket, '-siadu' + (isiSiadu === 'soal-jawaban' ? '-tanpa-pembahasan' : '') + '.xlsx'), isi: siaduExcel(paket, isiSiadu), mime: MIME.xlsx };
    case 'csv': return { nama: namaBerkas(peng, paket, '.csv'), isi: csvPaket(paket), mime: MIME.csv };
    case 'json': return { nama: namaBerkas(peng, paket, '.json'), isi: jsonPaket(paket, peng), mime: MIME.json };
    case 'uji-html': {
      if (paket.length !== 1) throw new Error('Berkas uji HTML dibuat per paket.');
      return { nama: namaBerkas(peng, paket, '-uji.html'), isi: new TextEncoder().encode(htmlUji(paket[0], peng)), mime: MIME.html };
    }
  }
}

export async function buatBerkas(req: PermintaanEkspor): Promise<Berkas> {
  if (!req.paket.length || !req.paket.some((p) => p.soal.length)) throw new Error('Tidak ada soal untuk diekspor.');
  const izin = MODE_FORMAT[req.format];
  if (izin && !izin.includes(req.mode)) throw new Error('Isi "' + req.mode + '" tidak tersedia untuk format ' + LABEL_FORMAT[req.format] + '.');
  if (FORMAT_SIADU.includes(req.format) && !req.setujuAcuan) {
    const acuan = soalAcuan(req.paket).length;
    if (acuan) throw new GalatAcuan(acuan + ' soal berasal dari bank acuan LatihUKP (acuan internal, PRD K2). Konfirmasi dulu atau keluarkan soal acuan dari ekspor.');
  }
  if (req.paket.length === 1 || (req.gabung && req.format !== 'uji-html')) return satu(req, req.paket);
  const isi: Record<string, Uint8Array> = {};
  for (const p of req.paket) {
    const b = await satu(req, [p]);
    isi[b.nama] = b.isi;
  }
  return { nama: namaBerkas(req.peng, req.paket, '-' + req.format + '.zip'), isi: await zip(isi), mime: MIME.zip };
}

/** Keluarkan soal acuan sumber (bank/adaptasi); paket kosong dibuang. */
export const tanpaAcuan = (paket: Paket[]) => paket.map((p) => ({ ...p, soal: p.soal.filter((s) => s.asal === 'model' || s.asal === 'orisinal') })).filter((p) => p.soal.length);
