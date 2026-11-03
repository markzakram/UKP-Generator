import { HURUF, TINGKAT, URUTAN_KODE } from './config';
import type { BankSoal, DataUkp, Soal } from './types';
import { normalTeks } from './util';

type SoalStruktur = Pick<BankSoal, 'id' | 'kode' | 'tingkat' | 'soal' | 'opsi' | 'kunci' | 'kasusId' | 'kasus' | 'inti' | 'kenapaSalah' | 'dasarHukum'>;

/** Kesalahan struktur yang membuat soal tidak boleh dipakai atau diekspor. */
export function galatStruktur(s: SoalStruktur): string[] {
  const galat: string[] = [];
  if (!URUTAN_KODE.includes(s.kode)) galat.push('kode materi tidak dikenal: ' + s.kode);
  if (!TINGKAT.includes(s.tingkat)) galat.push('tingkat tidak dikenal: ' + s.tingkat);
  if (!s.soal?.trim()) galat.push('batang soal kosong');
  for (const h of HURUF) if (!s.opsi?.[h]?.trim()) galat.push('opsi ' + h + ' kosong');
  if (new Set(HURUF.map((h) => normalTeks(s.opsi?.[h] ?? ''))).size < 4) galat.push('ada opsi yang sama');
  if (!HURUF.includes(s.kunci)) galat.push('kunci bukan A–D');
  if (s.kasusId && !s.kasus?.trim()) galat.push('soal kasus tanpa teks kasus');
  if (!s.inti?.trim()) galat.push('pembahasan inti kosong');
  return galat;
}

export function galatSoalPaket(s: Soal): string[] {
  const galat = galatStruktur({ ...s, id: s.uid });
  if (s.urutanAsal.length !== 4 || new Set(s.urutanAsal).size !== 4) galat.push('urutan opsi asal tidak lengkap');
  return galat;
}

export interface LaporanValidasiData {
  galat: string[];
  peringatan: string[];
  blok: number;
}

/** Pemeriksaan keutuhan data hasil impor (dipakai verify dan saat aplikasi dimuat). */
export function validasiData(data: DataUkp): LaporanValidasiData {
  const galat: string[] = [], peringatan: string[] = [];
  const semua = [...data.bank, ...data.orisinal];
  const id = new Set<string>();
  for (const s of semua) {
    if (id.has(s.id)) galat.push('id ganda: ' + s.id);
    id.add(s.id);
    for (const g of galatStruktur(s)) galat.push(s.id + ': ' + g);
  }
  const aturan = new Set(data.aturan.map((a) => a.id));
  for (const s of semua) for (const r of s.ruleIds) if (!aturan.has(r)) galat.push(s.id + ': rujukan aturan ' + r + ' tidak ada');
  const subtema = new Map(data.mapping.materi.map((m) => [m.kode, new Set(m.subtema)]));
  for (const s of semua) if (s.subtema !== 'Lainnya' && !subtema.get(s.kode)?.has(s.subtema)) galat.push(s.id + ': subtema "' + s.subtema + '" tidak ada di mapping');
  const blok = new Map<string, BankSoal[]>();
  for (const s of semua) if (s.kasusId) blok.set(s.kasusId, [...(blok.get(s.kasusId) ?? []), s]);
  for (const [k, anggota] of blok) {
    if (new Set(anggota.map((s) => s.kode)).size > 1) galat.push('kasus ' + k + ' berisi lebih dari satu materi');
    if (anggota.length < 2) peringatan.push('kasus ' + k + ' hanya berisi ' + anggota.length + ' soal');
  }
  return { galat, peringatan, blok: blok.size };
}
