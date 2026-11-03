// Cadangan lengkap untuk tim (R12): satu berkas JSON berisi semua paket, deck materi (termasuk hasil telaah),
// dan sesi uji peserta di browser ini, untuk dibagikan lewat Drive atau WhatsApp tanpa server.
// Impor menggabungkan: data baru ditambah, data ber-id sama diganti hanya bila versi di berkas lebih baru.
// Logika murni; penyimpanan IndexedDB ada di lib/storage.ts.
import { bacaNaskah, type DeckMateri } from './materi/deck';
import type { Workspace } from './types';
import { bacaCadangan } from './workspace';

export interface CadanganLengkap {
  format: 'ukp-studio-cadangan-lengkap';
  versi: 1;
  dibuat: string;
  /** Nama orang atau perangkat yang membuat cadangan (opsional). */
  oleh?: string;
  workspaces: Workspace[];
  materi: DeckMateri[];
  sesiUji: { id: string; [k: string]: unknown }[];
}

export const FORMAT_LENGKAP = 'ukp-studio-cadangan-lengkap';

export function buatCadanganLengkap(isi: Pick<CadanganLengkap, 'workspaces' | 'materi' | 'sesiUji'>, dibuat: string, oleh?: string): CadanganLengkap {
  return { format: FORMAT_LENGKAP, versi: 1, dibuat, ...(oleh ? { oleh } : {}), workspaces: isi.workspaces, materi: isi.materi, sesiUji: isi.sesiUji };
}

/** Apakah teks JSON ini cadangan lengkap (bukan cadangan satu paket)? */
export function cadanganLengkapKah(teks: string): boolean {
  try { return (JSON.parse(teks) as { format?: string })?.format === FORMAT_LENGKAP; } catch { return false; }
}

/** Baca dan periksa cadangan lengkap; galat menyebut bagian yang rusak. */
export function bacaCadanganLengkap(teks: string): CadanganLengkap {
  let c: Partial<CadanganLengkap>;
  try { c = JSON.parse(teks); } catch { throw new Error('Berkas bukan JSON yang valid.'); }
  if (c?.format !== FORMAT_LENGKAP) throw new Error('Berkas bukan cadangan lengkap UKP Studio.');
  if (c.versi !== 1) throw new Error('Versi cadangan lengkap tidak dikenal.');
  const workspaces = (Array.isArray(c.workspaces) ? c.workspaces : []).map((w, i) => {
    try { return bacaCadangan(JSON.stringify({ format: 'ukp-studio-cadangan', versi: 1, dibuat: c.dibuat, workspace: w })); }
    catch (e) { throw new Error(`Paket ke-${i + 1} (${(w as Workspace)?.judul ?? '?'}): ${(e as Error).message}`); }
  });
  const materi = (Array.isArray(c.materi) ? c.materi : []).map((d, i) => {
    if (!d || typeof d.id !== 'string' || !d.id || !d.naskah || !d.asli) throw new Error(`Deck materi ke-${i + 1} tidak lengkap.`);
    try {
      return { ...d, naskah: bacaNaskah(JSON.stringify(d.naskah)), asli: bacaNaskah(JSON.stringify(d.asli)), status: d.status === 'telaah' ? 'telaah' as const : 'draf' as const, riwayat: Array.isArray(d.riwayat) ? d.riwayat : [] };
    } catch (e) { throw new Error(`Deck materi ${d.id}: ${(e as Error).message}`); }
  });
  const sesiUji = (Array.isArray(c.sesiUji) ? c.sesiUji : []).filter((s) => s && typeof s.id === 'string');
  return { format: FORMAT_LENGKAP, versi: 1, dibuat: typeof c.dibuat === 'string' ? c.dibuat : '', ...(c.oleh ? { oleh: c.oleh } : {}), workspaces, materi, sesiUji };
}

export interface RencanaGabung<T> { simpan: T[]; baru: number; diganti: number; tetap: number }

/** Gabungkan isi berkas dengan data di browser: id baru ditambah, id sama diganti bila `waktu` di berkas lebih baru. */
export function rencanaGabung<T extends { id: string }>(ada: T[], masuk: T[], waktu: (x: T) => string = () => ''): RencanaGabung<T> {
  const peta = new Map(ada.map((x) => [x.id, x]));
  const hasil: RencanaGabung<T> = { simpan: [], baru: 0, diganti: 0, tetap: 0 };
  for (const m of masuk) {
    const lama = peta.get(m.id);
    if (!lama) { hasil.simpan.push(m); hasil.baru++; }
    else if (waktu(m) > waktu(lama)) { hasil.simpan.push(m); hasil.diganti++; }
    else hasil.tetap++;
  }
  return hasil;
}
