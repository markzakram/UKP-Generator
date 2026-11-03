import { BATAS, HURUF } from './config';
import { checksumSoal } from './soal';
import type { Paket, Pengaturan, Snapshot, Soal, Workspace } from './types';
import { idAcak } from './util';

const sekarang = () => new Date().toISOString();

export function buatWorkspace(peng: Pengaturan, paket: Paket[]): Workspace {
  const t = sekarang();
  return { versi: 1, id: idAcak('ws'), judul: peng.judul + ' · ' + peng.seed, dibuat: t, diperbarui: t, pengaturan: peng, paket, riwayat: [] };
}

/** Simpan keadaan sebelum perubahan ke riwayat (paling banyak 20 snapshot). */
export function denganPerubahan(ws: Workspace, paket: Paket[], keterangan: string): Workspace {
  const snap: Snapshot = { id: idAcak('snap'), waktu: sekarang(), keterangan, paket: ws.paket };
  return { ...ws, paket, diperbarui: sekarang(), riwayat: [snap, ...ws.riwayat].slice(0, BATAS.riwayat) };
}

/** Memulihkan snapshot membuat versi baru; keadaan saat ini tetap masuk riwayat. */
export function pulihkan(ws: Workspace, idSnapshot: string): Workspace {
  const snap = ws.riwayat.find((s) => s.id === idSnapshot);
  if (!snap) throw new Error('Snapshot tidak ditemukan.');
  return denganPerubahan(ws, snap.paket, 'Pulihkan versi ' + new Date(snap.waktu).toLocaleString('id-ID'));
}

/** Sunting satu soal: revisi naik, bukti model batal (dicatat di pemeriksa mutu). */
export function suntingSoal(ws: Workspace, indeksPaket: number, uid: string, ubah: Partial<Pick<Soal, 'kasus' | 'soal' | 'opsi' | 'kunci' | 'inti' | 'langkah' | 'kenapaSalah' | 'dasarHukum' | 'poinIngat'>>): Workspace {
  const paket = ws.paket.map((p, i) => (i !== indeksPaket ? p : {
    ...p,
    soal: p.soal.map((s) => {
      if (s.uid !== uid) return s;
      const baru: Soal = { ...s, ...ubah, revisi: s.revisi + 1, disunting: true };
      baru.checksum = checksumSoal(baru);
      return baru;
    }),
  }));
  return denganPerubahan(ws, paket, 'Sunting soal');
}

export function gantiSoal(ws: Workspace, indeksPaket: number, soal: Soal[], keterangan: string): Workspace {
  return denganPerubahan(ws, ws.paket.map((p, i) => (i === indeksPaket ? { ...p, soal } : p)), keterangan);
}

export interface Cadangan { format: 'ukp-studio-cadangan'; versi: 1; dibuat: string; workspace: Workspace }

export const buatCadangan = (ws: Workspace): Cadangan => ({ format: 'ukp-studio-cadangan', versi: 1, dibuat: sekarang(), workspace: ws });

/** Baca cadangan JSON dan periksa strukturnya; galat dilempar dengan pesan yang bisa dibaca pengguna. */
export function bacaCadangan(teks: string): Workspace {
  let isi: unknown;
  try { isi = JSON.parse(teks); } catch { throw new Error('Berkas bukan JSON yang valid.'); }
  const c = isi as Partial<Cadangan>;
  if (c.format !== 'ukp-studio-cadangan' || !c.workspace) throw new Error('Berkas bukan cadangan UKP Studio.');
  const ws = c.workspace;
  if (ws.versi !== 1 || !Array.isArray(ws.paket) || !ws.pengaturan) throw new Error('Versi cadangan tidak dikenal.');
  for (const p of ws.paket) for (const s of p.soal) {
    if (!s.uid || !HURUF.includes(s.kunci) || HURUF.some((h) => typeof s.opsi?.[h] !== 'string')) throw new Error('Soal ' + (s.uid ?? '?') + ' di ' + p.id + ' rusak.');
  }
  return { ...ws, riwayat: Array.isArray(ws.riwayat) ? ws.riwayat.slice(0, BATAS.riwayat) : [] };
}
