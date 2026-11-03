// Tata letak naskah: setiap SlideNaskah menjadi satu atau lebih slide jadi (kotak berposisi mutlak).
import type { SlideJadi } from '../kotak';
import type { Naskah, SlideNaskah } from '../naskah';
import { tataIkhtisar } from './ikhtisar';
import { tataDefinisi, tataKesalahan, tataKonsep, tataKontras } from './isi';
import { tataLangkah } from './langkah';
import { tataContohSoal, tataKuis, tataPembahasan } from './latihan';
import { tataAngka, tataRangkuman, tataRumus } from './ringkas';
import { tataPenutup, tataSampul } from './sampul';
import { tataTabel } from './tabel';

export function tataSlide(a: SlideNaskah, naskah: Naskah): SlideJadi[] {
  switch (a.pola) {
    case 'P1': case 'P16': return tataSampul(a);
    case 'P2': return tataIkhtisar(a, naskah);
    case 'P3': return tataKonsep(a, naskah);
    case 'P4': return tataDefinisi(a, naskah);
    case 'P5': return tataKontras(a, naskah);
    case 'P6': return tataTabel(a, naskah);
    case 'P7': return tataLangkah(a, naskah);
    case 'P8': return tataRumus(a, naskah);
    case 'P9': return tataAngka(a, naskah);
    case 'P10': return tataKesalahan(a, naskah);
    case 'P11': return tataKuis(a, naskah);
    case 'P12': return tataContohSoal(a, naskah);
    case 'P13': return tataPembahasan(a, naskah);
    case 'P14': return tataRangkuman(a, naskah);
    case 'P15': return tataPenutup(a);
    default: throw new Error('Pola slide tidak dikenal: ' + (a as { pola: string }).pola);
  }
}

/** Catatan pembicara slide jadi: tanda Draf internal (teks acuan), catatan naskah, dan sumber. */
export function catatanSlide(a: SlideNaskah, lanjutan: number, tandaDraf = true): string {
  const baris: string[] = [];
  if (tandaDraf && a.asal === 'acuan') baris.push('DRAF INTERNAL: slide ini memuat teks acuan LatihUKP yang belum ditulis ulang atau ditelaah (PRD-Materi KM2).');
  if (lanjutan > 0) baris.push(`(lanjutan ${lanjutan})`);
  if (a.catatanPembicara) baris.push(a.catatanPembicara);
  if (a.sumber?.length) baris.push('Sumber: ' + a.sumber.join(', '));
  return baris.join('\n');
}

export function tataLetak(naskah: Naskah, opsi: { tandaDraf?: boolean } = {}): SlideJadi[] {
  if (naskah.nav.length > 6 || naskah.slides.some((s) => (s.nav?.length ?? 0) > 6)) throw new Error('Bilah navigasi paling banyak 6 label.');
  return naskah.slides.filter((s) => !s.sembunyi).flatMap((s) => tataSlide(s, naskah).map((j) => ({ ...j, catatan: catatanSlide(s, j.lanjutan, opsi.tandaDraf ?? true) })));
}
