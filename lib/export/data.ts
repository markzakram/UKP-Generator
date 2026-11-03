import { HURUF } from '../config';
import type { Paket, Pengaturan } from '../types';
import { labelAsal } from './common';

const sel = (v: unknown) => {
  const t = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};

/** CSV lengkap (memuat kunci). BOM supaya Excel membaca UTF-8. */
export function csvPaket(paket: Paket[]): Uint8Array {
  const kepala = ['paket', 'no', 'uid', 'asal', 'sumber_id', 'model_id', 'kode', 'materi', 'subtema', 'subtopik', 'tingkat', 'tipe', 'bloom', 'kesulitan', 'kasus_id', 'kasus', 'soal',
    ...HURUF.map((h) => 'opsi_' + h.toLowerCase()), 'kunci', 'inti', 'langkah', ...HURUF.map((h) => 'alasan_' + h.toLowerCase()), ...HURUF.map((h) => 'penyebab_' + h.toLowerCase()),
    'dasar_hukum', 'rule_ids', 'poin_ingat', 'revisi', 'disunting', 'checksum'];
  const baris = [kepala.join(',')];
  for (const p of paket) p.soal.forEach((s, i) => {
    baris.push([p.id, i + 1, s.uid, labelAsal(s), s.sumberId, s.modelId, s.kode, s.materi, s.subtema, s.subtopik, s.tingkat, s.tipe, s.bloom, s.kesulitan, s.kasusId, s.kasus, s.soal,
      ...HURUF.map((h) => s.opsi[h]), s.kunci, s.inti, s.langkah.join(' | '), ...HURUF.map((h) => s.kenapaSalah[h] ?? ''), ...HURUF.map((h) => s.penyebabSalah[h] ?? ''),
      s.dasarHukum.join(' | '), s.ruleIds.join(' | '), s.poinIngat, s.revisi, s.disunting, s.checksum].map(sel).join(','));
  });
  return new TextEncoder().encode('﻿' + baris.join('\r\n') + '\r\n');
}

/** JSON terstruktur beserta pengaturan dan bukti model. */
export function jsonPaket(paket: Paket[], peng: Pengaturan): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ format: 'ukp-studio-paket', versi: 1, dibuat: new Date().toISOString(), pengaturan: peng, paket }, null, 2));
}
