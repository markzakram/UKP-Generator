// Naskah uji untuk tahap M1: memetakan kartu aturan nyata ke semua pola slide agar mesin PPTX diuji
// dengan panjang teks sungguhan (69 subtema). Penyusun naskah resmi (susunNaskah) dibuat di tahap M2.
import { readFileSync } from 'node:fs';
import { kalimat } from '../lib/materi/metrik';
import type { Ikon, Naskah, SlideNaskah } from '../lib/materi/naskah';

export interface AturanUji {
  id: string; kode: string; materi: string; subtema: string; judul: string; tingkat: string;
  konsep: string; pokok: string; subjek: string; syarat: string[]; tarifDpp: string; ambang: string; tenggat: string;
  pengecualian: string[]; hakKewajiban: string; konsekuensi: string; contoh: string[]; jebakan: string[]; dasarHukum: string[];
  berlaku: { mulai: string | null };
}

export function muatAturan(): AturanUji[] {
  return JSON.parse(readFileSync('data/ukp-rules.json', 'utf8')).aturan;
}

const pendek = (judul: string, maks = 28) => {
  const t = judul.split(/[:;(]/)[0].trim();
  return t.length <= maks ? t : t.slice(0, maks).replace(/\s+\S*$/, '');
};

export function naskahUji(aturan: AturanUji[], kode: string, subtema: string): Naskah {
  const at = aturan.filter((a) => a.kode === kode && a.subtema === subtema);
  const label = at.map((a) => pendek(a.judul, 22));
  const nav = at.length <= 5 ? [...label, 'Latihan'] : ['Konsep', 'Ketentuan', 'Angka', 'Contoh', 'Ringkasan'];
  const slides: SlideNaskah[] = [];
  const tingkat = at[0]?.tingkat ?? 'A';
  slides.push({ id: 'sampul', pola: 'P1', judul: subtema, pil: [at[0]?.materi ?? kode, `Tingkat ${tingkat} · UKP 2026`] });
  slides.push({ id: 'ikhtisar', pola: 'P2', judul: at[0]?.materi ?? kode, subjudul: subtema, kartu: [...at.map((a) => ({ judul: pendek(a.judul, 60), isi: a.konsep })), { judul: 'Latihan', isi: 'Kuis cepat dan contoh soal berbasis kasus beserta pembahasan.' }] });
  at.forEach((a, i) => {
    const bagian = at.length <= 5 ? label[i] : undefined;
    const dasar = { chip: pendek(a.judul, 40), ikon: ((i % 5) + 1) as Ikon, bagian, sumber: [a.id], asal: 'acuan' as const };
    slides.push({ ...dasar, id: a.id + '-konsep', pola: 'P3', judul: pendek(a.judul, 80), pembuka: a.konsep, isi: a.pokok, sorotan: { label: 'Dasar hukum', teks: a.dasarHukum.join('; ') }, gambar: i % 2 ? 'bertanya' : 'dokumen' });
    const termasuk = a.syarat.length ? a.syarat : a.subjek ? a.subjek.split(/;\s*/) : [];
    if (termasuk.length && a.pengecualian.length) slides.push({ ...dasar, id: a.id + '-kontras', pola: 'P5', judul: 'Termasuk atau dikecualikan?', kiri: { judul: 'Termasuk', poin: termasuk }, kanan: { judul: 'Dikecualikan', poin: a.pengecualian } });
    const angka = [['Tarif dan DPP', a.tarifDpp], ['Ambang', a.ambang], ['Tenggat', a.tenggat]].filter(([, v]) => v);
    if (angka.length) slides.push({ ...dasar, id: a.id + '-angka', pola: 'P6', judul: 'Angka yang perlu diingat', kolom: ['Unsur', 'Ketentuan'], baris: angka, lebar: [1, 3] });
    const def = [['Hak dan kewajiban', a.hakKewajiban], ['Konsekuensi', a.konsekuensi], ['Berlaku sejak', a.berlaku?.mulai ?? '']].filter(([, v]) => v).map(([l, v]) => ({ label: l, isi: v }));
    if (def.length >= 2) slides.push({ ...dasar, id: a.id + '-definisi', pola: 'P4', judul: 'Hak, kewajiban, dan konsekuensi', item: def });
    if (a.contoh[0]) {
      const langkah = kalimat(a.contoh[0]).flatMap((k) => k.split(/\s*;\s*/)).filter(Boolean);
      if (langkah.length >= 2) slides.push({ ...dasar, id: a.id + '-langkah', pola: 'P7', judul: 'Contoh penerapan', langkah, gambar: i % 2 ? 'dokumen' : 'bertanya' });
    }
    if (a.jebakan[0]) slides.push({ ...dasar, id: a.id + '-jebakan', pola: 'P10', judul: 'Kesalahan umum', pembuka: a.jebakan[0], keliru: { judul: 'Yang sering keliru', isi: a.jebakan[0] }, benar: { judul: 'Yang benar', isi: a.konsep } });
  });
  slides.push({ id: 'ringkasan', pola: 'P6', judul: 'Ringkasan ' + subtema, kolom: ['Aturan', 'Inti ketentuan', 'Dasar'], baris: at.map((a) => [pendek(a.judul, 60), a.konsep, a.dasarHukum[a.dasarHukum.length - 1] ?? '']) });
  slides.push({ id: 'penutup', pola: 'P15', judul: 'Terima kasih' });
  return { versi: 1, judul: subtema, kode, materi: at[0]?.materi, subtema, tingkat, tanggalAcuan: '2026-11-03', dibuat: '2026-11-03T10:00:00Z', nav, slides };
}
