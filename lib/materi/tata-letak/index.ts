// Tata letak naskah: setiap SlideNaskah menjadi satu atau lebih slide jadi (kotak berposisi mutlak).
import type { SlideJadi } from '../kotak';
import type { Naskah, SlideNaskah } from '../naskah';
import { tataIkhtisar } from './ikhtisar';
import { tataDefinisi, tataKesalahan, tataKonsep, tataKontras } from './isi';
import { tataLangkah } from './langkah';
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
    case 'P10': return tataKesalahan(a, naskah);
    case 'P15': return tataPenutup(a);
    default: throw new Error('Pola slide tidak dikenal: ' + (a as { pola: string }).pola);
  }
}

export function tataLetak(naskah: Naskah): SlideJadi[] {
  if (naskah.nav.length > 6) throw new Error('Bilah navigasi paling banyak 6 label.');
  return naskah.slides.filter((s) => !s.sembunyi).flatMap((s) => tataSlide(s, naskah));
}
