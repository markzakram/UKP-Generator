// Pemuat data untuk Node (CLI, pemeriksa, API). Jangan diimpor dari komponen browser.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BERKAS_DATA, susunData, type DataMentah } from './data';
import type { BankSoal, DataUkp } from './types';

export const ROOT = process.cwd();
export const FOLDER_DATA = path.join(ROOT, 'data');

const baca = <T,>(nama: string): T | undefined => {
  const file = path.join(FOLDER_DATA, nama);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined;
};

/** Bank orisinal: satu berkas JSON berisi larik soal per materi di data/ukp-kasus/. */
export function bacaOrisinal(folder = path.join(FOLDER_DATA, 'ukp-kasus')): BankSoal[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((f) => f.endsWith('.json')).sort().flatMap((f) => JSON.parse(readFileSync(path.join(folder, f), 'utf8')) as BankSoal[]);
}

export function muatDataNode(): DataUkp {
  const wajib = <T,>(nama: string) => {
    const isi = baca<T>(nama);
    if (!isi) throw new Error('Data ' + nama + ' tidak ada di ' + FOLDER_DATA + '. Jalankan npm run import:data.');
    return isi;
  };
  return susunData({
    bank: wajib<DataMentah['bank']>(BERKAS_DATA.bank),
    rules: wajib<DataMentah['rules']>(BERKAS_DATA.rules),
    mapping: wajib<DataMentah['mapping']>(BERKAS_DATA.mapping),
    materi: wajib<DataMentah['materi']>(BERKAS_DATA.materi),
    parameter: baca(BERKAS_DATA.parameter),
    konteks: baca(BERKAS_DATA.konteks),
    jebakan: baca(BERKAS_DATA.jebakan),
    orisinal: bacaOrisinal(),
  });
}
