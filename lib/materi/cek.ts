// Pemeriksaan otomatis deck materi: struktur paket .pptx dan kotak hasil tata letak (PRD-Materi bagian 12).
import { strFromU8, unzipSync } from 'fflate';
import { KANVAS, type SlideJadi } from './kotak';
import { tinggiTeks } from './metrik';
import { BATAS_BAWAH, NAV } from './tata-letak/komponen';

/** Pemeriksa XML ringan: tag seimbang, atribut berkutip, tanpa "<" atau "&" mentah di teks. */
export function masalahXml(xml: string): string | null {
  const tag = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/g;
  const tumpukan: string[] = [];
  let akhir = 0, m: RegExpExecArray | null;
  const teksSah = (t: string) => !/</.test(t) && !/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(t);
  while ((m = tag.exec(xml))) {
    if (!teksSah(xml.slice(akhir, m.index))) return 'karakter mentah di teks sebelum posisi ' + m.index;
    akhir = tag.lastIndex;
    const [, tutup, nama, atribut, sendiri] = m;
    if (!nama) continue;
    if (atribut && !teksSah(atribut.replace(/"[^"]*"|'[^']*'/g, (q) => (/[<]|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(q) ? '<' : '')))) return 'atribut tidak sah pada <' + nama + '>';
    if (tutup) { if (tumpukan.pop() !== nama) return 'tag penutup tidak cocok: </' + nama + '>'; }
    else if (!sendiri) tumpukan.push(nama);
  }
  if (!teksSah(xml.slice(akhir))) return 'karakter mentah di akhir dokumen';
  if (tumpukan.length) return 'tag tidak ditutup: <' + tumpukan[tumpukan.length - 1] + '>';
  return null;
}

/** Struktur paket: daftar slide, relasi, content type, XML, id bentuk unik. */
export function periksaPaket(berkas: Uint8Array): string[] {
  const masalah: string[] = [];
  const z = unzipSync(berkas);
  const teks = (p: string) => (z[p] ? strFromU8(z[p]) : '');
  for (const p of Object.keys(z)) {
    if (!/\.(xml|rels)$/.test(p)) continue;
    const e = masalahXml(teks(p));
    if (e) masalah.push(`${p}: ${e}`);
  }
  const ct = teks('[Content_Types].xml');
  for (const ext of ['png', 'svg', 'fntdata', 'rels', 'xml']) if (!new RegExp(`Extension="${ext}"`).test(ct)) masalah.push('Content type bawaan hilang: ' + ext);
  // Semua relasi menunjuk bagian yang ada.
  for (const p of Object.keys(z)) {
    if (!p.endsWith('.rels')) continue;
    const dasar = p.replace(/_rels\/[^/]*\.rels$/, '');
    for (const m of teks(p).matchAll(/<Relationship [^>]*>/g)) {
      if (/TargetMode="External"/.test(m[0])) continue;
      const t = m[0].match(/Target="([^"]+)"/)?.[1] ?? '';
      const parts = (dasar + t).split('/');
      const norm: string[] = [];
      for (const x of parts) { if (x === '..') norm.pop(); else if (x && x !== '.') norm.push(x); }
      const tujuan = t.startsWith('/') ? t.slice(1) : norm.join('/');
      if (!z[tujuan]) masalah.push(`${p}: target hilang ${t}`);
    }
  }
  // Daftar slide ↔ relasi ↔ content type ↔ bagian slide.
  const pres = teks('ppt/presentation.xml'), prels = teks('ppt/_rels/presentation.xml.rels');
  const ids = [...pres.matchAll(/<p:sldId id="(\d+)" r:id="([^"]+)"\/>/g)];
  if (!ids.length) masalah.push('Tidak ada slide di presentation.xml');
  const dipakai = new Set<string>();
  const angka = new Set<string>();
  for (const [, id, rid] of ids) {
    if (+id < 256) masalah.push('id slide < 256: ' + id);
    if (angka.has(id)) masalah.push('id slide ganda: ' + id);
    angka.add(id);
    const rel = prels.match(new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*>`))?.[0] ?? '';
    const target = rel.match(/Target="([^"]+)"/)?.[1];
    if (!target || !/\/slide"/.test(rel)) { masalah.push('Relasi slide hilang: ' + rid); continue; }
    const bagian = 'ppt/' + target;
    dipakai.add(bagian);
    if (!z[bagian]) masalah.push('Bagian slide hilang: ' + bagian);
    if (!new RegExp(`PartName="/${bagian.replace(/[.]/g, '\\.')}"[^>]*presentationml\\.slide\\+xml|presentationml\\.slide\\+xml"[^>]*PartName="/${bagian.replace(/[.]/g, '\\.')}"`).test(ct)) masalah.push('Content type slide hilang: ' + bagian);
    const xml = teks(bagian);
    const cnv = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((x) => x[1]);
    if (new Set(cnv).size !== cnv.length) masalah.push(bagian + ': id bentuk ganda');
  }
  for (const p of Object.keys(z)) if (/^ppt\/slides\/slide\d+\.xml$/.test(p) && !dipakai.has(p)) masalah.push('Bagian slide yatim: ' + p);
  for (const m of ct.matchAll(/PartName="\/(ppt\/slides\/[^"]+)"/g)) if (!z[m[1]]) masalah.push('Content type tanpa bagian: ' + m[1]);
  for (const m of pres.matchAll(/<p:(regular|bold) r:id="([^"]+)"\/>/g)) if (!new RegExp(`Id="${m[2]}"`).test(prels)) masalah.push('Font tertanam tanpa relasi: ' + m[2]);
  return masalah;
}

export interface MasalahTata { slide: number; kotak: string; pesan: string }

/** Kotak di dalam kanvas, isi tidak menembus bilah navigasi, dan teks muat menurut pengukur. */
export function periksaTataLetak(slides: SlideJadi[]): MasalahTata[] {
  const out: MasalahTata[] = [];
  const toleransi = 0.5;
  slides.forEach((s, i) => {
    for (const k of s.kotak) {
      const [x, y, w, h] = k.jenis === 'garis' ? [Math.min(k.x1, k.x2), Math.min(k.y1, k.y2), Math.abs(k.x2 - k.x1), Math.abs(k.y2 - k.y1)] : [k.x, k.y, k.w, k.h];
      if (x < -toleransi || y < -toleransi || x + w > KANVAS.w + toleransi || y + h > KANVAS.h + toleransi) out.push({ slide: i + 1, kotak: k.nama, pesan: 'keluar kanvas' });
      if (w < 0 || h < 0) out.push({ slide: i + 1, kotak: k.nama, pesan: 'ukuran negatif' });
      const bagianNav = k.nama === 'Navigasi' || k.nama.startsWith('Nav ');
      const latar = k.jenis === 'gambar' && k.aset === 'foto-latar';
      if (!bagianNav && !latar && y + h > BATAS_BAWAH + toleransi && y < NAV.y + NAV.h && s.pola !== 'P1' && s.pola !== 'P15' && s.pola !== 'P16') out.push({ slide: i + 1, kotak: k.nama, pesan: `menembus batas bawah isi (${Math.round(y + h)} > ${BATAS_BAWAH})` });
      if (k.jenis === 'teks') {
        const u = tinggiTeks(k.paragraf, k.pt, k.w, { tebal: k.tebal, jarak: k.jarak, antarPar: k.antarPar });
        if (u.tinggi > k.h + toleransi) out.push({ slide: i + 1, kotak: k.nama, pesan: `teks meluap ${Math.round(u.tinggi)} > ${Math.round(k.h)} pt` });
      }
    }
  });
  return out;
}

/** Teks contoh dari template yang tidak boleh ikut keluar. */
export const TEKS_TERLARANG = /lorem|ipsum|Release the final product|Struktrul|\bTODO\b|\[insert/i;
