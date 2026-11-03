// Penyimpanan IndexedDB di browser. Hanya dipakai komponen klien.
import type { DeckMateri } from './materi/deck';
import type { Workspace } from './types';

const DATABASE = 'ukp-studio-v1';
const STORES = ['workspaces', 'pilots', 'materi'] as const;
type Store = (typeof STORES)[number];

function buka(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DATABASE, 2);
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Penyimpanan browser tidak tersedia. Unduh cadangan JSON untuk menyimpan pekerjaan.'));
    req.onblocked = () => reject(new Error('Tutup tab UKP Studio lain agar penyimpanan dapat diperbarui.'));
  });
}
async function transaksi<T>(store: Store, mode: IDBTransactionMode, aksi: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await buka();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode), req = aksi(tx.objectStore(store));
    let nilai: T;
    req.onsuccess = () => { nilai = req.result; };
    tx.oncomplete = () => { db.close(); resolve(nilai); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Gagal menyimpan. Ruang penyimpanan mungkin penuh; unduh cadangan JSON.')); };
  });
}
let antre: Promise<unknown> = Promise.resolve();
export async function simpanWorkspace(ws: Workspace) {
  const jalan = antre.catch(() => undefined).then(() => transaksi('workspaces', 'readwrite', (s) => s.put(ws)));
  antre = jalan;
  await jalan;
}
export const daftarWorkspace = () => transaksi<Workspace[]>('workspaces', 'readonly', (s) => s.getAll()).then((w) => w.sort((a, b) => b.diperbarui.localeCompare(a.diperbarui)));
export const hapusWorkspace = (id: string) => transaksi('workspaces', 'readwrite', (s) => s.delete(id));
export const simpanSesiUji = <T extends { id: string }>(sesi: T) => transaksi('pilots', 'readwrite', (s) => s.put(sesi));
export const daftarSesiUji = <T,>() => transaksi<T[]>('pilots', 'readonly', (s) => s.getAll());
export const simpanDeckMateri = (d: DeckMateri) => transaksi('materi', 'readwrite', (s) => s.put(d));
export const daftarDeckMateri = () => transaksi<DeckMateri[]>('materi', 'readonly', (s) => s.getAll());
export const hapusDeckMateri = (id: string) => transaksi('materi', 'readwrite', (s) => s.delete(id));
