// npm run materi -- [opsi]: susun deck materi .pptx tanpa browser lalu tulis berkasnya.
// Contoh: npm run materi -- --tingkat A --kode PPN --setuju-acuan --out output/materi-ppn
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hariIni, TINGKAT, URUTAN_KODE } from '../lib/config';
import { muatDataNode } from '../lib/data-node';
import { slug } from '../lib/export/common';
import { zip } from '../lib/export/unduh';
import { periksaPaket, periksaTataLetak } from '../lib/materi/cek';
import { adaTeksAcuan } from '../lib/materi/naskah';
import { tulisPptx } from '../lib/materi/pptx';
import { daftarSubtema, PENGATURAN_MATERI_AWAL, susunNaskah, type Kepadatan, type PengaturanMateri, type SumberSoalMateri } from '../lib/materi/susun';
import type { Kode, Tingkat } from '../lib/types';

const BANTUAN = `Pemakaian: npm run materi -- [opsi]
  --tingkat A|B|C            cakupan kumulatif (bawaan C): A 33 subtema, A+B 56, A+B+C 69
  --kode PPN,KUP             per materi: semua subtema kode ini dalam cakupan tingkat
  --subtema "PPN::DPP & tarif PPN;KUP::Sanksi administrasi"   per subtema (pisahkan dengan ;)
  --hanya-baru               per tingkat: hanya subtema yang mulai di tingkat itu (B 23, C 13)
                             tanpa --kode dan --subtema: semua subtema dalam cakupan tingkat
  --kepadatan ringkas|standar|lengkap  (bawaan standar)
  --contoh-soal 0|1|2        contoh soal per deck (bawaan 1)
  --kuis 0|3|5               butir kuis Benar/Salah per deck (bawaan 3)
  --sumber-soal baru|bank    contoh soal dari model & orisinal (bawaan) atau boleh bank acuan LatihUKP
  --tanggal YYYY-MM-DD       tanggal acuan aturan (bawaan hari ini)
  --seed TEKS                bawaan MATERI-01
  --format pptx,json         pptx (deck) dan/atau json (naskah); bawaan pptx
  --zip                      bungkus semua berkas menjadi satu .zip
  --setuju-acuan             izinkan .pptx yang memuat teks acuan LatihUKP, diberi tanda Draf internal (PRD-Materi KM2)
  --daftar                   tampilkan subtema dalam lingkup tanpa menulis berkas
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
if (hanyaBaru && (kode.length || subtemaDiminta.length)) gagal('--hanya-baru hanya untuk lingkup tingkat (tanpa --kode dan --subtema)');
const lingkup = subtemaDiminta.length ? 'subtema' : kode.length ? 'materi' : 'tingkat';

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
  const namaDasar = 'materi-' + (lingkup === 'subtema' ? 'subtema' : lingkup === 'materi' ? slug(kode.join('-')) : 'tingkat-' + tingkat.toLowerCase() + (tambahan ? '-tambahan' : ''));
  if (args.includes('--daftar')) {
    for (const s of pilih) console.log('DAFTAR -> ' + s.kode + '::' + s.subtema + ' · Tingkat ' + s.tingkat + ' · ' + s.aturan + ' aturan');
    console.log('RINGKASAN -> ' + pilih.length + ' subtema, lingkup ' + label + ', cakupan Tingkat ' + tingkat);
    return;
  }

  const dibuat = new Date().toISOString();
  const dasar = new Uint8Array(readFileSync(path.join('assets', 'materi', 'dasar.pptx')));
  const perFolder = new Set(pilih.map((s) => s.kode)).size > 1;
  const isiBerkas: Record<string, Uint8Array> = {};
  const laporan: unknown[] = [];
  const galat: string[] = [];
  let slide = 0, draf = 0, meluap = 0;
  for (const s of pilih) {
    const peng: PengaturanMateri = { ...PENGATURAN_MATERI_AWAL, kode: s.kode, subtema: s.subtema, tingkat, kepadatan, sumberSoal, jumlahSoal, jumlahKuis, tanggalAcuan, dibuat, seed: ambil('--seed') ?? PENGATURAN_MATERI_AWAL.seed };
    try {
      const naskah = susunNaskah(data, peng);
      const hasil = tulisPptx(naskah, dasar);
      const tata = periksaTataLetak(hasil.slides);
      const paket = periksaPaket(hasil.berkas);
      const nama = (perFolder ? s.kode + '/' : '') + 'materi-' + slug(s.kode) + '-' + slug(s.subtema);
      if (format.includes('pptx')) isiBerkas[nama + '.pptx'] = hasil.berkas;
      if (format.includes('json')) isiBerkas[nama.replace(/materi-(?=[^/]*$)/, 'naskah-') + '.json'] = new TextEncoder().encode(JSON.stringify(naskah, null, 2));
      slide += hasil.slides.length;
      meluap += tata.length;
      if (hasil.drafInternal) draf++;
      laporan.push({ kode: s.kode, subtema: s.subtema, tingkatSubtema: s.tingkat, slide: hasil.slides.length, drafInternal: hasil.drafInternal, teksAcuan: adaTeksAcuan(naskah), tataLetak: tata, paket, catatanPenyusun: naskah.catatan ?? [] });
    } catch (e) { galat.push(s.kode + '::' + s.subtema + ': ' + (e as Error).message); }
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
  if (args.includes('--zip')) {
    // .pptx sudah terkompresi, jadi .zip cukup menyimpan tanpa kompresi ulang.
    zip(isiBerkas, 0).then((z) => {
      tulis(namaDasar + '-' + jumlahDeck + '-deck.zip', z);
      selesai();
    }).catch((e: Error) => gagal(e.message));
  } else {
    for (const [nama, isi] of Object.entries(isiBerkas)) tulis(nama, isi);
    selesai();
  }

  function selesai() {
    console.log('RINGKASAN -> ' + jumlahDeck + ' deck (' + label + ', cakupan Tingkat ' + tingkat + ', ' + kepadatan + '), ' + slide + ' slide, '
      + (meluap ? meluap + ' teks meluap (lihat laporan.json)' : '0 teks meluap') + ', ' + draf + ' Draf internal' + (galat.length ? ', ' + galat.length + ' subtema gagal disusun (lihat laporan.json)' : ''));
    // Banyak deck: cukup tampilkan folder dan laporan supaya hasil tidak berderet puluhan baris.
    const tampil = ditulis.length > 12 ? [path.join(out, 'laporan.json'), out] : ditulis;
    for (const f of tampil) console.log('BERKAS -> ' + f);
  }
}
main();
