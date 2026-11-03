// Deck materi tersimpan (tab Materi): naskah yang bisa disunting, naskah asli untuk "kembalikan teks acuan",
// status telaah, dan riwayat versi. Logika murni; penyimpanan IndexedDB ada di lib/storage.ts.
import type { Naskah, SlideNaskah, StatusTelaah, TelaahSlide } from './naskah';
import type { PengaturanMateri } from './susun';

export type StatusDeck = 'draf' | 'telaah';
export const BATAS_RIWAYAT_MATERI = 20;

export interface DeckMateri {
  /** "KODE|subtema" untuk deck hasil susun; "impor:<judul>" untuk naskah impor. */
  id: string;
  judul: string;
  naskah: Naskah;
  /** Naskah hasil susun/impor sebelum disunting. */
  asli: Naskah;
  pengaturan: PengaturanMateri | null;
  status: StatusDeck;
  diperbarui: string;
  riwayat: { waktu: string; naskah: Naskah }[];
}

export const idDeck = (kode: string, subtema: string) => kode + '|' + subtema;
/** Deck gabungan satu materi untuk satu tingkat ujian; `tambahan` = hanya subtema yang baru di tingkat itu. */
export const idGabungan = (kode: string, tingkat: string, tambahan = false) => 'gabung:' + kode + '|' + tingkat + (tambahan ? '+baru' : '');

export function buatDeck(naskah: Naskah, pengaturan: PengaturanMateri | null, waktu: string, id?: string): DeckMateri {
  return { id: id ?? (naskah.kode && naskah.subtema ? idDeck(naskah.kode, naskah.subtema) : 'impor:' + naskah.judul), judul: naskah.judul, naskah, asli: naskah, pengaturan, status: 'draf', diperbarui: waktu, riwayat: [] };
}

function denganNaskah(d: DeckMateri, naskah: Naskah, waktu: string): DeckMateri {
  const riwayat = [{ waktu: d.diperbarui, naskah: d.naskah }, ...d.riwayat].slice(0, BATAS_RIWAYAT_MATERI);
  // Isi berubah setelah ditelaah: status kembali ke draf agar ditelaah ulang.
  return { ...d, naskah, riwayat, diperbarui: waktu, status: d.status === 'telaah' ? 'draf' : d.status };
}

/** Sunting satu slide. Slide berasal acuan berubah menjadi "ditulis ulang"; hasil telaahnya dihapus supaya ditelaah ulang. */
export function suntingSlide(d: DeckMateri, id: string, ubah: (s: SlideNaskah) => SlideNaskah, waktu: string): DeckMateri {
  const slides = d.naskah.slides.map((s) => {
    if (s.id !== id) return s;
    const { telaah: _lama, ...baru } = ubah(s);
    return { ...baru, asal: s.asal === 'acuan' ? 'tulis' as const : baru.asal } as SlideNaskah;
  });
  return denganNaskah(d, { ...d.naskah, slides }, waktu);
}

/** Catat hasil telaah satu slide (null = hapus). Isi slide tidak berubah, jadi status deck tidak diturunkan. */
export function telaahSlide(d: DeckMateri, id: string, telaah: TelaahSlide | null, waktu: string): DeckMateri {
  const slides = d.naskah.slides.map((s) => {
    if (s.id !== id) return s;
    const { telaah: _lama, ...sisa } = s;
    return (telaah ? { ...sisa, telaah } : sisa) as SlideNaskah;
  });
  const riwayat = [{ waktu: d.diperbarui, naskah: d.naskah }, ...d.riwayat].slice(0, BATAS_RIWAYAT_MATERI);
  return { ...d, naskah: { ...d.naskah, slides }, riwayat, diperbarui: waktu };
}

/** Terapkan baris lembar telaah ke deck yang cocok. Slide yang tidak ada atau status kosong dilewati. */
export function terapkanLembarTelaah(decks: Record<string, DeckMateri>, baris: { deck: string; slide: string; status: StatusTelaah | null; catatan: string; oleh: string }[], waktu: string) {
  const hasil: Record<string, DeckMateri> = {};
  let diterapkan = 0, dilewati = 0;
  for (const b of baris) {
    const d = hasil[b.deck] ?? decks[b.deck];
    if (!d || !b.status || !d.naskah.slides.some((s) => s.id === b.slide)) { dilewati++; continue; }
    const lama = d.naskah.slides.find((s) => s.id === b.slide)?.telaah;
    if (lama && lama.status === b.status && (lama.catatan ?? '') === b.catatan && (lama.oleh ?? '') === b.oleh) { dilewati++; continue; }
    hasil[b.deck] = telaahSlide(d, b.slide, { status: b.status, catatan: b.catatan || undefined, oleh: b.oleh || undefined, waktu }, waktu);
    diterapkan++;
  }
  return { decks: Object.values(hasil), diterapkan, dilewati };
}

/** Kembalikan slide ke teks hasil susun (naskah asli). */
export function kembalikanSlide(d: DeckMateri, id: string, waktu: string): DeckMateri {
  const asli = d.asli.slides.find((s) => s.id === id);
  if (!asli) return d;
  return denganNaskah(d, { ...d.naskah, slides: d.naskah.slides.map((s) => (s.id === id ? asli : s)) }, waktu);
}

/** Atur urutan, sembunyikan, atau gandakan slide. */
export function aturSlide(d: DeckMateri, aksi: { jenis: 'naik' | 'turun' | 'sembunyi' | 'gandakan'; id: string }, waktu: string): DeckMateri {
  const slides = [...d.naskah.slides];
  const i = slides.findIndex((s) => s.id === aksi.id);
  if (i < 0) return d;
  if (aksi.jenis === 'naik' && i > 0) [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]];
  else if (aksi.jenis === 'turun' && i < slides.length - 1) [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]];
  else if (aksi.jenis === 'sembunyi') slides[i] = { ...slides[i], sembunyi: !slides[i].sembunyi };
  else if (aksi.jenis === 'gandakan') {
    let n = 2;
    while (slides.some((s) => s.id === `${aksi.id}-${n}`)) n++;
    slides.splice(i + 1, 0, { ...slides[i], id: `${aksi.id}-${n}` });
  } else return d;
  return denganNaskah(d, { ...d.naskah, slides }, waktu);
}

export function urungkan(d: DeckMateri): DeckMateri {
  const [terakhir, ...sisa] = d.riwayat;
  if (!terakhir) return d;
  return { ...d, naskah: terakhir.naskah, diperbarui: terakhir.waktu, riwayat: sisa };
}

export const tandaiTelaah = (d: DeckMateri, telaah: boolean, waktu: string): DeckMateri => ({ ...d, status: telaah ? 'telaah' : 'draf', diperbarui: waktu });

const POLA_SAH = new Set(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16']);

/** Baca naskah JSON dari luar (F8). Melempar galat yang menjelaskan bagian yang salah. */
export function bacaNaskah(teks: string): Naskah {
  let n: Naskah;
  try { n = JSON.parse(teks); } catch { throw new Error('Berkas bukan JSON yang sah.'); }
  if (!n || n.versi !== 1) throw new Error('Naskah harus berisi "versi": 1.');
  if (typeof n.judul !== 'string' || !n.judul.trim()) throw new Error('Naskah tidak punya judul.');
  if (!Array.isArray(n.nav) || n.nav.length > 6 || n.nav.some((x) => typeof x !== 'string')) throw new Error('"nav" harus berisi paling banyak 6 label teks.');
  if (!Array.isArray(n.slides) || !n.slides.length) throw new Error('Naskah tidak punya slide.');
  const id = new Set<string>();
  n.slides.forEach((s, i) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw new Error(`Slide ke-${i + 1} tidak punya id.`);
    if (id.has(s.id)) throw new Error(`id slide ganda: ${s.id}`);
    id.add(s.id);
    if (!POLA_SAH.has(s.pola)) throw new Error(`Slide ${s.id}: pola "${(s as { pola: string }).pola}" tidak dikenal.`);
    if (typeof s.judul !== 'string') throw new Error(`Slide ${s.id}: judul wajib diisi.`);
    if (s.nav !== undefined && (!Array.isArray(s.nav) || s.nav.length > 6 || s.nav.some((x) => typeof x !== 'string'))) throw new Error(`Slide ${s.id}: "nav" harus berisi paling banyak 6 label teks.`);
  });
  return { ...n, tanggalAcuan: n.tanggalAcuan || new Date().toISOString().slice(0, 10), dibuat: n.dibuat || new Date().toISOString() };
}
