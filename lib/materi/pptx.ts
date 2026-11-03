// Penulis .pptx: paket dasar template (tema, master, font Poppins, media) + slide hasil tata letak.
// Berjalan di browser dan Node (fflate). Pengaturan dan naskah yang sama menghasilkan berkas yang sama.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { ASET_SVG, type Aset, type Kotak, type KotakBentuk, type KotakGambar, type KotakGaris, type KotakTeks, type SlideJadi } from './kotak';
import { LEKUK_BUTIR } from './metrik';
import { adaTeksAcuan, type Naskah } from './naskah';
import { tataLetak } from './tata-letak';

const EMU = 12700;
const LAYOUT = 'slideLayout7.xml';
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT_SLIDE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const CT_CATATAN = 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml';
const SVG_EXT = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';

const emu = (pt: number) => Math.round(pt * EMU);
const bersih = (s: string) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
const esc = (s: string) => bersih(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function warna(hex: string, alfa?: number) {
  return `<a:srgbClr val="${hex}">${alfa != null && alfa < 100 ? `<a:alpha val="${Math.round(alfa * 1000)}"/>` : ''}</a:srgbClr>`;
}
function isiGradien(g: { dari: string; ke: string; sudut: number; alfa?: number }) {
  return `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0">${warna(g.dari, g.alfa)}</a:gs><a:gs pos="100000">${warna(g.ke, g.alfa)}</a:gs></a:gsLst><a:lin ang="${Math.round(g.sudut * 60000)}" scaled="0"/></a:gradFill>`;
}
const xfrm = (x: number, y: number, w: number, h: number) => `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`;

class Penulis {
  id = 2;
  rels = new Map<string, string>(); // nama berkas media → rId
  ambilRel(berkas: string) {
    if (!this.rels.has(berkas)) this.rels.set(berkas, 'rId' + (this.rels.size + 2));
    return this.rels.get(berkas)!;
  }
  nv(nama: string, jenis: 'sp' | 'pic' | 'cxnSp', extra = '') {
    const id = this.id++;
    const cNv = `<p:cNvPr id="${id}" name="${esc(nama)} ${id}"${extra}/>`;
    if (jenis === 'sp') return `<p:nvSpPr>${cNv}<p:cNvSpPr/><p:nvPr/></p:nvSpPr>`;
    if (jenis === 'pic') return `<p:nvPicPr>${cNv}<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`;
    return `<p:nvCxnSpPr>${cNv}<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>`;
  }
  bentuk(k: KotakBentuk) {
    const r = k.radius ?? 0;
    const geom = r > 0
      ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.min(50000, Math.round((r / Math.min(k.w, k.h)) * 100000))}"/></a:avLst></a:prstGeom>`
      : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
    const isi = k.gradien ? isiGradien(k.gradien) : k.isi ? `<a:solidFill>${warna(k.isi, k.alfa)}</a:solidFill>` : '<a:noFill/>';
    const ln = k.garis ? `<a:ln w="${emu(k.garis.tebal)}"><a:solidFill>${warna(k.garis.warna)}</a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
    const bayang = k.bayangan ? '<a:effectLst><a:outerShdw blurRad="190500" dist="63500" dir="5400000" algn="t" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="22000"/></a:srgbClr></a:outerShdw></a:effectLst>' : '';
    return `<p:sp>${this.nv(k.nama, 'sp')}<p:spPr>${xfrm(k.x, k.y, k.w, k.h)}${geom}${isi}${ln}${bayang}</p:spPr><p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="id-ID" dirty="0"/></a:p></p:txBody></p:sp>`;
  }
  teks(k: KotakTeks) {
    const paragraf = k.paragraf.length ? k.paragraf : [{ runs: [{ t: '' }] }];
    const ps = paragraf.map((p, i) => {
      const lekuk = p.butir ? ` marL="${emu(LEKUK_BUTIR * k.pt)}" indent="-${emu(LEKUK_BUTIR * k.pt)}"` : ' marL="0" indent="0"';
      const butir = p.butir ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>' : '<a:buNone/>';
      const pPr = `<a:pPr algn="${k.rata}"${lekuk}><a:lnSpc><a:spcPts val="${Math.round(k.pt * k.jarak * 100)}"/></a:lnSpc><a:spcBef><a:spcPts val="${i ? Math.round(k.pt * k.antarPar * 100) : 0}"/></a:spcBef>${butir}</a:pPr>`;
      const runs = p.runs.filter((r) => r.t !== '').map((r) => {
        const b = r.b ?? k.tebal, it = r.i ?? k.miring;
        const isi = r.warna ? `<a:solidFill>${warna(r.warna)}</a:solidFill>` : k.gradien ? isiGradien(k.gradien) : `<a:solidFill>${warna(k.warna)}</a:solidFill>`;
        return `<a:r><a:rPr lang="id-ID" sz="${Math.round(k.pt * 100)}" b="${b ? 1 : 0}" i="${it ? 1 : 0}" dirty="0">${isi}<a:latin typeface="Poppins"/><a:ea typeface="Poppins"/><a:cs typeface="Poppins"/></a:rPr><a:t>${esc(r.t)}</a:t></a:r>`;
      }).join('');
      return `<a:p>${pPr}${runs}<a:endParaRPr lang="id-ID" sz="${Math.round(k.pt * 100)}" dirty="0"/></a:p>`;
    }).join('');
    return `<p:sp>${this.nv(k.nama, 'sp').replace('<p:cNvSpPr/>', '<p:cNvSpPr txBox="1"/>')}<p:spPr>${xfrm(k.x, k.y, k.w, k.h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="${k.jangkar}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${ps}</p:txBody></p:sp>`;
  }
  gambar(k: KotakGambar) {
    const png = this.ambilRel(`${k.aset}.png`);
    const svg = ASET_SVG.includes(k.aset) ? this.ambilRel(`${k.aset}.svg`) : null;
    const alfa = k.opasitas != null ? `<a:alphaModFix amt="${Math.round(k.opasitas * 1000)}"/>` : '';
    const ext = svg ? `<a:extLst><a:ext uri="${SVG_EXT}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svg}"/></a:ext></a:extLst>` : '';
    return `<p:pic>${this.nv(k.nama, 'pic', ` descr="${esc(k.alt)}"`)}<p:blipFill><a:blip r:embed="${png}">${alfa}${ext}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(k.x, k.y, k.w, k.h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  }
  garis(k: KotakGaris) {
    const flipH = k.x2 < k.x1 ? ' flipH="1"' : '', flipV = k.y2 < k.y1 ? ' flipV="1"' : '';
    const x = Math.min(k.x1, k.x2), y = Math.min(k.y1, k.y2);
    return `<p:cxnSp>${this.nv(k.nama, 'cxnSp')}<p:spPr><a:xfrm${flipH}${flipV}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(Math.abs(k.x2 - k.x1))}" cy="${emu(Math.abs(k.y2 - k.y1))}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${emu(k.tebal)}"><a:solidFill>${warna(k.warna)}</a:solidFill></a:ln></p:spPr></p:cxnSp>`;
  }
  kotak(k: Kotak) {
    switch (k.jenis) {
      case 'bentuk': return this.bentuk(k);
      case 'teks': return this.teks(k);
      case 'gambar': return this.gambar(k);
      case 'garis': return this.garis(k);
    }
  }
}

/** Halaman catatan pembicara untuk slide ke-n (memakai master catatan di paket dasar). */
function xmlCatatan(teks: string, n: number) {
  const ps = teks.split('\n').map((t) => `<a:p><a:r><a:rPr lang="id-ID" dirty="0"/><a:t>${esc(t)}</a:t></a:r></a:p>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`
    + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Gambar slide"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>'
    + `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Catatan"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="3"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${ps}</p:txBody></p:sp>`
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="${R}/slide" Target="../slides/slide${n}.xml"/></Relationships>`;
  return { xml, rels };
}

function xmlSlide(s: SlideJadi) {
  const p = new Penulis();
  const isi = s.kotak.map((k) => p.kotak(k)).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${isi}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const media = [...p.rels.entries()].map(([berkas, id]) => `<Relationship Id="${id}" Type="${R}/image" Target="../media/${berkas}"/>`).join('');
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/${LAYOUT}"/>${media}</Relationships>`;
  return { xml, rels };
}

function waktuIso(s: string) {
  const d = new Date(s);
  return (isNaN(d.getTime()) ? new Date('2026-01-01T00:00:00Z') : d).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface HasilPptx { berkas: Uint8Array; slides: SlideJadi[]; drafInternal: boolean }

/** Render naskah menjadi .pptx di atas paket dasar (assets/materi/dasar.pptx). */
export function tulisPptx(naskah: Naskah, dasar: Uint8Array, opsi: { ditelaah?: boolean; tanpaCatatan?: boolean } = {}): HasilPptx {
  // Deck yang sudah ditelaah tidak lagi diberi tanda Draf internal (PRD-Materi KM2).
  const draf = adaTeksAcuan(naskah) && !opsi.ditelaah;
  const slides = tataLetak(naskah, { tandaDraf: draf });
  if (!slides.length) throw new Error('Naskah tidak punya slide yang ditampilkan.');
  const z = unzipSync(dasar);
  if (!z['ppt/slideLayouts/' + LAYOUT]) throw new Error('Paket dasar tidak memuat ' + LAYOUT);
  const out: Record<string, Uint8Array> = { ...z };
  const ids: string[] = [], relSlide: string[] = [], ct: string[] = [];
  const adaCatatan = !!z['ppt/notesMasters/notesMaster1.xml'];
  let jumlahCatatan = 0;
  slides.forEach((s, i) => {
    const n = i + 1;
    const { xml, rels } = xmlSlide(s);
    for (const m of rels.matchAll(/Target="\.\.\/media\/([^"]+)"/g)) if (!z['ppt/media/' + m[1]]) throw new Error('Media tidak ada di paket dasar: ' + m[1]);
    out[`ppt/slides/slide${n}.xml`] = strToU8(xml);
    let relsSlide = rels;
    // Handout peserta (R9) tidak memuat catatan pembicara.
    if (s.catatan && adaCatatan && !opsi.tanpaCatatan) {
      const c = xmlCatatan(s.catatan, n);
      out[`ppt/notesSlides/notesSlide${n}.xml`] = strToU8(c.xml);
      out[`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`] = strToU8(c.rels);
      relsSlide = rels.replace('</Relationships>', `<Relationship Id="rIdCatatan" Type="${R}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/></Relationships>`);
      ct.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="${CT_CATATAN}"/>`);
      jumlahCatatan++;
    }
    out[`ppt/slides/_rels/slide${n}.xml.rels`] = strToU8(relsSlide);
    ids.push(`<p:sldId id="${255 + n}" r:id="rIdS${n}"/>`);
    relSlide.push(`<Relationship Id="rIdS${n}" Type="${R}/slide" Target="slides/slide${n}.xml"/>`);
    ct.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${CT_SLIDE}"/>`);
  });
  const pres = strFromU8(z['ppt/presentation.xml']);
  if (!pres.includes('<p:sldIdLst></p:sldIdLst>')) throw new Error('Paket dasar tidak berisi daftar slide kosong; jalankan npm run materi:dasar.');
  out['ppt/presentation.xml'] = strToU8(pres.replace('<p:sldIdLst></p:sldIdLst>', `<p:sldIdLst>${ids.join('')}</p:sldIdLst>`));
  out['ppt/_rels/presentation.xml.rels'] = strToU8(strFromU8(z['ppt/_rels/presentation.xml.rels']).replace('</Relationships>', relSlide.join('') + '</Relationships>'));
  out['[Content_Types].xml'] = strToU8(strFromU8(z['[Content_Types].xml']).replace('</Types>', ct.join('') + '</Types>'));
  const waktu = waktuIso(naskah.dibuat);
  out['docProps/app.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>UKP Studio</Application><PresentationFormat>Kustom</PresentationFormat><Slides>${slides.length}</Slides><Notes>${jumlahCatatan}</Notes><HiddenSlides>0</HiddenSlides><AppVersion>16.0000</AppVersion></Properties>`);
  out['docProps/core.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(naskah.judul)}</dc:title><dc:subject>${esc([naskah.materi, naskah.subtema].filter(Boolean).join(' · '))}</dc:subject><dc:creator>UKP Studio</dc:creator><cp:keywords>${esc(['UKP', naskah.kode, naskah.tingkat && 'Tingkat ' + naskah.tingkat, 'aturan per ' + naskah.tanggalAcuan, draf && 'Draf internal'].filter(Boolean).join('; '))}</cp:keywords>${draf ? '<cp:category>Draf internal</cp:category><dc:description>Memuat teks acuan LatihUKP yang belum ditulis ulang atau ditelaah (PRD-Materi KM2). Bukan untuk dibagikan ke peserta.</dc:description>' : ''}<cp:lastModifiedBy>UKP Studio</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${waktu}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${waktu}</dcterms:modified></cp:coreProperties>`);
  const mtime = new Date(waktu);
  const urut = Object.keys(out).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : a.localeCompare(b)));
  const berkas = zipSync(Object.fromEntries(urut.map((p) => [p, [out[p], { mtime }]])) as Parameters<typeof zipSync>[0], { level: 6 });
  return { berkas, slides, drafInternal: draf };
}
