// Telaah materi per slide (rekomendasi R1): penelaah menandai slide "sesuai" atau "perlu diubah" dengan catatan,
// di aplikasi atau lewat lembar Excel yang bisa diisi di luar aplikasi lalu diimpor kembali.
// Slide berasal teks acuan yang sudah ditandai sesuai tidak lagi membuat deck bertanda Draf internal (PRD-Materi KM2).
import { strFromU8, unzipSync } from 'fflate';
import { xlsx } from '../export/siadu';
import type { DeckMateri } from './deck';
import { NAMA_POLA, type Naskah, type SlideNaskah, type StatusTelaah } from './naskah';
import { teksSlide } from './susun';

export const LABEL_TELAAH: Record<StatusTelaah, string> = { sesuai: 'Sesuai', ubah: 'Perlu diubah' };

/** Slide yang perlu ditelaah: tampil dan bukan slide otomatis (sampul, pembatas, penutup). */
export const perluTelaah = (s: SlideNaskah) => !s.sembunyi && s.asal !== 'otomatis';

export function ringkasTelaah(n: Naskah) {
  const perlu = n.slides.filter(perluTelaah);
  const sesuai = perlu.filter((s) => s.telaah?.status === 'sesuai').length;
  const ubah = perlu.filter((s) => s.telaah?.status === 'ubah').length;
  return { perlu: perlu.length, sesuai, ubah, belum: perlu.length - sesuai - ubah, lengkap: perlu.length > 0 && sesuai === perlu.length };
}

const KOLOM = ['Deck', 'ID slide', 'No', 'Pola', 'Judul', 'Isi slide', 'Asal', 'Sumber', 'Status (Sesuai / Perlu diubah)', 'Catatan penelaah', 'Penelaah'];

/** Lembar telaah .xlsx: satu baris per slide yang perlu ditelaah; status dan catatan yang sudah ada ikut terisi. */
export function lembarTelaah(decks: DeckMateri[]): Uint8Array {
  const baris: (string | number)[][] = [KOLOM];
  for (const d of decks) {
    d.naskah.slides.forEach((s, i) => {
      if (!perluTelaah(s)) return;
      baris.push([d.id, s.id, i + 1, `${s.pola} ${NAMA_POLA[s.pola]}`, s.judul, teksSlide(s).slice(0, 30000), s.asal ?? '', (s.sumber ?? []).join(', '),
        s.telaah ? LABEL_TELAAH[s.telaah.status] : '', s.telaah?.catatan ?? '', s.telaah?.oleh ?? '']);
    });
  }
  const petunjuk = [
    ['Petunjuk lembar telaah'],
    ['1. Isi kolom Status dengan "Sesuai" atau "Perlu diubah". Kosongkan bila belum ditelaah.'],
    ['2. Tulis alasan atau perbaikan yang diminta di kolom Catatan penelaah, dan nama di kolom Penelaah.'],
    ['3. Jangan mengubah kolom Deck dan ID slide; keduanya dipakai untuk mencocokkan saat impor.'],
    ['4. Simpan sebagai .xlsx, lalu impor di tab Materi (Impor lembar telaah).'],
    ['Slide berasal teks acuan LatihUKP yang berstatus Sesuai tidak lagi membuat deck bertanda Draf internal (PRD-Materi KM2).'],
  ];
  return xlsx([{ nama: 'Telaah', baris, lebar: [22, 18, 5, 18, 40, 70, 10, 20, 18, 40, 16] }, { nama: 'Petunjuk', baris: petunjuk, lebar: [110] }]);
}

// ---------- pembaca .xlsx sederhana (inlineStr dari lembar kita, sharedStrings dari Excel) ----------

const entitas = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const teksSi = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => entitas(m[1])).join('');
const kolomKe = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Baca lembar pertama .xlsx menjadi baris teks. */
export function bacaXlsx(berkas: Uint8Array): string[][] {
  let isi: Record<string, Uint8Array>;
  try { isi = unzipSync(berkas); } catch { throw new Error('Berkas bukan .xlsx yang sah.'); }
  const workbook = isi['xl/workbook.xml'] ? strFromU8(isi['xl/workbook.xml']) : '';
  const rels = isi['xl/_rels/workbook.xml.rels'] ? strFromU8(isi['xl/_rels/workbook.xml.rels']) : '';
  const rid = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const target = rid ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : undefined;
  const jalur = target ? 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '') : 'xl/worksheets/sheet1.xml';
  if (!isi[jalur]) throw new Error('Lembar pertama tidak ditemukan di berkas .xlsx.');
  const bersama = isi['xl/sharedStrings.xml'] ? [...strFromU8(isi['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => teksSi(m[1])) : [];
  const hasil: string[][] = [];
  for (const row of strFromU8(isi[jalur]).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const baris: string[] = [];
    for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atribut = c[1], dalam = c[2] ?? '';
      const ref = atribut.match(/\br="([A-Z]+\d+)"/)?.[1];
      const jenis = atribut.match(/\bt="([^"]+)"/)?.[1];
      const v = dalam.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const nilai = jenis === 's' ? bersama[Number(v)] ?? '' : jenis === 'inlineStr' ? teksSi(dalam) : v !== undefined ? entitas(v) : '';
      baris[ref ? kolomKe(ref) : baris.length] = nilai;
    }
    hasil.push(Array.from(baris, (x) => x ?? ''));
  }
  return hasil;
}

export interface BarisTelaah { deck: string; slide: string; status: StatusTelaah | null; catatan: string; oleh: string }

/** Baca lembar telaah hasil isian penelaah. Status kosong = belum ditelaah. */
export function bacaLembarTelaah(berkas: Uint8Array): BarisTelaah[] {
  const baris = bacaXlsx(berkas);
  const kepala = (baris[0] ?? []).map((k) => k.trim().toLowerCase());
  const i = (awal: string) => kepala.findIndex((k) => k.startsWith(awal));
  const [iDeck, iSlide, iStatus, iCatatan, iOleh] = [i('deck'), i('id slide'), i('status'), i('catatan'), i('penelaah')];
  if (iDeck < 0 || iSlide < 0 || iStatus < 0) throw new Error('Kolom Deck, ID slide, atau Status tidak ditemukan. Pakai lembar telaah dari tab Materi.');
  return baris.slice(1).filter((b) => b[iDeck] && b[iSlide]).map((b) => {
    const st = (b[iStatus] ?? '').trim().toLowerCase();
    const status: StatusTelaah | null = /^sesuai|^ok|^ya/.test(st) ? 'sesuai' : /^perlu|^ubah|^tidak/.test(st) ? 'ubah' : null;
    return { deck: b[iDeck].trim(), slide: b[iSlide].trim(), status, catatan: (b[iCatatan] ?? '').trim(), oleh: (b[iOleh] ?? '').trim() };
  });
}
