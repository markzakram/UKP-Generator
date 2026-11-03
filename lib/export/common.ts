import { HURUF, LABEL_KESULITAN, NAMA_APLIKASI } from '../config';
import type { Paket, Pengaturan, Soal } from '../types';
import { tanggal } from '../util';

/** naskah = tanpa kunci; kunci = daftar kunci saja; soal-jawaban = soal + jawaban; lengkap = soal + jawaban + pembahasan. */
export type ModeIsi = 'naskah' | 'kunci' | 'soal-jawaban' | 'lengkap';
export const LABEL_MODE: Record<ModeIsi, string> = {
  naskah: 'Naskah soal tanpa kunci',
  kunci: 'Kunci jawaban saja',
  'soal-jawaban': 'Soal + jawaban tanpa pembahasan',
  lengkap: 'Soal + jawaban + pembahasan',
};

export type Blok =
  | { k: 'judul'; teks: string }
  | { k: 'meta'; teks: string }
  | { k: 'kasus'; teks: string }
  | { k: 'soal'; nomor: number; teks: string }
  | { k: 'opsi'; huruf: string; teks: string }
  | { k: 'jawaban'; teks: string }
  | { k: 'label'; teks: string }
  | { k: 'para'; teks: string; tebal?: string }
  | { k: 'daftar'; items: string[]; bernomor: boolean }
  | { k: 'tabelKunci'; baris: [string, string][] }
  | { k: 'jarak' }
  | { k: 'halamanBaru' };

/** Kasus ditampilkan di atas soal pertama bloknya, atau bila teksnya berbeda dari soal sebelumnya. */
export function tampilkanKasus(soal: Soal[], i: number): boolean {
  const s = soal[i];
  if (!s.kasus) return false;
  const sebelum = soal[i - 1];
  return !sebelum || sebelum.kasusId !== s.kasusId || sebelum.kasus !== s.kasus;
}

export function pembahasanBlok(s: Soal): Blok[] {
  const b: Blok[] = [{ k: 'label', teks: 'Pembahasan:' }, { k: 'para', tebal: 'Inti. ', teks: s.inti }];
  if (s.langkah.length) b.push({ k: 'daftar', items: s.langkah, bernomor: true });
  const salah = HURUF.filter((h) => h !== s.kunci && s.kenapaSalah[h]).map((h) => h + '. ' + s.kenapaSalah[h]);
  if (salah.length) { b.push({ k: 'para', tebal: 'Mengapa opsi lain salah:', teks: '' }); b.push({ k: 'daftar', items: salah, bernomor: false }); }
  if (s.dasarHukum.length) b.push({ k: 'para', tebal: 'Dasar hukum: ', teks: s.dasarHukum.join('; ') });
  if (s.poinIngat) b.push({ k: 'para', tebal: 'Poin ingat: ', teks: s.poinIngat });
  return b;
}

export function blokDokumen(paket: Paket[], peng: Pick<Pengaturan, 'judul' | 'tingkat' | 'durasi' | 'tanggalAcuan'>, mode: ModeIsi): Blok[] {
  const b: Blok[] = [];
  paket.forEach((p, ip) => {
    if (ip > 0) b.push({ k: 'halamanBaru' });
    b.push({ k: 'judul', teks: peng.judul + ' · Tingkat ' + peng.tingkat + ' · ' + p.id });
    b.push({ k: 'meta', teks: p.soal.length + ' soal · ' + peng.durasi + ' menit · aturan per ' + tanggal(peng.tanggalAcuan) + ' · ' + LABEL_MODE[mode] });
    if (mode === 'kunci') {
      b.push({ k: 'tabelKunci', baris: p.soal.map((s, i) => [String(i + 1), s.kunci]) });
      return;
    }
    p.soal.forEach((s, i) => {
      b.push({ k: 'jarak' });
      if (tampilkanKasus(p.soal, i)) b.push({ k: 'kasus', teks: s.kasus! });
      b.push({ k: 'soal', nomor: i + 1, teks: s.soal });
      for (const h of HURUF) b.push({ k: 'opsi', huruf: h, teks: s.opsi[h] });
      if (mode === 'soal-jawaban' || mode === 'lengkap') b.push({ k: 'jawaban', teks: 'Jawaban: ' + s.kunci });
      if (mode === 'lengkap') b.push(...pembahasanBlok(s));
    });
  });
  return b;
}

export const slug = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'ukp';
export const namaBerkas = (peng: Pick<Pengaturan, 'seed'>, paket: Paket[], akhiran: string) =>
  slug(peng.seed) + '-' + (paket.length === 1 ? paket[0].id.toLowerCase() : paket.length + '-paket') + akhiran;

export const labelAsal = (s: Soal) => (s.asal === 'model' ? 'Soal baru · model ' + s.modelId : s.asal === 'adaptasi' ? 'Adaptasi · ' + s.sumberId : s.asal === 'orisinal' ? 'Bank orisinal · ' + s.sumberId : 'Acuan sumber · ' + s.sumberId);
export const labelKesulitan = (s: Soal) => LABEL_KESULITAN[s.kesulitan];
export const PEMBUAT = NAMA_APLIKASI;

/** jsPDF memakai font standar (WinAnsi): karakter di luarnya diganti padanan ASCII. */
const GANTI_PDF: Record<string, string> = { '→': '->', '←': '<-', '⇒': '=>', '≤': '<=', '≥': '>=', '−': '-', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...', '≠': '!=', '✓': 'v', '≈': '~', '√': 'akar ', '∑': 'jumlah ', ' ': ' ' };
export const amanPdf = (t: string) => t.replace(/[^\x00-\xff]/g, (c) => GANTI_PDF[c] ?? '?').replace(/[–—‘’“”•… ]/g, (c) => GANTI_PDF[c] ?? c);
