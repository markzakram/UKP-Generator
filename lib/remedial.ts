// Materi ↔ latihan (R8): saran remedial per subtema dari statistik Uji peserta, dan paket latihan per subtema
// yang dirakit dari deck materi atau dari saran remedial.
import { KOMPOSISI_TINGKAT } from './config';
import { tingkatSubtema } from './data';
import { buatPaket, GalatPersediaan, type HasilGenerate } from './generate';
import type { DataUkp, Kode, Paket, Pengaturan, Tingkat } from './types';
import type { StatPaket } from './uji';

/** Subtema disarankan diulang bila proporsi jawaban benar di bawah batas ini (aturan awal proyek). */
export const BATAS_REMEDIAL = 0.6;
/** Respons minimal per subtema sebelum saran remedial ditampilkan. */
export const MIN_RESPONS_REMEDIAL = 5;
/** Ukuran paket latihan yang dicoba berurutan; turun bila stok subtema tidak cukup. */
export const UKURAN_LATIHAN = [20, 15, 10, 5] as const;

export interface SaranRemedial {
  kode: Kode;
  subtema: string;
  tingkat: Tingkat | null;
  soal: number;
  respons: number;
  benar: number;
  p: number;
  /** Nomor soal di paket. */
  nomor: number[];
}

/** Gabungkan statistik butir per subtema, lalu ambil subtema dengan proporsi benar terendah di bawah batas. */
export function saranRemedial(data: DataUkp, paket: Paket, stat: StatPaket, batas = BATAS_REMEDIAL, minRespons = MIN_RESPONS_REMEDIAL): SaranRemedial[] {
  const peta = new Map<string, SaranRemedial>();
  stat.butir.forEach((b, i) => {
    const s = paket.soal[i];
    if (!s || !b.n || s.subtema === 'Lainnya') return;
    const k = s.kode + '::' + s.subtema;
    const e = peta.get(k) ?? { kode: s.kode, subtema: s.subtema, tingkat: tingkatSubtema(s.kode, s.subtema, data.mapping), soal: 0, respons: 0, benar: 0, p: 0, nomor: [] };
    e.soal++; e.respons += b.n; e.benar += b.benar; e.nomor.push(b.nomor);
    peta.set(k, e);
  });
  return [...peta.values()].map((e) => ({ ...e, p: e.benar / e.respons }))
    .filter((e) => e.respons >= minRespons && e.p < batas)
    .sort((a, b) => a.p - b.p || b.respons - a.respons);
}

/** Pengaturan paket latihan jenis subtema; pengaturan tryout pengguna (`dasar`) tidak diubah. */
export function pengaturanLatihan(dasar: Pengaturan, subtema: string[], tingkat: Tingkat, jumlahSoal: number, seed = dasar.seed + '-LATIHAN'): Pengaturan {
  const materi = [...new Set(subtema.map((s) => s.split('::')[0]))] as Kode[];
  return {
    ...dasar, judul: 'Latihan UKP · ' + (subtema.length === 1 ? subtema[0].split('::').slice(1).join('::') : subtema.length + ' subtema'),
    tingkat, jenis: 'subtema', materi, subtema, jumlahSoal, jumlahPaket: 1, durasi: Math.max(10, Math.round(jumlahSoal * 1.8)),
    komposisi: { ...KOMPOSISI_TINGKAT[tingkat] }, kuota: null, seed,
  };
}

/** Rakit paket latihan; ukuran turun 20 → 15 → 10 → 5 soal bila stok subtema tidak cukup. */
export function rakitLatihan(data: DataUkp, dasar: Pengaturan, subtema: string[], tingkat: Tingkat, seed?: string): { peng: Pengaturan; hasil: HasilGenerate } {
  if (!subtema.length) throw new Error('Pilih minimal satu subtema untuk latihan.');
  let galat: unknown = null;
  for (const n of UKURAN_LATIHAN) {
    const peng = pengaturanLatihan(dasar, subtema, tingkat, n, seed);
    try { return { peng, hasil: buatPaket(data, peng) }; } catch (e) { if (!(e instanceof GalatPersediaan)) throw e; galat = e; }
  }
  throw galat;
}
