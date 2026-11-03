import { HURUF } from './config';
import type { Soal } from './types';

/** Teks polos satu soal untuk clipboard (bisa ditempel ke Word/Google Docs). */
export function teksSalin(s: Soal, nomor: number, denganKunci: boolean, denganKasus = true): string {
  const b: string[] = [];
  if (denganKasus && s.kasus) b.push('Kasus: ' + s.kasus, '');
  b.push(nomor + '. ' + s.soal);
  for (const h of HURUF) b.push(h + '. ' + s.opsi[h]);
  if (denganKunci) {
    b.push('', 'Jawaban: ' + s.kunci, 'Pembahasan:', 'Inti. ' + s.inti);
    s.langkah.forEach((l, i) => b.push(i + 1 + '. ' + l));
    for (const h of HURUF) if (h !== s.kunci && s.kenapaSalah[h]) b.push('Opsi ' + h + ' salah: ' + s.kenapaSalah[h]);
    if (s.dasarHukum.length) b.push('Dasar hukum: ' + s.dasarHukum.join('; '));
    if (s.poinIngat) b.push('Poin ingat: ' + s.poinIngat);
  }
  return b.join('\n');
}
