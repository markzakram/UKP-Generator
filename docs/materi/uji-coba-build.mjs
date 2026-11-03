// Uji kelayakan: rakit deck materi bergaya template dari data aturan UKP.
// Pakai: node docs/materi/uji-coba-build.mjs "<Template Desain Materi.pptx>" keluar.pptx  (rujukan untuk tahap M1, bukan kode produksi)
// Paket dasar = template (tema, master, font tertanam, media); slide dibuat ulang dari kode.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire('G:/Ali/code/UKP Generator/package.json');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');

const TPL = process.argv[2], OUT = process.argv[3];
const ROOT = 'G:/Ali/code/UKP Generator/data/';
const aturan = JSON.parse(readFileSync(ROOT + 'ukp-rules.json', 'utf8')).aturan;
const bank = JSON.parse(readFileSync(ROOT + 'ukp-bank.json', 'utf8')).soal;

const SUB = 'PPh 21: pemotong, penerima & objek';
const AT = aturan.filter(a => a.subtema === SUB);
const SOAL = bank.find(s => s.id === 'E4-PP-01');

// ---------- warna dan ukuran (pt pada kanvas 1440 x 810) ----------
const W = 1440, H = 810, E = 12700;
const K = { sky: '00AEEF', deep: '004B66', teal: '0A6486', slate: '364D61', mint: 'CFE2BE', putih: 'FFFFFF', hitam: '1A1A1A', abu: '5B6B7A', oranye: 'F4A23B' };
const emu = v => Math.round(v * E);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- ukur teks (perkiraan lebar Poppins) ----------
const MET = JSON.parse(readFileSync(new URL('./metrik-poppins.json', import.meta.url), 'utf8').replace(/^﻿/, ''));
const lebar = (t, size, bold) => { let w = 0; for (const ch of t) w += MET[bold ? 'bold' : 'regular'][String(ch.codePointAt(0))] ?? 0.62; return w * size; };
function bungkus(teks, size, w, bold) {
  let n = 0; const spasi = lebar(' ', size, bold);
  for (const par of String(teks).split('\n')) {
    let x = 0; n++;
    for (const kata of par.split(/\s+/)) {
      const lk = lebar(kata, size, bold);
      if (x === 0) x = lk; else if (x + spasi + lk <= w) x += spasi + lk; else { n++; x = lk; }
    }
  }
  return n;
}
// cari ukuran terbesar <= pref yang muat; kembalikan {size, muat}
function pas(paras, w, h, pref, min, bold = false, jarak = 1.2, antarPar = 0.35) {
  for (let s = pref; s >= min; s -= 1) {
    let tinggi = 0;
    paras.forEach((p, i) => { tinggi += bungkus(typeof p === 'string' ? p : p.map(r => r.t).join(''), s, w, bold) * s * jarak + (i ? s * antarPar : 0); });
    if (tinggi <= h) return { size: s, muat: true };
  }
  return { size: min, muat: false };
}
const LAPORAN = [];

// ---------- pembangun XML ----------
let nid;
const run = (r, def) => {
  const o = { ...def, ...r };
  const fill = o.grad
    ? `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="${o.grad[0]}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${o.grad[1]}"/></a:gs></a:gsLst><a:lin ang="2700000"/></a:gradFill>`
    : `<a:solidFill><a:srgbClr val="${o.c}"/></a:solidFill>`;
  return `<a:r><a:rPr lang="id-ID" sz="${Math.round(o.sz * 100)}"${o.b ? ' b="1"' : ''}${o.i ? ' i="1"' : ''} dirty="0">${fill}<a:latin typeface="Poppins"/><a:cs typeface="Poppins"/></a:rPr><a:t xml:space="preserve">${esc(o.t)}</a:t></a:r>`;
};
// paras: array of string | array of runs {t,b,...}
function teks({ x, y, w, h, paras, sz, c = K.hitam, b = false, algn = 'l', anchor = 't', jarak = 1.2, antarPar = 0.35, grad, nama = 'Teks', bullet = false }) {
  const def = { sz, c, b, grad };
  const ps = paras.map((p, i) => {
    const runs = typeof p === 'string' ? [{ t: p }] : p;
    const bu = bullet ? `<a:buFont typeface="Arial"/><a:buChar char="•"/>` : '<a:buNone/>';
    const ind = bullet ? ` marL="${emu(sz * 1.1)}" indent="-${emu(sz * 1.1)}"` : '';
    return `<a:p><a:pPr algn="${algn}"${ind}><a:lnSpc><a:spcPct val="${Math.round(jarak * 83000)}"/></a:lnSpc><a:spcBef><a:spcPts val="${i ? Math.round(sz * antarPar * 100) : 0}"/></a:spcBef>${bu}</a:pPr>${runs.map(r => run(r, def)).join('')}</a:p>`;
  }).join('');
  const id = nid++;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(nama)} ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${ps}</p:txBody></p:sp>`;
}
function kotak({ x, y, w, h, fill, grad, alpha, r = 0.06, nama = 'Kotak', bayang = false, garis }) {
  const id = nid++;
  const a = alpha != null ? `<a:alpha val="${alpha * 1000}"/>` : '';
  const f = grad
    ? `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${grad[0]}">${a}</a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="${grad[1]}">${a}</a:srgbClr></a:gs></a:gsLst><a:lin ang="${grad[2] ?? 2700000}"/></a:gradFill>`
    : `<a:solidFill><a:srgbClr val="${fill}">${a}</a:srgbClr></a:solidFill>`;
  const ln = garis ? `<a:ln w="${emu(garis[1])}"><a:solidFill><a:srgbClr val="${garis[0]}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const sh = bayang ? '<a:effectLst><a:outerShdw blurRad="190500" dist="63500" dir="5400000" algn="t" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="22000"/></a:srgbClr></a:outerShdw></a:effectLst>' : '';
  const geom = r ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round(r * 100000)}"/></a:avLst></a:prstGeom>` : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(nama)} ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>${geom}${f}${ln}${sh}</p:spPr></p:sp>`;
}
function garisV({ x, y, h, c = K.putih }) {
  const id = nid++;
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Pemisah ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="0" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="15875"><a:solidFill><a:srgbClr val="${c}"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`;
}
function gambar({ x, y, w, h, rid, nama = 'Gambar', alt = '', opasitas }) {
  const id = nid++;
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${esc(nama)} ${id}" descr="${esc(alt)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}">${opasitas != null ? `<a:alphaModFix amt="${opasitas * 1000}"/>` : ''}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

// ---------- komponen gaya template ----------
const MEDIA = { foto: 'image1.png', ikon: ['image4.png', 'image6.png', 'image8.png', 'image10.png', 'image12.png'], awas: 'image15.png', ilustrasi: 'image17.png', bingung: 'image18.png' };
function chipJudul(judul, ikonRid) {
  const s = pas([judul], 520, 40, 29, 20, true).size;
  return kotak({ x: 56, y: 29, w: 585, h: 77, grad: [K.sky, K.mint], alpha: 48, r: 0.04, nama: 'Chip' })
    + kotak({ x: 70, y: 41, w: 54, h: 54, fill: K.putih, r: 0.22, nama: 'Ubin ikon', bayang: true })
    + gambar({ x: 80, y: 51, w: 34, h: 34, rid: ikonRid, nama: 'Ikon' })
    + teks({ x: 138, y: 29, w: 495, h: 77, paras: [judul], sz: s, b: true, grad: [K.sky, K.deep], anchor: 'ctr', nama: 'Judul bagian' });
}
function navBar(bagian, aktif) {
  let x = kotak({ x: 57, y: 720, w: 1327, h: 64, grad: [K.sky, K.mint], alpha: 65, r: 0, nama: 'Navigasi' });
  const lebar = 1327 / bagian.length;
  bagian.forEach((b, i) => {
    const on = aktif == null || i === aktif;
    x += teks({ x: 57 + i * lebar + 12, y: 720, w: lebar - 24, h: 64, paras: [b], sz: 17, b: true, c: on ? K.deep : '5E8EA3', algn: 'ctr', anchor: 'ctr', nama: 'Nav' });
  });
  return x;
}
const judulSlide = (t, y = 128) => teks({ x: 57, y, w: 1326, h: 80, paras: [t], sz: pas([t], 1326, 80, 54, 38, true).size, b: true, c: K.teal, anchor: 'b', nama: 'Judul' });

// ---------- slide ----------
const NAV = ['Konsep', 'Pemotong', 'Penerima', 'Objek', 'Contoh Soal'];
const slides = [];
function slide(isi, rels = []) { slides.push({ isi, rels }); }
function relsFor(names) { return names.map((n, i) => ({ rid: 'rId' + (i + 2), target: '../media/' + n })); }

// 1. Sampul
{
  nid = 2; const r = relsFor([MEDIA.foto]);
  const judul = SUB.toUpperCase();
  const f = pas([judul], 1060, 300, 92, 56, true, 1.05);
  let s = gambar({ x: 0, y: 0, w: W, h: H, rid: 'rId2', nama: 'Latar', alt: 'Latar meja kerja', opasitas: 31 });
  s += teks({ x: 190, y: 150, w: 1060, h: 300, paras: [judul], sz: f.size, b: true, grad: [K.sky, K.deep], algn: 'ctr', anchor: 'b', jarak: 1.05, nama: 'Judul sampul' });
  const p1 = AT[0].materi, p2 = 'Tingkat A · UKP 2026';
  const w1 = p1.length * 33 * 0.6 + 60, w2 = p2.length * 33 * 0.6 + 60, x0 = (W - w1 - w2 - 24) / 2;
  s += kotak({ x: x0, y: 482, w: w1, h: 56, fill: K.slate, r: 0.12, nama: 'Pil' }) + teks({ x: x0, y: 482, w: w1, h: 56, paras: [p1], sz: 30, b: true, c: K.putih, algn: 'ctr', anchor: 'ctr' });
  s += kotak({ x: x0 + w1 + 24, y: 482, w: w2, h: 56, fill: K.slate, r: 0.12, nama: 'Pil' }) + teks({ x: x0 + w1 + 24, y: 482, w: w2, h: 56, paras: [[{ t: p2, i: true }]], sz: 30, b: true, c: K.putih, algn: 'ctr', anchor: 'ctr' });
  slide(s, r); LAPORAN.push(['sampul', f]);
}
// 2. Ikhtisar: kartu per aturan + kartu contoh soal
{
  nid = 2; const r = relsFor(MEDIA.ikon);
  let s = teks({ x: 120, y: 70, w: 1200, h: 130, paras: [AT[0].materi], sz: pas([AT[0].materi], 1200, 130, 100, 64, true).size, b: true, grad: [K.sky, K.deep], algn: 'ctr', anchor: 'b', nama: 'Judul ikhtisar' });
  s += teks({ x: 120, y: 205, w: 1200, h: 50, paras: [[{ t: SUB, i: true }]], sz: 34, b: true, grad: [K.sky, K.deep], algn: 'ctr' });
  const kartu = [...AT.map(a => ({ j: a.judul.split(/[:;]/)[0], d: a.konsep })), { j: 'Contoh Soal', d: 'Latihan berbasis kasus beserta pembahasan langkah demi langkah.' }];
  const n = kartu.length, gap = 18, cw = Math.min(260, (1340 - gap * (n - 1)) / n), x0 = (W - (cw * n + gap * (n - 1))) / 2;
  kartu.forEach((k, i) => {
    const x = x0 + i * (cw + gap), y = 320;
    s += i === 0 ? kotak({ x, y, w: cw, h: 330, grad: [K.sky, K.deep, 5400000], r: 0.06, nama: 'Kartu aktif' }) : kotak({ x, y, w: cw, h: 330, fill: K.slate, r: 0.06, nama: 'Kartu' });
    const fj = pas([k.j], cw - 36, 84, 21, 15, true); const fd = pas([k.d], cw - 36, 140, 14, 11);
    s += teks({ x: x + 18, y: y + 26, w: cw - 36, h: 84, paras: [k.j], sz: fj.size, b: true, c: K.putih, algn: 'ctr', anchor: 'b' });
    s += teks({ x: x + 18, y: y + 122, w: cw - 36, h: 140, paras: [k.d], sz: fd.size, c: K.putih, algn: 'ctr' });
    s += kotak({ x: x + cw / 2 - 30, y: y + 262, w: 60, h: 56, fill: K.putih, r: 0.18, bayang: true, nama: 'Ubin ikon' }) + gambar({ x: x + cw / 2 - 17, y: y + 273, w: 34, h: 34, rid: 'rId' + (2 + (i % 5)), nama: 'Ikon' });
    LAPORAN.push(['kartu ' + i, fj, fd]);
  });
  s += navBar(NAV, null);
  slide(s, r);
}
// 3. Konsep: teks + ilustrasi + peringatan
{
  nid = 2; const a = AT[0]; const r = relsFor([MEDIA.ikon[0], MEDIA.ilustrasi, MEDIA.awas]);
  let s = chipJudul('Pemotong PPh 21', 'rId2') + judulSlide('Siapa pemotong PPh 21?');
  const lead = a.konsep, body = a.pokok.split('. Bukan')[0] + '.';
  const fl = pas([lead], 930, 90, 30, 22); const fb = pas([body], 930, 250, 26, 18);
  const hl = fl.size * 1.2 * bungkus(lead, fl.size, 930);
  s += teks({ x: 57, y: 232, w: 930, h: hl + 4, paras: [lead], sz: fl.size, c: K.slate });
  const fb2 = pas([body], 930, 590 - (232 + hl + 22), 26, 18);
  s += teks({ x: 57, y: 232 + hl + 22, w: 930, h: 590 - (232 + hl + 22), paras: [body], sz: fb2.size, c: K.hitam }); LAPORAN.push(['konsep isi', fb2]);
  s += gambar({ x: 1050, y: 230, w: 300, h: 300, rid: 'rId3', nama: 'Ilustrasi' });
  s += gambar({ x: 57, y: 620, w: 56, h: 48, rid: 'rId4', nama: 'Ikon peringatan' });
  s += teks({ x: 130, y: 612, w: 1200, h: 70, paras: [[{ t: 'Dasar hukum: ', b: true }, { t: a.dasarHukum.join('; ') }]], sz: pas([a.dasarHukum.join('; ') + 'Dasar hukum: '], 1200, 70, 22, 16).size, anchor: 'ctr' });
  s += navBar(NAV, 1); slide(s, r); LAPORAN.push(['konsep', fl, fb]);
}
// 4. Dua kartu kontras: wajib memotong vs dikecualikan
{
  nid = 2; const a = AT[0]; const r = relsFor([MEDIA.ikon[0]]);
  let s = chipJudul('Pemotong PPh 21', 'rId2') + judulSlide('Wajib memotong atau dikecualikan?');
  const intro = 'Kewajiban memotong melekat pada pihak yang membayar penghasilan sehubungan dengan pekerjaan, jasa, atau kegiatan orang pribadi.';
  s += teks({ x: 57, y: 222, w: 1240, h: 80, paras: [intro], sz: pas([intro], 1240, 80, 28, 20).size });
  const kiri = a.subjek.split(', '), kanan = a.pengecualian;
  [[57, K.slate, 'Wajib memotong', kiri], [737, K.teal, 'Bukan pemotong', kanan]].forEach(([x, f, j, isi]) => {
    s += kotak({ x, y: 320, w: 646, h: 360, fill: f, r: 0.03, nama: 'Kartu' });
    s += teks({ x: x + 28, y: 338, w: 590, h: 56, paras: [j], sz: 38, b: true, c: K.putih });
    const ff = pas(isi, 590, 250, 24, 16, false, 1.2, 0.3);
    s += teks({ x: x + 28, y: 406, w: 590, h: 250, paras: isi, sz: ff.size, c: K.putih, bullet: true, antarPar: 0.3 });
    LAPORAN.push(['kontras ' + j, ff]);
  });
  s += navBar(NAV, 1); slide(s, r);
}
// 5. Tabel ringkas: aturan pada subtema
{
  nid = 2; const r = relsFor([MEDIA.ikon[1]]);
  let s = chipJudul('Ringkasan subtema', 'rId2') + judulSlide('Pemotong, penerima, dan objek', 118);
  const kol = [{ j: 'Aturan', w: 330 }, { j: 'Inti ketentuan', w: 640 }, { j: 'Dasar', w: 340 }];
  const baris = AT.slice(0, 4).map(a => [a.judul.split(/[:;]/)[0], a.konsep, a.dasarHukum[a.dasarHukum.length - 1]]);
  const x0 = 65, y0 = 212, hh = 60, rh = 100;
  let x = x0; s += kotak({ x: x0, y: y0, w: 1310, h: hh, fill: K.slate, r: 0, nama: 'Kepala tabel' });
  kol.forEach(k => { s += teks({ x: x + 20, y: y0, w: k.w - 40, h: hh, paras: [k.j], sz: 28, b: true, c: K.putih, anchor: 'ctr' }); x += k.w; });
  baris.forEach((b, i) => {
    const y = y0 + hh + i * rh; x = x0;
    s += kotak({ x: x0, y, w: 1310, h: rh, fill: i % 2 ? 'F3F8FA' : K.putih, r: 0, garis: ['C9D6DE', 0.75], nama: 'Baris' });
    b.forEach((t, j) => { const f = pas([t], kol[j].w - 40, rh - 20, j ? 19 : 21, 13, !j); s += teks({ x: x + 20, y: y + 10, w: kol[j].w - 40, h: rh - 20, paras: [t], sz: f.size, b: !j, c: j ? K.hitam : K.teal, anchor: 'ctr' }); x += kol[j].w; LAPORAN.push(['tabel ' + i + '/' + j, f]); });
  });
  s += navBar(NAV, 0); slide(s, r);
}
// 6. Langkah bernomor (dari langkah pembahasan soal)
{
  nid = 2; const r = relsFor([MEDIA.ikon[2], MEDIA.bingung]);
  let s = chipJudul('Saat terutang PPh 21', 'rId2') + judulSlide('Langkah menentukan masa pajak');
  const ls = SOAL.langkah.slice(0, 4);
  s += teks({ x: 57, y: 222, w: 1240, h: 60, paras: ['Gunakan urutan yang sama pada setiap kasus pembayaran di muka.'], sz: 28 });
  ls.forEach((l, i) => {
    const y = 300 + i * 100; const [kepala, ...ekor] = l.split(/(?<=:)\s|(?<=→)\s/);
    s += kotak({ x: 57, y, w: 1020, h: 84, fill: K.teal, r: 0.04, nama: 'Langkah' });
    s += kotak({ x: 75, y: y + 17, w: 50, h: 50, fill: K.putih, r: 0.5, nama: 'Nomor' }) + teks({ x: 75, y: y + 17, w: 50, h: 50, paras: [String(i + 1)], sz: 24, b: true, c: K.teal, algn: 'ctr', anchor: 'ctr' });
    const f = pas([l], 910, 74, 21, 14);
    s += teks({ x: 145, y: y + 5, w: 910, h: 74, paras: [l], sz: f.size, c: K.putih, anchor: 'ctr' }); LAPORAN.push(['langkah ' + i, f]);
  });
  s += gambar({ x: 1130, y: 330, w: 220, h: 220, rid: 'rId3', nama: 'Ilustrasi' });
  s += navBar(NAV, 3); slide(s, r);
}
// 7. Contoh soal
{
  nid = 2; const r = relsFor([MEDIA.ikon[3]]);
  let s = chipJudul('Contoh Soal', 'rId2');
  const fk = pas([SOAL.kasus, SOAL.soal], 1326, 190, 25, 17);
  s += kotak({ x: 57, y: 128, w: 1326, h: 220, fill: 'EAF5F9', r: 0.03, nama: 'Kasus' });
  s += teks({ x: 85, y: 143, w: 1270, h: 190, paras: [SOAL.kasus, [{ t: SOAL.soal, b: true }]], sz: fk.size, c: K.hitam, anchor: 'ctr' });
  ['A', 'B', 'C', 'D'].forEach((h, i) => {
    const x = 57 + (i % 2) * 673, y = 372 + Math.floor(i / 2) * 160;
    s += kotak({ x, y, w: 653, h: 144, fill: K.slate, r: 0.05, nama: 'Opsi' });
    s += kotak({ x: x + 18, y: y + 47, w: 50, h: 50, fill: K.putih, r: 0.5, nama: 'Huruf' }) + teks({ x: x + 18, y: y + 47, w: 50, h: 50, paras: [h], sz: 24, b: true, c: K.slate, algn: 'ctr', anchor: 'ctr' });
    const f = pas([SOAL.opsi[h]], 545, 124, 21, 14); s += teks({ x: x + 88, y: y + 10, w: 545, h: 124, paras: [SOAL.opsi[h]], sz: f.size, c: K.putih, anchor: 'ctr' }); LAPORAN.push(['opsi ' + h, f]);
  });
  s += navBar(NAV, 4); slide(s, r); LAPORAN.push(['kasus', fk]);
}
// 8. Penutup
{
  nid = 2; const r = relsFor([MEDIA.foto]);
  slide(gambar({ x: 0, y: 0, w: W, h: H, rid: 'rId2', nama: 'Latar', alt: 'Latar meja kerja', opasitas: 31 }) + teks({ x: 190, y: 230, w: 1060, h: 130, paras: ['TERIMA KASIH'], sz: 96, b: true, grad: [K.sky, K.deep], algn: 'ctr', anchor: 'ctr' }), r);
}

// ---------- rakit paket ----------
if (process.env.ONLY) { const keep = process.env.ONLY.split(',').map(Number); const k = slides.filter((_, i) => keep.includes(i + 1)); slides.length = 0; slides.push(...k); }
const z = unzipSync(readFileSync(TPL));
const out = {};
for (const [p, d] of Object.entries(z)) if (!/^ppt\/slides\//.test(p) && !/^ppt\/media\/image(2|3|5|7|9|11|13|14|16|19)\./.test(p)) out[p] = d;
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
slides.forEach((s, i) => {
  out[`ppt/slides/slide${i + 1}.xml`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${s.isi}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
  out[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout7.xml"/>${s.rels.map(r => `<Relationship Id="${r.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${r.target}"/>`).join('')}</Relationships>`);
});
// presentation.xml: daftar slide + font tertanam (Poppins regular+bold saja)
let pres = strFromU8(z['ppt/presentation.xml']);
let prels = strFromU8(z['ppt/_rels/presentation.xml.rels']);
prels = prels.replace(/<Relationship [^>]*relationships\/slide"[^>]*\/>/g, '').replace(/<Relationship [^>]*Target="slides\/[^"]*"[^>]*\/>/g, '');
const ids = slides.map((_, i) => ({ id: 256 + i, rid: 'rIdS' + (i + 1) }));
prels = prels.replace('</Relationships>', ids.map((s, i) => `<Relationship Id="${s.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('') + '</Relationships>');
pres = pres.replace(/<p:sldIdLst>.*?<\/p:sldIdLst>/s, `<p:sldIdLst>${ids.map(s => `<p:sldId id="${s.id}" r:id="${s.rid}"/>`).join('')}</p:sldIdLst>`);
if (!process.env.KEEPFONTS) pres = pres.replace(/<p:embeddedFontLst>.*?<\/p:embeddedFontLst>/s, '<p:embeddedFontLst><p:embeddedFont><p:font typeface="Poppins" pitchFamily="2" charset="0"/><p:regular r:id="rId22"/><p:bold r:id="rId20"/></p:embeddedFont></p:embeddedFontLst>');
if (!process.env.KEEPFONTS) for (const n of [17, 18, 19, 21, 23, 24]) { delete out[`ppt/fonts/font${n}.fntdata`]; prels = prels.replace(new RegExp(`<Relationship [^>]*Id="rId${n}"[^>]*/>`), ''); }
out['ppt/presentation.xml'] = strToU8(pres);
out['ppt/_rels/presentation.xml.rels'] = strToU8(prels);
let ct = strFromU8(z['[Content_Types].xml']).replace(/<Override [^>]*PartName="\/ppt\/slides\/[^>]*\/>/g, '');
ct = ct.replace('</Types>', slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>');
out['[Content_Types].xml'] = strToU8(ct);
out['docProps/app.xml'] = strToU8(strFromU8(z['docProps/app.xml']).replace(/<Slides>\d+<\/Slides>/, `<Slides>${slides.length}</Slides>`));
delete out['docProps/thumbnail.jpeg']; out['_rels/.rels'] = strToU8(strFromU8(z['_rels/.rels']).replace(/<Relationship [^>]*thumbnail[^>]*\/>/, ''));
writeFileSync(OUT, zipSync(out));
console.log('slide', slides.length, 'berkas', OUT);
for (const l of LAPORAN) console.log(l[0], l.slice(1).map(f => `${f.size}pt${f.muat ? '' : ' TIDAK MUAT'}`).join(' '));
