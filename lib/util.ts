// Utilitas murni: keacakan bertitik awal (seed), hash, dan format Indonesia.

export function rng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T,>(items: readonly T[]) => items[int(0, items.length - 1)];
  const shuffle = <T,>(items: readonly T[]) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return { next, int, pick, shuffle };
}
export type Rng = ReturnType<typeof rng>;

/** Hash FNV-1a 32 bit dua putaran, cukup untuk checksum konsistensi (bukan keamanan). */
export function hash(text: string): string {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = (Math.imul(b, 33) + c) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export function idAcak(prefix: string) {
  const c = globalThis.crypto as Crypto | undefined;
  const bagian = c?.getRandomValues ? Array.from(c.getRandomValues(new Uint32Array(2)), (n) => n.toString(36)).join('') : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + '-' + bagian;
}

/** 4800000000 -> "4.800.000.000" (titik ribuan, tanpa desimal kecuali diminta). */
export function angka(n: number, desimal = 0): string {
  const neg = n < 0;
  const [bulat, pecahan] = Math.abs(n).toFixed(desimal).split('.');
  const ribuan = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + ribuan + (pecahan ? ',' + pecahan : '');
}
export const rupiah = (n: number) => (n < 0 ? '-Rp' + angka(-n) : 'Rp' + angka(n));
/** 0.12 -> "12%", 0.005 -> "0,5%". */
export function persen(p: number): string {
  const v = Math.round(p * 100 * 10000) / 10000;
  return String(v).replace('.', ',') + '%';
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const namaBulan = (i: number) => BULAN[i];
/** "2026-03-15" -> "15 Maret 2026". */
export function tanggal(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return d + ' ' + BULAN[m - 1] + ' ' + y;
}
export const isoTanggal = (d: Date) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
export const buatTanggal = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
export const akhirBulan = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Nilai angka dari teks opsi Rupiah/persen; NaN bila bukan angka murni. */
export function nilaiOpsi(teks: string): number {
  if (!/^\s*-?\s*(Rp\s?)?-?[\d.]+(,\d+)?\s*(%|persen)?\s*$/i.test(teks)) return NaN;
  return Number(teks.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.'));
}

export const normalTeks = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
