// npm run materi -- [opsi]: susun deck materi .pptx tanpa browser lalu tulis berkasnya.
// Contoh: npm run materi -- --tingkat A --kode PPN --setuju-acuan --out output/materi-ppn
//         npm run materi -- --tingkat B --gabung --setuju-acuan   (satu deck per materi Tingkat B)
//         npm run materi -- --tingkat A --silabus --menit-pertemuan 90   (silabus .xlsx per tingkat)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hariIni, TINGKAT, URUTAN_KODE } from '../lib/config';
import { muatDataNode } from '../lib/data-node';
import { slug } from '../lib/export/common';
import { zip } from '../lib/export/unduh';
import { periksaPaket, periksaTataLetak } from '../lib/materi/cek';
import { naskahHandout } from '../lib/materi/handout';
import { hierarkiDeck, jalurBerkasDeck, namaDeckGabungan, type JenisBerkasDeck } from '../lib/materi/jalur';
import { adaTeksAcuan } from '../lib/materi/naskah';
import { tulisPptx } from '../lib/materi/pptx';
import { lembarSilabus, namaBerkasSilabus, PILIHAN_MENIT_PERTEMUAN, ringkasSilabus, susunSilabus } from '../lib/materi/silabus';
import { daftarSubtema, PENGATURAN_MATERI_AWAL, susunNaskah, susunNaskahMateri, type Kepadatan, type PengaturanMateri, type SumberSoalMateri } from '../lib/materi/susun';
import type { Kode, Tingkat } from '../lib/types';

const BANTUAN = `Pemakaian: npm run materi -- [opsi]
  --tingkat A|B|C            cakupan kumulatif (bawaan C): A 34 subtema, A+B 48, A+B+C 69
  --kode PPN,KUP             per materi: semua subtema kode ini dalam cakupan tingkat
  --subtema "PPN::DPP & tarif PPN;KUP::Sanksi administrasi"   per subtema (pisahkan dengan ;)
  --hanya-baru               per tingkat: hanya subtema yang mulai di tingkat itu (B 14, C 21)
                             tanpa --kode dan --subtema: semua subtema dalam cakupan tingkat
  --gabung                   satu deck per materi berisi subtema dalam lingkup (daftar isi, pembatas per subtema)
  --kepadatan ringkas|standar|lengkap  (bawaan standar)
  --contoh-soal 0|1|2        contoh soal per deck (bawaan 1)
  --kuis 0|3|5               butir kuis Benar/Salah per deck (bawaan 3)
  --sumber-soal baru|bank    contoh soal dari model & orisinal (bawaan) atau boleh bank acuan LatihUKP
  --tanggal YYYY-MM-DD       tanggal acuan aturan (bawaan hari ini)
  --seed TEKS                bawaan MATERI-01
  --format pptx,json         pptx (deck) dan/atau json (naskah); bawaan pptx
  --zip                      bungkus semua berkas menjadi satu .zip
                             lebih dari satu berkas ditulis berhierarki: Tingkat / Materi / Subtema
  --handout                  .pptx versi peserta: rangkuman, rumus, dan kuis tanpa catatan pembicara (nama berkas -handout)
  --pdf                      simpan juga PDF setiap .pptx lewat PowerPoint (Windows dengan PowerPoint; tidak bersama --zip)
  --setuju-acuan             izinkan .pptx yang memuat teks acuan LatihUKP, diberi tanda Draf internal (PRD-Materi KM2)
  --daftar                   tampilkan subtema dalam lingkup tanpa menulis berkas
  --silabus                  silabus per tingkat (.xlsx): deck gabungan per materi, durasi dari jumlah slide, dibagi ke pertemuan
                             (pakai --tingkat, --hanya-baru, --kepadatan, --contoh-soal, --kuis; tanpa --kode/--subtema)
  --menit-pertemuan 60|90|120|180   durasi satu pertemuan untuk --silabus (bawaan 90)
  --out FOLDER               bawaan output/materi-<lingkup>`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { console.log(BANTUAN); process.exit(0); }
const ambil = (nama: string) => { const i = args.indexOf(nama); return i >= 0 ? args[i + 1] : undefined; };
const gagal = (pesan: string): never => { console.error('Error: ' + pesan); process.exit(1); };
const pilihan = <T extends string>(nama: string, boleh: readonly T[], bawaan: T): T => {
  const v = (ambil(nama) ?? bawaan) as T;
  if (!boleh.includes(v)) gagal(nama + ' harus salah satu dari: ' + boleh.join(', '));
  return v;
};

const tingkat = (ambil('--tingkat') ?? 'C').toUpperCase() as Tingkat;
if (!TINGKAT.includes(tingkat)) gagal('--tingkat harus A, B, atau C');
const kepadatan = pilihan<Kepadatan>('--kepadatan', ['ringkas', 'standar', 'lengkap'], 'standar');
const sumberSoal = pilihan<SumberSoalMateri>('--sumber-soal', ['baru', 'bank'], 'baru');
const jumlahSoal = Number(pilihan('--contoh-soal', ['0', '1', '2'], '1'));
const jumlahKuis = Number(pilihan('--kuis', ['0', '3', '5'], '3'));
const tanggalAcuan = ambil('--tanggal') ?? hariIni();
if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalAcuan)) gagal('--tanggal harus YYYY-MM-DD');
const format = (ambil('--format') ?? 'pptx').split(',').map((s) => s.trim());
for (const f of format) if (!['pptx', 'json'].includes(f)) gagal('format tidak dikenal: ' + f + ' (pptx atau json)');
const kode = ambil('--kode') ? ambil('--kode')!.split(',').map((s) => s.trim().toUpperCase()) as Kode[] : [];
for (const k of kode) if (!URUTAN_KODE.includes(k)) gagal('kode materi tidak dikenal: ' + k);
const subtemaDiminta = (ambil('--subtema') ?? '').split(';').map((s) => s.trim()).filter(Boolean);
const hanyaBaru = args.includes('--hanya-baru');
const gabung = args.includes('--gabung');
const handout = args.includes('--handout');
const pdf = args.includes('--pdf');
if (pdf && args.includes('--zip')) gagal('--pdf tidak bisa bersama --zip; PDF ditulis di sebelah .pptx');
if (pdf && !format.includes('pptx')) gagal('--pdf membutuhkan --format pptx');
if (pdf && process.platform !== 'win32') gagal('--pdf hanya di Windows dengan PowerPoint terpasang');
if (hanyaBaru && (kode.length || subtemaDiminta.length)) gagal('--hanya-baru hanya untuk lingkup tingkat (tanpa --kode dan --subtema)');
const lingkup = subtemaDiminta.length ? 'subtema' : kode.length ? 'materi' : 'tingkat';
const silabus = args.includes('--silabus');
if (silabus && lingkup !== 'tingkat') gagal('--silabus hanya untuk lingkup tingkat (tanpa --kode dan --subtema)');
const menitPertemuan = Number(pilihan('--menit-pertemuan', PILIHAN_MENIT_PERTEMUAN.map(String), '90'));

function main() {
  const data = muatDataNode();
  // Subtema dalam cakupan tingkat, urut materi (sama dengan tab Materi).
  const cakupan = daftarSubtema(data, tingkat, tanggalAcuan);
  const urut = data.mapping.materi.flatMap((m) => cakupan.filter((s) => s.kode === m.kode));
  let pilih = urut;
  if (lingkup === 'subtema') {
    const diluar = subtemaDiminta.filter((x) => !urut.some((s) => s.kode + '::' + s.subtema === x));
    if (diluar.length) gagal('subtema tidak dikenal atau di luar cakupan Tingkat ' + tingkat + ' pada ' + tanggalAcuan + ': ' + diluar.join('; '));
    pilih = urut.filter((s) => subtemaDiminta.includes(s.kode + '::' + s.subtema));
  } else if (lingkup === 'materi') {
    const kosong = kode.filter((k) => !urut.some((s) => s.kode === k));
    if (kosong.length) gagal('materi ' + kosong.join(', ') + ' tidak punya subtema dalam cakupan Tingkat ' + tingkat);
    pilih = urut.filter((s) => kode.includes(s.kode));
  } else if (hanyaBaru) pilih = urut.filter((s) => s.tingkat === tingkat);

  const tambahan = hanyaBaru && tingkat !== 'A';
  const label = lingkup === 'subtema' ? 'subtema' : lingkup === 'materi' ? 'materi ' + kode.join('+') : 'tingkat ' + tingkat + (tambahan ? ' (hanya tambahan)' : '');
  // Nama folder dan .zip sama dengan unduhan tab Materi, misalnya materi-tingkat-b-tambahan-23-deck.zip.
  const namaDasar = 'materi-' + (lingkup === 'subtema' ? 'subtema' : lingkup === 'materi' ? slug(kode.join('-')) : 'tingkat-' + tingkat.toLowerCase() + (tambahan ? '-tambahan' : '')) + (gabung ? '-per-materi' : '');
  if (args.includes('--daftar')) {
    for (const s of pilih) console.log('DAFTAR -> ' + s.kode + '::' + s.subtema + ' · Tingkat ' + s.tingkat + ' · ' + s.aturan + ' aturan');
    console.log('RINGKASAN -> ' + pilih.length + ' subtema, lingkup ' + label + ', cakupan Tingkat ' + tingkat);
    return;
  }

  const dibuat = new Date().toISOString();
  if (silabus) {
    const s = susunSilabus(data, { tingkat, hanyaBaru, menitPertemuan, deck: { ...PENGATURAN_MATERI_AWAL, kepadatan, sumberSoal, jumlahSoal, jumlahKuis, tanggalAcuan, dibuat, seed: ambil('--seed') ?? PENGATURAN_MATERI_AWAL.seed } });
    const out = path.resolve(ambil('--out') ?? path.join('output', namaBerkasSilabus(s).replace(/\.xlsx$/, '')));
    mkdirSync(out, { recursive: true });
    const f = path.join(out, namaBerkasSilabus(s));
    writeFileSync(f, lembarSilabus(data, s));
    console.log('RINGKASAN -> silabus ' + ringkasSilabus(s) + ' (kepadatan ' + kepadatan + ', aturan per ' + tanggalAcuan + ')');
    console.log('BERKAS -> ' + f);
    return;
  }
  const dasar = new Uint8Array(readFileSync(path.join('assets', 'materi', 'dasar.pptx')));
  // --gabung: satu deck per materi berisi subtema dalam lingkup; tanpa itu satu deck per subtema.
  const kelompok = gabung
    ? [...new Set(pilih.map((s) => s.kode))].map((k) => ({ kode: k, subtema: pilih.filter((s) => s.kode === k) }))
    : pilih.map((s) => ({ kode: s.kode, subtema: [s] }));
  // Sama dengan unduhan tab Materi: satu berkas langsung, lebih dari satu berhierarki Tingkat / Materi / Subtema.
  const hierarki = hierarkiDeck(data, tingkat, tanggalAcuan, tambahan);
  const berhierarki = kelompok.length * format.length > 1;
  const namaKeluaran = (k: Kode, sub: string | null, jenis: JenisBerkasDeck) => {
    if (berhierarki) return jalurBerkasDeck(hierarki, k, sub, jenis);
    if (sub === null) return namaDeckGabungan(k, tingkat, tambahan, jenis);
    const dasar = slug(k) + '-' + slug(sub);
    return jenis === 'naskah' ? 'naskah-' + dasar + '.json' : 'materi-' + dasar + (jenis === 'handout' ? '-handout' : '') + '.pptx';
  };
  const isiBerkas: Record<string, Uint8Array> = {};
  const laporan: unknown[] = [];
  const galat: string[] = [];
  let slide = 0, draf = 0, meluap = 0;
  for (const g of kelompok) {
    const nama1 = g.subtema.map((s) => s.subtema);
    const peng: PengaturanMateri = { ...PENGATURAN_MATERI_AWAL, kode: g.kode, subtema: gabung ? '' : nama1[0], gabung: gabung ? nama1 : undefined, tingkat, kepadatan, sumberSoal, jumlahSoal, jumlahKuis, tanggalAcuan, dibuat, seed: ambil('--seed') ?? PENGATURAN_MATERI_AWAL.seed };
    try {
      const naskah = gabung ? susunNaskahMateri(data, peng, nama1) : susunNaskah(data, peng);
      const hasil = handout ? tulisPptx(naskahHandout(naskah), dasar, { tanpaCatatan: true }) : tulisPptx(naskah, dasar);
      const tata = periksaTataLetak(hasil.slides);
      const paket = periksaPaket(hasil.berkas);
      const sub = gabung ? null : nama1[0];
      if (format.includes('pptx')) isiBerkas[namaKeluaran(g.kode, sub, handout ? 'handout' : 'pptx')] = hasil.berkas;
      if (format.includes('json')) isiBerkas[namaKeluaran(g.kode, sub, 'naskah')] = new TextEncoder().encode(JSON.stringify(naskah, null, 2));
      slide += hasil.slides.length;
      meluap += tata.length;
      if (hasil.drafInternal) draf++;
      laporan.push({ kode: g.kode, subtema: gabung ? nama1 : nama1[0], tingkatSubtema: gabung ? g.subtema.map((s) => s.tingkat) : g.subtema[0].tingkat, slide: hasil.slides.length, drafInternal: hasil.drafInternal, teksAcuan: adaTeksAcuan(naskah), tataLetak: tata, paket, catatanPenyusun: naskah.catatan ?? [] });
    } catch (e) { galat.push(g.kode + (gabung ? '' : '::' + nama1[0]) + ': ' + (e as Error).message); }
  }
  if (!laporan.length) gagal('tidak ada deck yang bisa disusun. ' + galat.join(' · '));
  // KM2: .pptx yang memuat teks acuan LatihUKP butuh persetujuan, sama dengan dialog di tab Materi.
  if (format.includes('pptx') && draf && !args.includes('--setuju-acuan')) {
    gagal(draf + ' dari ' + laporan.length + ' deck memuat teks acuan LatihUKP yang belum ditelaah (Draf internal, PRD-Materi KM2). Tambahkan --setuju-acuan untuk penggunaan internal, atau pakai --format json untuk naskah saja.');
  }

  const out = path.resolve(ambil('--out') ?? path.join('output', namaDasar));
  mkdirSync(out, { recursive: true });
  const ditulis: string[] = [];
  const tulis = (nama: string, isi: Uint8Array | string) => {
    const f = path.join(out, nama);
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, isi);
    ditulis.push(f);
  };
  tulis('laporan.json', JSON.stringify({ pengaturan: { tingkat, lingkup: label, kepadatan, sumberSoal, jumlahSoal, jumlahKuis, tanggalAcuan, dibuat, format }, deck: laporan, gagal: galat }, null, 2));
  const jumlahDeck = laporan.length;
  let jumlahPdf = 0;
  if (args.includes('--zip')) {
    // .pptx sudah terkompresi, jadi .zip cukup menyimpan tanpa kompresi ulang.
    zip(isiBerkas, 0).then((z) => {
      tulis(namaDasar + '-' + jumlahDeck + '-deck.zip', z);
      selesai();
    }).catch((e: Error) => gagal(e.message));
  } else {
    for (const [nama, isi] of Object.entries(isiBerkas)) tulis(nama, isi);
    if (pdf) buatPdf();
    selesai();
  }

  // PDF lewat PowerPoint (scripts/materi-pdf.ps1); berkas PDF ditulis di sebelah setiap .pptx.
  function buatPdf() {
    let keluaran = '';
    try { keluaran = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join('scripts', 'materi-pdf.ps1'), out], { encoding: 'utf8' }); }
    catch (e) { gagal('PDF gagal dibuat lewat PowerPoint: ' + ((e as { stdout?: string }).stdout ?? (e as Error).message).trim()); }
    for (const b of keluaran.split(/\r?\n/)) { const m = b.match(/^BERKAS -> (.+)$/); if (m) ditulis.push(m[1].trim()); }
    jumlahPdf = (keluaran.match(/^BERKAS -> /gm) ?? []).length;
  }

  function selesai() {
    console.log('RINGKASAN -> ' + jumlahDeck + ' deck (' + label + ', cakupan Tingkat ' + tingkat + ', ' + kepadatan + (gabung ? ', satu deck per materi' : '') + (handout ? ', handout peserta' : '') + '), ' + slide + ' slide, '
      + (meluap ? meluap + ' teks meluap (lihat laporan.json)' : '0 teks meluap') + ', ' + draf + ' Draf internal' + (jumlahPdf ? ', ' + jumlahPdf + ' PDF' : '') + (galat.length ? ', ' + galat.length + ' subtema gagal disusun (lihat laporan.json)' : ''));
    // Banyak deck: cukup tampilkan folder dan laporan supaya hasil tidak berderet puluhan baris.
    const tampil = ditulis.length > 12 ? [path.join(out, 'laporan.json'), out] : ditulis;
    for (const f of tampil) console.log('BERKAS -> ' + f);
  }
}
main();
