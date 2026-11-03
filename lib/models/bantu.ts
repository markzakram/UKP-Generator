// Alat bantu bersama model soal baru: konteks fiktif, pilihan pengecoh, dan perakitan HasilModel.
import { angkaPada, nilaiPada, nilaiSebelumnya } from '../parameter';
import type { Huruf, Opsi } from '../types';
import { buatTanggal, isoTanggal, rupiah, tanggal, type Rng } from '../util';
import { GalatModel, type HasilModel, type KonteksModel } from './types';

export const param = (ctx: KonteksModel, kunci: string, pada = ctx.tanggalAcuan) => angkaPada(ctx.data.parameter, kunci, pada);
export const paramRaw = (ctx: KonteksModel, kunci: string, pada = ctx.tanggalAcuan) => nilaiPada(ctx.data.parameter, kunci, pada);
export const paramLama = (ctx: KonteksModel, kunci: string, pada = ctx.tanggalAcuan) => nilaiSebelumnya(ctx.data.parameter, kunci, pada);
export const dasar = (ctx: KonteksModel, kunci: string, pada = ctx.tanggalAcuan) => paramRaw(ctx, kunci, pada).dasar;

/** Pilih satu konteks usaha + kota secara deterministik; indeks konteks menjadi bagian tanda kembar. */
export function konteksUsaha(r: Rng, ctx: KonteksModel) {
  const k = ctx.data.konteks;
  if (!k.usaha.length || !k.kota.length || !k.namaPt.length) throw new GalatModel('data/ukp-konteks.json kosong.');
  const iu = r.int(0, k.usaha.length - 1);
  return { indeks: iu, usaha: k.usaha[iu], kota: r.pick(k.kota) };
}
/** Nama badan fiktif dari dua kata umum, misalnya "PT Sinar Lestari". */
export function namaBadan(r: Rng, ctx: KonteksModel, bentuk: 'PT' | 'CV' = 'PT', hindari: string[] = []) {
  const n = ctx.data.konteks.namaPt;
  for (let i = 0; i < 20; i++) {
    const a = r.pick(n), b = r.pick(n);
    const nama = bentuk + ' ' + a + ' ' + b;
    if (a !== b && !hindari.includes(nama)) return nama;
  }
  return bentuk + ' ' + n[0] + ' ' + n[1];
}
export const namaOrang = (r: Rng, ctx: KonteksModel) => r.pick(ctx.data.konteks.namaOrang);

/** Bulan transaksi: 1–5 bulan sebelum tanggal acuan, supaya aturan yang berlaku jelas. */
export function bulanTransaksi(r: Rng, ctx: KonteksModel) {
  const [y, m] = ctx.tanggalAcuan.split('-').map(Number);
  const mundur = r.int(1, 5);
  const d = buatTanggal(y, m - mundur, 1);
  const hari = r.int(3, 26);
  const t = buatTanggal(d.getUTCFullYear(), d.getUTCMonth() + 1, hari);
  return { tahun: t.getUTCFullYear(), bulan: t.getUTCMonth() + 1, hari, iso: isoTanggal(t), teks: tanggal(isoTanggal(t)) };
}

export interface Kandidat { nilai: number; alasan: string; penyebab: string }

/**
 * Pilih 3 pengecoh angka yang berbeda dari kunci dan satu sama lain. Kandidat diacak lalu diambil yang pertama
 * lolos, dengan usaha agar ada pengecoh di atas dan di bawah kunci (posisi kunci setelah diurutkan bervariasi).
 */
export function pilihPengecoh(r: Rng, kunci: number, kandidat: Kandidat[], fmt: (n: number) => string = rupiah, bolehNegatif = false): Kandidat[] {
  const unik: Kandidat[] = [];
  const lihat = new Set([fmt(kunci)]);
  for (const k of r.shuffle(kandidat)) {
    if (!Number.isFinite(k.nilai) || (!bolehNegatif && k.nilai < 0)) continue;
    const t = fmt(k.nilai);
    if (lihat.has(t)) continue;
    lihat.add(t); unik.push(k);
  }
  if (unik.length < 3) throw new GalatModel('Pengecoh kurang dari 3 untuk kunci ' + fmt(kunci) + '.');
  const bawah = unik.filter((k) => k.nilai < kunci), atas = unik.filter((k) => k.nilai > kunci);
  // Variasikan posisi kunci: target jumlah pengecoh di bawah kunci 0–3, disesuaikan dengan yang tersedia.
  const target = Math.min(bawah.length, Math.max(3 - atas.length, r.int(0, 3)));
  return [...bawah.slice(0, target), ...atas.slice(0, 3 - target)];
}

/** Susun opsi: kunci di A, pengecoh B–D (generator yang mengurutkan/mengacak). */
export function opsiDari(kunciTeks: string, pengecoh: { teks: string; alasan: string; penyebab: string }[]) {
  const huruf: Huruf[] = ['B', 'C', 'D'];
  const opsi = { A: kunciTeks } as Opsi;
  const kenapaSalah: Partial<Record<Huruf, string>> = {}, penyebabSalah: Partial<Record<Huruf, string>> = {};
  pengecoh.forEach((p, i) => { opsi[huruf[i]] = p.teks; kenapaSalah[huruf[i]] = p.alasan; penyebabSalah[huruf[i]] = p.penyebab; });
  return { opsi, kunci: 'A' as Huruf, kenapaSalah, penyebabSalah };
}

export function hasilAngka(dasarHasil: Omit<HasilModel, 'opsi' | 'kunci' | 'kenapaSalah' | 'penyebabSalah' | 'kunciModel' | 'opsiAngka'>, r: Rng, kunci: number, kandidat: Kandidat[], fmt: (n: number) => string = rupiah): HasilModel {
  const p = pilihPengecoh(r, kunci, kandidat, fmt);
  const o = opsiDari(fmt(kunci), p.map((k) => ({ teks: fmt(k.nilai), alasan: k.alasan, penyebab: k.penyebab })));
  return { ...dasarHasil, ...o, kunciModel: fmt(kunci), opsiAngka: true };
}

/** Kelipatan acak: kel × [min, max]. */
export const kelipatan = (r: Rng, min: number, max: number, kel: number) => kel * r.int(Math.ceil(min / kel), Math.floor(max / kel));
export const bulatBawahRibu = (n: number) => Math.floor(n / 1000) * 1000;

/** PPh Pasal 17 berlapis. `lapisan` = [[batasAtas|null, tarif], ...]. */
export function pph17(pkp: number, lapisan: [number | null, number][]) {
  let sisa = pkp, bawah = 0, total = 0;
  const rinci: { dari: number; sampai: number; tarif: number; pajak: number }[] = [];
  for (const [atas, tarif] of lapisan) {
    if (sisa <= 0) break;
    const lebar = atas === null ? sisa : Math.min(sisa, atas - bawah);
    const pajak = Math.round(lebar * tarif);
    rinci.push({ dari: bawah, sampai: bawah + lebar, tarif, pajak });
    total += pajak; sisa -= lebar; bawah = atas ?? bawah + lebar;
  }
  return { total, rinci };
}
export const lapisan17 = (ctx: KonteksModel, pada = ctx.tanggalAcuan) => paramRaw(ctx, 'pph17.lapisan', pada).nilai as [number | null, number][];
export const lapisan17Lama = (ctx: KonteksModel) => (paramLama(ctx, 'pph17.lapisan')?.nilai ?? null) as [number | null, number][] | null;
