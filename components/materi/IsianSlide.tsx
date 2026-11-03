'use client';
// Isian slide naskah: medan menyesuaikan pola. Daftar disunting per baris; pasangan kolom dipisah " | ".
import { useEffect, useState } from 'react';
import type { HurufOpsi, SlideNaskah } from '@/lib/materi/naskah';

type Jenis = 'teks' | 'area' | 'baris';
interface Medan { kunci: string; label: string; jenis: Jenis; bantuan?: string; ambil: (s: SlideNaskah) => string; isi: (s: SlideNaskah, v: string) => SlideNaskah }

const baris = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
const kolom = (t: string) => baris(t).map((l) => l.split('|').map((x) => x.trim()));
const gabung = (rows: string[][]) => rows.map((r) => r.join(' | ')).join('\n');
// Pembantu ketik: setiap pola punya bentuk data sendiri.
const m = <S extends SlideNaskah>(kunci: string, label: string, jenis: Jenis, ambil: (s: S) => string, isi: (s: S, v: string) => S, bantuan?: string): Medan =>
  ({ kunci, label, jenis, bantuan, ambil: (s) => ambil(s as S), isi: (s, v) => isi(s as S, v) });
type P<K extends SlideNaskah['pola']> = Extract<SlideNaskah, { pola: K }>;

function medan(s: SlideNaskah): Medan[] {
  const daftar: Medan[] = [m('judul', 'Judul slide', 'teks', (x) => x.judul, (x, v) => ({ ...x, judul: v }))];
  if (!['P1', 'P2', 'P15', 'P16'].includes(s.pola)) daftar.push(m('chip', 'Teks chip (kiri atas)', 'teks', (x) => x.chip ?? '', (x, v) => ({ ...x, chip: v || undefined })));
  type BerPembuka = P<'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P9' | 'P10'>;
  const pembuka = (_pola?: BerPembuka['pola']) => m<BerPembuka>('pembuka', 'Teks pembuka', 'area', (x) => x.pembuka ?? '', (x, v) => ({ ...x, pembuka: v || undefined }));
  switch (s.pola) {
    case 'P1': daftar.push(m<P<'P1'>>('pil', 'Pil sampul (satu per baris, maks. 2)', 'baris', (x) => x.pil.join('\n'), (x, v) => ({ ...x, pil: baris(v).slice(0, 2) }))); break;
    case 'P2': daftar.push(m<P<'P2'>>('subjudul', 'Subjudul', 'teks', (x) => x.subjudul ?? '', (x, v) => ({ ...x, subjudul: v || undefined })), m<P<'P2'>>('kartu', 'Kartu', 'baris', (x) => gabung(x.kartu.map((k) => [k.judul, k.isi])), (x, v) => ({ ...x, kartu: kolom(v).map(([judul, isi]) => ({ judul, isi: isi ?? '' })) }), 'judul | deskripsi')); break;
    case 'P3': daftar.push(pembuka('P3'), m<P<'P3'>>('isi', 'Isi', 'area', (x) => x.isi, (x, v) => ({ ...x, isi: v })), m<P<'P3'>>('sorotan', 'Catatan ⚠ (label | teks)', 'teks', (x) => (x.sorotan ? [x.sorotan.label ?? '', x.sorotan.teks].join(' | ') : ''), (x, v) => { const [label, ...t] = v.split('|'); return { ...x, sorotan: v.trim() ? (t.length ? { label: label.trim() || undefined, teks: t.join('|').trim() } : { teks: label.trim() }) : undefined }; })); break;
    case 'P4': daftar.push(pembuka('P4'), m<P<'P4'>>('item', 'Definisi', 'baris', (x) => gabung(x.item.map((d) => [d.label, d.isi])), (x, v) => ({ ...x, item: kolom(v).map(([label, isi]) => ({ label, isi: isi ?? '' })) }), 'label | isi')); break;
    case 'P5': daftar.push(pembuka('P5'),
      m<P<'P5'>>('kiriJudul', 'Kartu kiri: judul', 'teks', (x) => x.kiri.judul, (x, v) => ({ ...x, kiri: { ...x.kiri, judul: v } })),
      m<P<'P5'>>('kiriPoin', 'Kartu kiri: poin', 'baris', (x) => x.kiri.poin.join('\n'), (x, v) => ({ ...x, kiri: { ...x.kiri, poin: baris(v) } })),
      m<P<'P5'>>('kananJudul', 'Kartu kanan: judul', 'teks', (x) => x.kanan.judul, (x, v) => ({ ...x, kanan: { ...x.kanan, judul: v } })),
      m<P<'P5'>>('kananPoin', 'Kartu kanan: poin', 'baris', (x) => x.kanan.poin.join('\n'), (x, v) => ({ ...x, kanan: { ...x.kanan, poin: baris(v) } }))); break;
    case 'P6': daftar.push(pembuka('P6'), m<P<'P6'>>('kolom', 'Kepala kolom', 'teks', (x) => x.kolom.join(' | '), (x, v) => ({ ...x, kolom: v.split('|').map((t) => t.trim()).filter(Boolean) }), 'kolom 1 | kolom 2'), m<P<'P6'>>('baris', 'Baris tabel', 'baris', (x) => gabung(x.baris), (x, v) => ({ ...x, baris: kolom(v) }), 'sel 1 | sel 2')); break;
    case 'P7': daftar.push(pembuka('P7'), m<P<'P7'>>('langkah', 'Langkah', 'baris', (x) => x.langkah.join('\n'), (x, v) => ({ ...x, langkah: baris(v) }))); break;
    case 'P8': daftar.push(m<P<'P8'>>('rumus', 'Rumus', 'baris', (x) => x.rumus.join('\n'), (x, v) => ({ ...x, rumus: baris(v) })), m<P<'P8'>>('keterangan', 'Keterangan', 'area', (x) => x.keterangan ?? '', (x, v) => ({ ...x, keterangan: v || undefined })), m<P<'P8'>>('contoh', 'Contoh', 'baris', (x) => (x.contoh ?? []).join('\n'), (x, v) => ({ ...x, contoh: baris(v) }))); break;
    case 'P9': daftar.push(pembuka('P9'), m<P<'P9'>>('angka', 'Angka', 'baris', (x) => gabung(x.angka.map((a) => [a.nilai, a.label])), (x, v) => ({ ...x, angka: kolom(v).map(([nilai, label]) => ({ nilai, label: label ?? '' })) }), 'nilai | label')); break;
    case 'P10': daftar.push(pembuka('P10'),
      m<P<'P10'>>('keliruJudul', 'Kartu kiri: judul', 'teks', (x) => x.keliru.judul, (x, v) => ({ ...x, keliru: { ...x.keliru, judul: v } })),
      m<P<'P10'>>('keliruIsi', 'Kartu kiri: isi', 'area', (x) => x.keliru.isi, (x, v) => ({ ...x, keliru: { ...x.keliru, isi: v } })),
      m<P<'P10'>>('benarJudul', 'Kartu kanan: judul', 'teks', (x) => x.benar.judul, (x, v) => ({ ...x, benar: { ...x.benar, judul: v } })),
      m<P<'P10'>>('benarIsi', 'Kartu kanan: isi', 'area', (x) => x.benar.isi, (x, v) => ({ ...x, benar: { ...x.benar, isi: v } }))); break;
    case 'P11': daftar.push(m<P<'P11'>>('butir', 'Butir kuis', 'baris', (x) => gabung(x.butir.map((b) => [b.jawab ? 'B' : 'S', b.teks, b.jelas ?? ''])), (x, v) => ({ ...x, butir: kolom(v).map(([j, teks, jelas]) => ({ jawab: /^b/i.test(j), teks: teks ?? '', jelas: jelas || undefined })) }), 'B atau S | pernyataan | penjelasan')); break;
    case 'P12': daftar.push(m<P<'P12'>>('kasus', 'Kasus', 'area', (x) => x.kasus ?? '', (x, v) => ({ ...x, kasus: v || undefined })), m<P<'P12'>>('soal', 'Soal', 'area', (x) => x.soal, (x, v) => ({ ...x, soal: v })),
      ...(['A', 'B', 'C', 'D'] as HurufOpsi[]).map((h) => m<P<'P12'>>('opsi' + h, 'Opsi ' + h, 'teks', (x) => x.opsi[h], (x, v) => ({ ...x, opsi: { ...x.opsi, [h]: v } })))); break;
    case 'P13': daftar.push(m<P<'P13'>>('kunci', 'Kunci (A–D)', 'teks', (x) => x.kunci, (x, v) => ({ ...x, kunci: (/^[ABCD]$/i.test(v.trim()) ? v.trim().toUpperCase() : x.kunci) as HurufOpsi })), m<P<'P13'>>('teksKunci', 'Teks jawaban', 'teks', (x) => x.teksKunci, (x, v) => ({ ...x, teksKunci: v })), m<P<'P13'>>('inti', 'Inti pembahasan', 'area', (x) => x.inti, (x, v) => ({ ...x, inti: v })), m<P<'P13'>>('langkah', 'Langkah', 'baris', (x) => x.langkah.join('\n'), (x, v) => ({ ...x, langkah: baris(v) })), m<P<'P13'>>('dasar', 'Dasar hukum', 'teks', (x) => x.dasar ?? '', (x, v) => ({ ...x, dasar: v || undefined }))); break;
    case 'P14': daftar.push(m<P<'P14'>>('poin', 'Poin', 'baris', (x) => gabung(x.poin.map((p) => [p.judul, p.isi])), (x, v) => ({ ...x, poin: kolom(v).map(([judul, isi]) => ({ judul, isi: isi ?? '' })) }), 'judul | isi')); break;
    case 'P16': daftar.push(m<P<'P16'>>('subjudul', 'Subjudul', 'teks', (x) => x.subjudul ?? '', (x, v) => ({ ...x, subjudul: v || undefined }))); break;
    case 'P15': break;
  }
  return daftar;
}

/** Medan tersimpan saat fokus lepas, agar satu ketikan tidak membuat satu versi riwayat. */
function Isian({ md, slide, simpan }: { md: Medan; slide: SlideNaskah; simpan: (s: SlideNaskah) => void }) {
  const awal = md.ambil(slide);
  const [nilai, setNilai] = useState(awal);
  useEffect(() => setNilai(awal), [awal]);
  const lepas = () => { if (nilai !== awal) simpan(md.isi(slide, nilai)); };
  const baris = md.jenis === 'teks' ? undefined : Math.min(10, Math.max(3, nilai.split('\n').length + 1));
  return (
    <label>
      {md.label}{md.bantuan && <span className="redup" style={{ fontWeight: 400 }}> · format: {md.bantuan}</span>}
      {md.jenis === 'teks'
        ? <input type="text" value={nilai} onChange={(e) => setNilai(e.target.value)} onBlur={lepas} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        : <textarea rows={baris} value={nilai} onChange={(e) => setNilai(e.target.value)} onBlur={lepas} />}
    </label>
  );
}

export default function IsianSlide({ slide, nav, simpan }: { slide: SlideNaskah; nav: string[]; simpan: (s: SlideNaskah) => void }) {
  return (
    <div className="form">
      {medan(slide).map((md) => <Isian key={slide.id + md.kunci} md={md} slide={slide} simpan={simpan} />)}
      {!['P1', 'P15', 'P16'].includes(slide.pola) && nav.length > 0 && (
        <label>Bagian aktif di navigasi
          <select value={slide.bagian ?? ''} onChange={(e) => simpan({ ...slide, bagian: e.target.value || undefined })}>
            <option value="">(tidak ada)</option>
            {nav.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
