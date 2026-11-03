import { GalatModel } from './models/types';
import type { NilaiParameter, ParameterData } from './types';

/** Nilai parameter yang berlaku pada tanggal (YYYY-MM-DD). Tidak ada nilai = galat, bukan tebakan. */
export function nilaiPada(param: ParameterData, kunci: string, tanggal: string): NilaiParameter {
  const p = param[kunci];
  if (!p) throw new GalatModel('Parameter ' + kunci + ' tidak ada di data/ukp-parameter.json.');
  const cocok = p.riwayat.find((r) => r.mulai <= tanggal && (!r.sampai || r.sampai >= tanggal));
  if (!cocok) throw new GalatModel('Parameter ' + kunci + ' belum punya nilai yang berlaku pada ' + tanggal + '.');
  return cocok;
}
export const angkaPada = (param: ParameterData, kunci: string, tanggal: string) => {
  const n = nilaiPada(param, kunci, tanggal).nilai;
  if (typeof n !== 'number') throw new GalatModel('Parameter ' + kunci + ' bukan angka.');
  return n;
};
/** Nilai sebelum yang berlaku sekarang (untuk pengecoh "aturan lama"); null bila tidak ada. */
export function nilaiSebelumnya(param: ParameterData, kunci: string, tanggal: string): NilaiParameter | null {
  const p = param[kunci];
  if (!p) return null;
  const kini = nilaiPada(param, kunci, tanggal);
  const lama = p.riwayat.filter((r) => r.mulai < kini.mulai).sort((a, b) => b.mulai.localeCompare(a.mulai));
  return lama[0] ?? null;
}
