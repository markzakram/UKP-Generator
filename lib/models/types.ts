import type { Bloom, DataUkp, Huruf, Kesulitan, Kode, Opsi, Tingkat } from '../types';
import type { Rng } from '../util';

export interface KonteksModel {
  data: DataUkp;
  tanggalAcuan: string;
}

/** Soal hasil model sebelum masuk paket. Opsi boleh dalam urutan apa pun; generator yang mengacak/mengurutkan. */
export interface HasilModel {
  kondisi: string;
  konteks: string;
  params: Record<string, string | number | boolean>;
  kesulitan: Kesulitan;
  bloom: Bloom;
  tipe: string;
  subtopik: string;
  soal: string;
  opsi: Opsi;
  kunci: Huruf;
  /** Teks kunci hasil hitungan (sama dengan opsi kunci). */
  kunciModel: string;
  inti: string;
  langkah: string[];
  kenapaSalah: Partial<Record<Huruf, string>>;
  penyebabSalah: Partial<Record<Huruf, string>>;
  dasarHukum: string[];
  ruleIds: string[];
  poinIngat: string;
  catatanAturan?: string | null;
  opsiAngka: boolean;
}

export interface ModelSoal {
  id: string;
  nama: string;
  kode: Kode;
  subtema: string;
  tingkat: Tingkat;
  ringkas: string;
  /** Kondisi logika yang benar-benar mengubah jawaban. */
  kondisi: string[];
  kesulitan: (kondisi: string) => Kesulitan;
  /** Jumlah konteks usaha/entitas yang dipakai model. */
  jumlahKonteks: (ctx: KonteksModel) => number;
  buat: (r: Rng, ctx: KonteksModel, kondisi?: string) => HasilModel;
  /** Hitung ulang teks kunci dari params (pemeriksa hitung ulang, PRD F6). */
  hitungUlang: (params: HasilModel['params'], ctx: KonteksModel) => string;
}

export class GalatModel extends Error {}
