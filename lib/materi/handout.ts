// Handout peserta (R9): versi ringkas deck untuk dibagikan, tanpa catatan pembicara. Isinya struktur deck
// (sampul, daftar isi, pembatas, ikhtisar, penutup), rumus, rangkuman, dan kuis Benar/Salah beserta jawabannya.
import type { Naskah, Pola } from './naskah';

export const POLA_HANDOUT: readonly Pola[] = ['P1', 'P2', 'P6', 'P8', 'P11', 'P14', 'P15', 'P16'];

/** Tabel (P6) hanya daftar isi deck gabungan; tabel isi materi tidak masuk handout. */
const masukHandout = (s: Naskah['slides'][number]) => POLA_HANDOUT.includes(s.pola) && (s.pola !== 'P6' || s.id === 'daftar-isi');

export function naskahHandout(n: Naskah): Naskah {
  const slides = n.slides.filter((s) => !s.sembunyi && masukHandout(s)).map((s) => {
    if (s.pola !== 'P1') return s;
    return { ...s, pil: [s.pil[0], 'Handout peserta'].filter(Boolean) as string[] };
  });
  return { ...n, judul: n.judul + ' · Handout peserta', slides };
}

export const ringkasHandout = (n: Naskah) => {
  const h = naskahHandout(n);
  return { slide: h.slides.length, asal: n.slides.filter((s) => !s.sembunyi).length };
};
