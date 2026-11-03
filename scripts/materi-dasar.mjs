// Membuat paket dasar deck materi (assets/materi/dasar.pptx) dari template desain tim.
// Isi paket dasar: tema, master, layout, font Poppins Regular/Bold tertanam, dan media yang dipakai pola slide.
// Slide template dibuang; slide dibuat oleh lib/materi/pptx.ts.
// Pakai: npm run materi:dasar [-- <template.pptx>]   (bawaan: assets/materi/template-sumber.pptx)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const ROOT = process.cwd();
const SUMBER = process.argv[2] || path.join(ROOT, 'assets/materi/template-sumber.pptx');
const KELUAR = path.join(ROOT, 'assets/materi/dasar.pptx');
const PUBLIK = path.join(ROOT, 'public/materi/dasar.pptx');

// Media template → nama tetap yang dipakai pola slide. Ikon punya pasangan SVG agar tajam di PowerPoint baru.
const MEDIA = {
  'image1.png': 'foto-latar.png',
  'image4.png': 'ikon-1.png', 'image5.svg': 'ikon-1.svg',
  'image6.png': 'ikon-2.png', 'image7.svg': 'ikon-2.svg',
  'image8.png': 'ikon-3.png', 'image9.svg': 'ikon-3.svg',
  'image10.png': 'ikon-4.png', 'image11.svg': 'ikon-4.svg',
  'image12.png': 'ikon-5.png', 'image13.svg': 'ikon-5.svg',
  'image15.png': 'peringatan.png', 'image16.svg': 'peringatan.svg',
  'image17.png': 'ilustrasi-dokumen.png',
  'image18.png': 'ilustrasi-bertanya.png', 'image19.svg': 'ilustrasi-bertanya.svg'
};

const z = unzipSync(readFileSync(SUMBER));
const teks = (p) => strFromU8(z[p]);
const out = {};

// Font: cari berkas Poppins Regular dan Poppins Bold dari daftar font tertanam template.
const pres0 = teks('ppt/presentation.xml');
const rels0 = teks('ppt/_rels/presentation.xml.rels');
const targetRel = (id) => (rels0.match(new RegExp(`<Relationship [^>]*Id="${id}"[^>]*>`)) || [''])[0].match(/Target="([^"]+)"/)?.[1];
const fontRid = (nama) => (pres0.match(new RegExp(`<p:font typeface="${nama}"[^>]*/><p:regular r:id="([^"]+)"`)) || [])[1];
const fReg = targetRel(fontRid('Poppins')), fBold = targetRel(fontRid('Poppins Bold'));
if (!fReg || !fBold) throw new Error('Template tidak memuat font tertanam Poppins dan Poppins Bold.');

for (const [p, d] of Object.entries(z)) {
  if (p.startsWith('ppt/slides/') || p.startsWith('ppt/fonts/') || p.startsWith('ppt/media/') || p === 'docProps/thumbnail.jpeg') continue;
  out[p] = d;
}
for (const [asal, nama] of Object.entries(MEDIA)) {
  if (!z['ppt/media/' + asal]) throw new Error('Media template hilang: ' + asal);
  out['ppt/media/' + nama] = z['ppt/media/' + asal];
}
out['ppt/fonts/poppins-regular.fntdata'] = z['ppt/' + fReg];
out['ppt/fonts/poppins-bold.fntdata'] = z['ppt/' + fBold];

let pres = pres0
  .replace(/<p:sldIdLst>.*?<\/p:sldIdLst>/s, '<p:sldIdLst></p:sldIdLst>')
  .replace(/<p:embeddedFontLst>.*?<\/p:embeddedFontLst>/s, '<p:embeddedFontLst><p:embeddedFont><p:font typeface="Poppins" pitchFamily="2" charset="0"/><p:regular r:id="rIdFontR"/><p:bold r:id="rIdFontB"/></p:embeddedFont></p:embeddedFontLst>');
let rels = rels0
  .replace(/<Relationship [^>]*\/relationships\/(slide|font)"[^>]*\/>/g, '')
  .replace('</Relationships>', '<Relationship Id="rIdFontR" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/poppins-regular.fntdata"/><Relationship Id="rIdFontB" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/poppins-bold.fntdata"/></Relationships>');
let ct = teks('[Content_Types].xml').replace(/<Override [^>]*PartName="\/ppt\/slides\/[^>]*\/>/g, '');
const akar = teks('_rels/.rels').replace(/<Relationship [^>]*thumbnail[^>]*\/>/, '');

// Font tema (judul dan isi) = Poppins, agar teks yang ditambahkan tim di PowerPoint ikut gaya template.
const tema = teks('ppt/theme/theme1.xml').replace(/<a:(majorFont|minorFont)><a:latin typeface="[^"]*"/g, '<a:$1><a:latin typeface="Poppins"');
if (!/<a:majorFont><a:latin typeface="Poppins"/.test(tema)) throw new Error('Font tema tidak ditemukan di theme1.xml');
out['ppt/theme/theme1.xml'] = strToU8(tema);
out['ppt/presentation.xml'] = strToU8(pres);
out['ppt/_rels/presentation.xml.rels'] = strToU8(rels);
out['[Content_Types].xml'] = strToU8(ct);
out['_rels/.rels'] = strToU8(akar);

// Pemeriksaan: tidak ada rujukan ke bagian yang dibuang.
for (const [p, d] of Object.entries(out)) {
  if (!p.endsWith('.rels')) continue;
  const dir = path.posix.dirname(path.posix.dirname(p));
  for (const [, t, mode] of strFromU8(d).matchAll(/Target="([^"]+)"(?:[^>]*TargetMode="([^"]+)")?/g)) {
    if (mode === 'External') continue;
    const target = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, t)).replace(/^\//, '');
    if (!out[target]) throw new Error(`Rujukan putus di ${p}: ${t}`);
  }
}

const mtime = new Date('2026-01-01T00:00:00Z');
const urut = Object.keys(out).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : a.localeCompare(b)));
const zip = zipSync(Object.fromEntries(urut.map((p) => [p, [out[p], { mtime }]])), { level: 6 });
mkdirSync(path.dirname(KELUAR), { recursive: true });
writeFileSync(KELUAR, zip);
mkdirSync(path.dirname(PUBLIK), { recursive: true });
copyFileSync(KELUAR, PUBLIK);
console.log('RINGKASAN -> paket dasar ' + urut.length + ' bagian, ' + Object.keys(MEDIA).length + ' media, font Poppins Regular/Bold, ' + Math.round(zip.length / 1024) + ' KB');
console.log('BERKAS -> ' + KELUAR);
