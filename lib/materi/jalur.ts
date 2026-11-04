// Hierarki berkas unduhan deck materi: Tingkat / Materi / Subtema. Dipakai tab Materi, CLI, dan silabus supaya sama.
import { CAKUPAN_TINGKAT } from '../config';
import { slug } from '../export/common';
import type { DataUkp, Tingkat } from '../types';
import { daftarSubtema } from './susun';

export interface HierarkiDeck {
  tingkat: Tingkat;
  /** Hanya subtema yang mulai di tingkat ini. */
  tambahan: boolean;
  materi: { kode: string; nama: string; subtema: string[] }[];
}
export type JenisBerkasDeck = 'pptx' | 'handout' | 'naskah';

/** Aman sebagai nama folder dan berkas di Windows, macOS, dan Linux: "P3B: residensi" → "P3B - residensi", "25/29" → "25-29". */
export function namaAman(teks: string) {
  return teks.replace(/\s*:\s*/g, ' - ').replace(/[\\/]/g, '-').replace(/[*?"<>|]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
}
const nomor = (i: number) => String(i + 1).padStart(2, '0');

export const folderTingkat = (t: Tingkat, tambahan = false) =>
  'Tingkat ' + t + (t === 'A' ? '' : ` (${tambahan ? 'hanya subtema baru' : CAKUPAN_TINGKAT[t]})`);

/** Nama deck gabungan satu materi; sama di unduhan tunggal, zip, CLI, dan kolom Deck silabus. */
export const namaDeckGabungan = (kode: string, tingkat: Tingkat, tambahan: boolean, jenis: JenisBerkasDeck = 'pptx') => {
  const dasar = `${slug(kode)}-tingkat-${tingkat.toLowerCase()}${tambahan ? '-tambahan' : ''}`;
  return jenis === 'naskah' ? `naskah-${dasar}.json` : `materi-${dasar}${jenis === 'handout' ? '-handout' : ''}.pptx`;
};

/** Materi dan subtema dalam cakupan tingkat, urut seperti pemetaan. Nomor folder dan berkas mengikuti urutan ini. */
export function hierarkiDeck(data: DataUkp, tingkat: Tingkat, tanggalAcuan: string, tambahan = false): HierarkiDeck {
  const baru = tambahan && tingkat !== 'A';
  const cakupan = daftarSubtema(data, tingkat, tanggalAcuan).filter((s) => !baru || s.tingkat === tingkat);
  const materi = data.mapping.materi.map((m) => {
    const ada = cakupan.filter((s) => s.kode === m.kode).map((s) => s.subtema);
    const urut = m.subtema.filter((s) => ada.includes(s));
    return { kode: m.kode as string, nama: m.nama, subtema: [...urut, ...ada.filter((s) => !urut.includes(s))] };
  }).filter((m) => m.subtema.length);
  return { tingkat, tambahan: baru, materi };
}

/** "Tingkat B (A+B)/06 AKT - Akuntansi Perpajakan". Materi di luar cakupan masuk folder Lainnya. */
export function folderMateri(h: HierarkiDeck, kode: string) {
  const i = h.materi.findIndex((m) => m.kode === kode);
  const nama = i < 0 ? 'Lainnya' : `${nomor(i)} ${kode} - ${namaAman(h.materi[i].nama)}`;
  return folderTingkat(h.tingkat, h.tambahan) + '/' + nama;
}

/**
 * Jalur satu berkas di dalam hierarki. `subtema` null = deck gabungan per materi, yang namanya tetap
 * seperti unduhan tunggal; deck per subtema memakai nomor urut dan nama subtema yang terbaca.
 */
export function jalurBerkasDeck(h: HierarkiDeck, kode: string, subtema: string | null, jenis: JenisBerkasDeck = 'pptx') {
  const folder = folderMateri(h, kode);
  if (subtema === null) return `${folder}/${namaDeckGabungan(kode, h.tingkat, h.tambahan, jenis)}`;
  const i = h.materi.find((m) => m.kode === kode)?.subtema.indexOf(subtema) ?? -1;
  const dasar = `${folder}/${i < 0 ? '' : nomor(i) + ' '}${namaAman(subtema)}`;
  return dasar + (jenis === 'naskah' ? ' - naskah.json' : jenis === 'handout' ? ' - handout.pptx' : '.pptx');
}
