// npm run verify:export: periksa isi berkas ekspor tanpa browser.
import { strFromU8, unzipSync } from 'fflate';
import { pengaturanAwal } from '../lib/config';
import { muatDataNode } from '../lib/data-node';
import { buatPaket } from '../lib/generate';
import { buatBerkas, tanpaAcuan } from '../lib/export/jalankan';
import { HEADER_SIADU, petaSiadu, siaduExcel, siaduWord, soalAcuan } from '../lib/export/siadu';
import { amanPdf, blokDokumen } from '../lib/export/common';
import { pdfPaket } from '../lib/export/pdf';
import { wordPaket } from '../lib/export/word';
import { csvPaket, jsonPaket } from '../lib/export/data';
import type { Pengaturan } from '../lib/types';
import { HURUF } from '../lib/config';
import { bacaHasilUji, htmlUji, statistik, type SesiUji } from '../lib/uji';
import { bagian, cek, selesai } from './harness';

const data = muatDataNode();
const peng: Pengaturan = { ...pengaturanAwal(), tanggalAcuan: '2026-11-02', jumlahPaket: 2, jumlahSoal: 40, sumber: 'campuran' };
const { paket } = buatPaket(data, peng);
const p1 = [paket[0]];
const n = paket[0].soal.length;
const nKasus = blokDokumen(p1, peng, 'naskah').filter((b) => b.k === 'kasus').length;
const docxXml = (isi: Uint8Array) => strFromU8(unzipSync(isi)['word/document.xml']);
const teksDocx = (xml: string) => (xml.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(' ');
const hitung = (teks: string, re: RegExp) => (teks.match(re) ?? []).length;

async function main() {
  bagian('PDF');
  const pdfLengkap = Buffer.from(pdfPaket(p1, peng, 'lengkap', false)).toString('latin1');
  cek('PDF valid (%PDF)', pdfLengkap.startsWith('%PDF-'));
  cek('lengkap: jawaban untuk setiap soal', hitung(pdfLengkap, /\(Jawaban: [A-D]\) Tj/g) === n, hitung(pdfLengkap, /\(Jawaban: [A-D]\) Tj/g));
  cek('lengkap: label Pembahasan untuk setiap soal', hitung(pdfLengkap, /\(Pembahasan:\) Tj/g) === n);
  cek('lengkap: kotak kasus sebanyak blok kasus', hitung(pdfLengkap, /\(Kasus\) Tj/g) === nKasus, { pdf: hitung(pdfLengkap, /\(Kasus\) Tj/g), nKasus });
  const pdfNaskah = Buffer.from(pdfPaket(p1, peng, 'naskah', false)).toString('latin1');
  cek('naskah: tanpa jawaban dan pembahasan', !/Jawaban:|Pembahasan:/.test(pdfNaskah));
  const pdfSJ = Buffer.from(pdfPaket(p1, peng, 'soal-jawaban', false)).toString('latin1');
  cek('soal-jawaban: ada jawaban, tanpa pembahasan', hitung(pdfSJ, /\(Jawaban: [A-D]\) Tj/g) === n && !/Pembahasan:/.test(pdfSJ));
  const pdfKunci = Buffer.from(pdfPaket(p1, peng, 'kunci', false)).toString('latin1');
  cek('kunci: tabel kunci tanpa batang soal', hitung(pdfKunci, /\([A-D]\) Tj/g) >= n && !pdfKunci.includes('(' + amanPdf(paket[0].soal[0].soal).slice(0, 20)));
  const halaman = hitung(pdfLengkap, /\/Type \/Page\b/g);
  cek('nomor halaman tercetak di setiap halaman', hitung(pdfLengkap, /\(Halaman \d+ dari \d+\) Tj/g) === halaman && halaman > 1, halaman);
  cek('amanPdf mengganti karakter di luar WinAnsi', amanPdf('a → b ≤ c − d “e”') === 'a -> b <= c - d "e"', amanPdf('a → b ≤ c − d “e”'));
  const pdf2 = Buffer.from(pdfPaket(paket, peng, 'naskah', false)).toString('latin1');
  cek('dua paket: judul tiap paket', /Tingkat C · P1|Tingkat C · P1/.test(pdf2) && /P2\) Tj/.test(pdf2));

  bagian('Word');
  const xmlL = docxXml(await wordPaket(p1, peng, 'lengkap'));
  const tL = teksDocx(xmlL);
  cek('Word lengkap: jawaban setiap soal', hitung(tL, /Jawaban: [A-D]/g) === n);
  cek('Word lengkap: pembahasan setiap soal', hitung(tL, /Pembahasan:/g) === n);
  cek('Word: teks soal pertama utuh', tL.includes(paket[0].soal[0].soal.slice(0, 60).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) || tL.includes(paket[0].soal[0].soal.slice(0, 40)));
  const xmlN = docxXml(await wordPaket(p1, peng, 'naskah'));
  cek('Word naskah: tanpa jawaban', !/Jawaban:|Pembahasan:/.test(teksDocx(xmlN)));
  const gaya = strFromU8(unzipSync(await wordPaket(p1, peng, 'naskah'))['word/styles.xml']);
  cek('Word: Times New Roman 12 pt', gaya.includes('Times New Roman') && /w:sz w:val="24"/.test(gaya));

  bagian('CSV dan JSON');
  const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csvPaket(paket));
  cek('CSV ber-BOM UTF-8', csv.charCodeAt(0) === 0xfeff);
  const kepala = csv.slice(1).split('\r\n')[0].split(',');
  cek('CSV memuat kolom kunci, opsi, pembahasan', ['kunci', 'opsi_a', 'opsi_d', 'inti', 'dasar_hukum', 'checksum'].every((k) => kepala.includes(k)));
  const barisData = csv.split('\r\n').filter((l) => /^"?P\d/.test(l)).length;
  cek('CSV: satu baris per soal', barisData === paket.reduce((a, p) => a + p.soal.length, 0), barisData);
  const js = JSON.parse(new TextDecoder().decode(jsonPaket(paket, peng)));
  cek('JSON terstruktur', js.format === 'ukp-studio-paket' && js.paket.length === 2 && js.paket[0].soal[0].checksum);

  bagian('Word dan Excel SiAdu');
  const docSiadu = await siaduWord(p1, peng, 'pembahasan', data.mapping.siadu);
  const xmlS = docxXml(docSiadu);
  const parS = (xmlS.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map((p) => teksDocx(p).trim()).filter(Boolean);
  const iSoal = parS.map((t, i) => (/^Soal \d+$/.test(t) ? i : -1)).filter((i) => i >= 0);
  cek('SiAdu: satu penanda "Soal N" per soal, bernomor urut', iSoal.length === n && iSoal.every((i, k) => parS[i] === 'Soal ' + (k + 1)));
  const urutBenar = iSoal.every((i) => parS[i + 1].startsWith('Category: UKP Tingkat ') && parS[i + 2].startsWith('Lesson: ') && parS[i + 3].startsWith('Chapter: ') && parS[i + 4] === 'Bentuk Soal: Option New' && /^Tingkat Kesulitan: (Mudah|Sedang|Sulit)$/.test(parS[i + 5]));
  cek('SiAdu: Category, Lesson, Chapter, Bentuk Soal, Tingkat Kesulitan berurutan', urutBenar);
  const blokSoal = iSoal.map((i, k) => parS.slice(i, iSoal[k + 1] ?? parS.length));
  cek('SiAdu: opsi A–D, Jawaban, Pembahasan di tiap soal', blokSoal.every((b, k) => ['A', 'B', 'C', 'D'].every((h) => b.some((t) => t.startsWith(h + '. '))) && b.includes('Jawaban: ' + paket[0].soal[k].kunci) && b.includes('Pembahasan:')));
  cek('SiAdu: soal kasus memuat teks kasus', paket[0].soal.every((s, k) => !s.kasus || blokSoal[k].some((t) => t === s.kasus!.replace(/\s+/g, ' ').trim())));
  const gayaS = strFromU8(unzipSync(docSiadu)['word/styles.xml']);
  cek('SiAdu: gaya SiaduQuestion dan SiaduAnswer tebal, Times New Roman', /w:styleId="SiaduQuestion"/.test(gayaS) && /w:styleId="SiaduAnswer"/.test(gayaS) && gayaS.includes('Times New Roman'));
  const tanpaBahas = teksDocx(docxXml(await siaduWord(p1, peng, 'soal-jawaban')));
  cek('SiAdu tanpa pembahasan: jawaban ada, pembahasan tidak', hitung(tanpaBahas, /Jawaban: [A-D]/g) === n && !/Pembahasan:/.test(tanpaBahas) && tanpaBahas.includes('Isi dokumen: Soal + jawaban tanpa pembahasan'));
  const xl = unzipSync(siaduExcel(p1));
  const sheet = strFromU8(xl['xl/worksheets/sheet1.xml']);
  const wb = strFromU8(xl['xl/workbook.xml']);
  cek('Excel: sheet SOAL dan PETUNJUK', /name="SOAL"/.test(wb) && /name="PETUNJUK"/.test(wb));
  const sel = (r: number) => [...(sheet.match(new RegExp('<row r="' + r + '">([\\s\\S]*?)</row>'))?.[1] ?? '').matchAll(/<c r="([A-Z]+)\d+"[^>]*>(?:<is><t[^>]*>([\s\S]*?)<\/t><\/is>|<v>([^<]*)<\/v>)<\/c>/g)].map((m) => [m[1], m[2] ?? m[3]]);
  cek('Excel: header persis template SiAdu (21 kolom)', JSON.stringify(sel(1).map((x) => x[1])) === JSON.stringify(HEADER_SIADU) && HEADER_SIADU.length === 21);
  const b2 = Object.fromEntries(sel(2));
  cek('Excel: baris soal 1 (level, kunci, answer_type, opsi)', ['Mudah', 'Sedang', 'Sulit'].includes(b2.B) && b2.I === paket[0].soal[0].kunci && b2.Q === 'option_new' && b2.D && !b2.H && !b2.J);
  cek('Excel: satu baris per soal', (sheet.match(/<row /g) ?? []).length === n + 1);
  cek('Excel: tanpa pembahasan mengosongkan kolom pembahasan', !Object.fromEntries((() => { const x = unzipSync(siaduExcel(p1, 'soal-jawaban')); const s2 = strFromU8(x['xl/worksheets/sheet1.xml']); return [...(s2.match(/<row r="2">([\s\S]*?)<\/row>/)?.[1] ?? '').matchAll(/<c r="([A-Z]+)\d+"/g)].map((m) => [m[1], 1]); })()).P);
  cek('Excel: XML aman dari karakter kontrol', !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(sheet));
  let galatK2 = '';
  try { await buatBerkas({ format: 'siadu-word', mode: 'lengkap', paket: p1, peng, gabung: true }); } catch (e) { galatK2 = (e as Error).message; }
  const adaAcuan = soalAcuan(p1).length;
  cek('K2: SiAdu dengan soal acuan ditolak tanpa konfirmasi', adaAcuan > 0 && /acuan internal/.test(galatK2), { adaAcuan, galatK2 });
  const setuju = await buatBerkas({ format: 'siadu-word', mode: 'lengkap', paket: p1, peng, gabung: true, setujuAcuan: true });
  cek('K2: dengan konfirmasi berhasil', setuju.nama.endsWith('-siadu.docx'));
  const bersih = tanpaAcuan(p1);
  cek('K2: tanpaAcuan hanya menyisakan soal baru/orisinal', bersih.every((p) => p.soal.every((s) => s.asal === 'model' || s.asal === 'orisinal')) && bersih[0].soal.length === n - adaAcuan);
  const sjSiadu = await buatBerkas({ format: 'siadu-excel', mode: 'soal-jawaban', paket: bersih, peng, gabung: true });
  cek('Excel SiAdu tanpa pembahasan bernama -tanpa-pembahasan', sjSiadu.nama.endsWith('-siadu-tanpa-pembahasan.xlsx'));
  let galatMode = '';
  try { await buatBerkas({ format: 'siadu-word', mode: 'naskah', paket: bersih, peng, gabung: true }); } catch (e) { galatMode = (e as Error).message; }
  cek('SiAdu menolak isi "naskah"', /tidak tersedia/.test(galatMode));
  cek('petaSiadu memakai template mapping', petaSiadu(paket[0].soal[0], { category: 'X {tingkat}', lesson: '{kode}', chapter: '{subtema}' }).lesson === paket[0].soal[0].kode);

  bagian('Uji peserta (Tahap 5)');
  const html = htmlUji(paket[0], peng);
  const dataUji = JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)![1]);
  cek('HTML uji: satu butir per soal dengan uid dan checksum', dataUji.butir.length === n && dataUji.butir.every((b: { uid: string; checksum: string }, i: number) => b.uid === paket[0].soal[i].uid && b.checksum === paket[0].soal[i].checksum));
  cek('HTML uji: tanpa kunci, pembahasan, atau asal soal', !/"kunci"|"inti"|"langkah"|"kenapaSalah"|"dasarHukum"|"sumberId"|"modelId"/.test(html) && !paket[0].soal.some((s) => html.includes(s.inti.slice(0, 40).replace(/</g, '\\u003c'))));
  cek('HTML uji: teks berbahaya di-escape', !/<\/script>[\s\S]*<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')));
  const sesiPalsu = (i: number, jawab: (k: string, j: number) => string | null, checksum = (c: string) => c): SesiUji => ({
    format: 'ukp-studio-hasil-uji', versi: 1, id: 'sesi-' + i, paketId: paket[0].id, seed: peng.seed, peserta: 'P' + i, mulai: '2026-11-02T01:00:00Z', selesai: '2026-11-02T02:00:00Z',
    jawaban: paket[0].soal.map((s, j) => ({ uid: s.uid, checksum: checksum(s.checksum), jawab: jawab(s.kunci, j) as never, detik: 30 + j })),
  });
  // 40 sesi: peserta i menjawab benar pada soal j bila (i + j) % 4 < kemampuan(i).
  const sesi40 = Array.from({ length: 40 }, (_, i) => sesiPalsu(i, (k, j) => ((i * 7 + j * 3) % 10 < 3 + (i % 6) ? k : (['A', 'B', 'C', 'D'].find((h) => h !== k) ?? null))));
  const st = statistik(paket[0], sesi40);
  cek('statistik: 40 sesi lengkap', st.sesi === 40 && st.sesiLengkap === 40);
  cek('statistik: p benar dalam 0–1 dan frekuensi berjumlah N', st.butir.every((b) => b.p !== null && b.p >= 0 && b.p <= 1 && HURUF.reduce((a, h) => a + b.frek[h], 0) + b.frek.kosong === b.n));
  cek('statistik: daya beda dihitung pada ≥ 30 sesi', st.butir.some((b) => b.dayaBeda !== null));
  cek('statistik: label empiris pada ≥ 30 respons', st.butir.every((b) => b.labelEmpiris !== null));
  const stKecil = statistik(paket[0], sesi40.slice(0, 10));
  cek('statistik: < 30 sesi tanpa daya beda dan label', stKecil.butir.every((b) => b.dayaBeda === null && b.labelEmpiris === null));
  const lama = sesiPalsu(99, (k) => k, (c) => c + '-lama');
  cek('statistik: respons versi lama tidak dicampur', statistik(paket[0], [lama]).butir.every((b) => b.n === 0 && b.tidakCocok === 1));
  cek('bacaHasilUji: objek, larik, dan {sessions}', bacaHasilUji(JSON.stringify(sesi40[0])).length === 1 && bacaHasilUji(JSON.stringify(sesi40.slice(0, 3))).length === 3 && bacaHasilUji(JSON.stringify({ sessions: sesi40.slice(0, 2) })).length === 2);
  let tolak = '';
  try { bacaHasilUji('{"a":1}'); } catch (e) { tolak = (e as Error).message; }
  cek('bacaHasilUji menolak berkas lain', /tidak berisi hasil uji/.test(tolak));
  const ujiZip = await buatBerkas({ format: 'uji-html', mode: 'naskah', paket, peng, gabung: true });
  cek('uji-html untuk 2 paket → ZIP berisi 2 HTML', ujiZip.nama.endsWith('.zip') && Object.keys(unzipSync(ujiZip.isi)).filter((k) => k.endsWith('-uji.html')).length === 2);

  bagian('Pengiriman berkas');
  const zip = await buatBerkas({ format: 'pdf', mode: 'naskah', paket, peng, gabung: false });
  const isiZip = unzipSync(zip.isi);
  cek('ZIP per paket berisi 2 PDF', zip.nama.endsWith('.zip') && Object.keys(isiZip).length === 2 && Object.keys(isiZip).every((k) => k.endsWith('.pdf')), Object.keys(isiZip));
  const satu = await buatBerkas({ format: 'word', mode: 'lengkap', paket, peng, gabung: true });
  cek('satu berkas Word untuk semua paket', satu.nama.endsWith('.docx') && hitung(teksDocx(docxXml(satu.isi)), /Jawaban: [A-D]/g) === paket.reduce((a, p) => a + p.soal.length, 0));
  let kosong = '';
  try { await buatBerkas({ format: 'pdf', mode: 'naskah', paket: [{ ...paket[0], soal: [] }], peng, gabung: true }); } catch (e) { kosong = (e as Error).message; }
  cek('paket kosong ditolak', /Tidak ada soal/.test(kosong));
  selesai('verify:export');
}
main();
