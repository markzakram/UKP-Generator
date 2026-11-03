import { TINGKAT } from './config';
import type { Aturan, BankSoal, DataUkp, Jebakan, Konteks, Mapping, MateriData, ParameterData, Tingkat } from './types';

export interface DataMentah {
  bank: { soal: BankSoal[] };
  rules: { aturan: Aturan[] };
  mapping: Mapping;
  materi: MateriData;
  parameter?: ParameterData;
  konteks?: Konteks;
  jebakan?: Jebakan[];
  orisinal?: BankSoal[];
}

export const KONTEKS_KOSONG: Konteks = { kota: [], usaha: [], namaPt: [], namaOrang: [] };

export function susunData(m: DataMentah): DataUkp {
  return {
    bank: m.bank.soal,
    orisinal: m.orisinal ?? [],
    aturan: m.rules.aturan,
    mapping: m.mapping,
    materi: m.materi,
    parameter: m.parameter ?? {},
    konteks: m.konteks ?? KONTEKS_KOSONG,
    jebakan: m.jebakan ?? [],
  };
}

/** Tingkat efektif sebuah soal: override "KODE::Subtema" > override "KODE" > tingkat sumber. */
export function tingkatSoal(s: Pick<BankSoal, 'kode' | 'subtema' | 'tingkat'>, mapping: Mapping): Tingkat {
  return mapping.override[s.kode + '::' + s.subtema] ?? mapping.override[s.kode] ?? s.tingkat;
}
export const naik = (t: Tingkat) => TINGKAT.indexOf(t);
/** Cakupan kumulatif: soal tingkat A masuk paket A, B, dan C. */
export const dalamCakupan = (soal: Tingkat, paket: Tingkat) => naik(soal) <= naik(paket);

export const BERKAS_DATA = {
  bank: 'ukp-bank.json',
  rules: 'ukp-rules.json',
  mapping: 'ukp-mapping.json',
  materi: 'ukp-materi.json',
  parameter: 'ukp-parameter.json',
  konteks: 'ukp-konteks.json',
  jebakan: 'ukp-jebakan.json',
  orisinal: 'ukp-orisinal.json',
} as const;

/** Pemuat untuk browser: berkas disalin ke public/data oleh npm run import:data. */
export async function muatDataBrowser(base = '/data/'): Promise<DataUkp> {
  const ambil = async <T,>(nama: string, wajib: boolean): Promise<T | undefined> => {
    const res = await fetch(base + nama, { cache: 'no-cache' });
    if (!res.ok) {
      if (wajib) throw new Error('Data ' + nama + ' tidak dapat dimuat (' + res.status + '). Jalankan npm run import:data.');
      return undefined;
    }
    return res.json() as Promise<T>;
  };
  const [bank, rules, mapping, materi, parameter, konteks, jebakan, orisinal] = await Promise.all([
    ambil<DataMentah['bank']>(BERKAS_DATA.bank, true),
    ambil<DataMentah['rules']>(BERKAS_DATA.rules, true),
    ambil<Mapping>(BERKAS_DATA.mapping, true),
    ambil<MateriData>(BERKAS_DATA.materi, true),
    ambil<ParameterData>(BERKAS_DATA.parameter, false),
    ambil<Konteks>(BERKAS_DATA.konteks, false),
    ambil<Jebakan[]>(BERKAS_DATA.jebakan, false),
    ambil<BankSoal[]>(BERKAS_DATA.orisinal, false),
  ]);
  return susunData({ bank: bank!, rules: rules!, mapping: mapping!, materi: materi!, parameter, konteks, jebakan, orisinal });
}
