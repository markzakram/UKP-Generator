import type { Kode } from '../types';
import { rng } from '../util';
import { beaMeterai, tenggat } from './bm-kup';
import { MODEL_LANJUTAN } from './lanjutan';
import { pphOp, umkm } from './op';
import { pph21BukanPegawai, pph23, pph26P3b, pph42Sewa } from './pp';
import { ppnDpp, ppnTerutang } from './ppn';
import type { KonteksModel, ModelSoal } from './types';

// Daftar model soal berparameter (PRD bagian 9). Tahap 3: 10 model MVP. Tahap 5: 11 model lanjutan.
export const MODELS: ModelSoal[] = [pph23, pph42Sewa, pph21BukanPegawai, pph26P3b, ppnDpp, ppnTerutang, pphOp, umkm, beaMeterai, tenggat, ...MODEL_LANJUTAN];

export const modelUntuk = (kode: Kode) => MODELS.filter((m) => m.kode === kode);
export const modelById = (id: string) => MODELS.find((m) => m.id === id);
export const kodeBermodel = () => [...new Set(MODELS.map((m) => m.kode))];

// Kondisi yang bisa dibuat pada tanggal acuan. Model menolak bila parameter aturannya belum/tidak berlaku
// (PRD F5); kondisi itu tidak dihitung sebagai stok supaya kuota diisi bank, bukan gagal di tengah perakitan.
const cacheTersedia = new Map<string, boolean>();
export function kondisiTersedia(m: ModelSoal, ctx: KonteksModel): string[] {
  return m.kondisi.filter((k) => {
    const kunci = m.id + '|' + k + '|' + ctx.tanggalAcuan + '|' + ctx.data.bank.length;
    if (!cacheTersedia.has(kunci)) {
      try { m.buat(rng('cek-tersedia|' + kunci), ctx, k); cacheTersedia.set(kunci, true); }
      catch { cacheTersedia.set(kunci, false); }
    }
    return cacheTersedia.get(kunci)!;
  });
}
/** Kapasitas = kondisi tersedia × konteks (variasi angka saja tidak dihitung). */
export const kapasitasModel = (m: ModelSoal, ctx: KonteksModel) => kondisiTersedia(m, ctx).length * Math.max(1, m.jumlahKonteks(ctx));
