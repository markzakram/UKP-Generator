// npm run generate -- [opsi]: rakit paket UKP tanpa browser lalu tulis berkas hasil.
// Contoh: npm run generate -- --tingkat C --soal 100 --paket 3 --seed UKP-C-01 --format json,pdf,docx --out output
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pengaturanAwal, TINGKAT, URUTAN_KODE } from '../lib/config';
import { muatDataNode } from '../lib/data-node';
import { buatPaket, posisiKunci } from '../lib/generate';
import { cekPaket } from '../lib/quality';
import type { JenisPaket, Kode, Pengaturan, SumberSoal, Tingkat } from '../lib/types';
import { buatBerkas, FORMAT_SIADU, GalatAcuan, tanpaAcuan, type FormatEkspor } from '../lib/export/jalankan';
import { soalAcuan } from '../lib/export/siadu';
import type { ModeIsi } from '../lib/export/common';

const BANTUAN = `Pemakaian: npm run generate -- [opsi]
  --tingkat A|B|C            tingkat UKP (bawaan C)
  --jenis tryout|materi|subtema|jebakan  (bawaan tryout)
  --materi KUP,PPN           kode materi untuk jenis materi
  --subtema "KUP::Sanksi administrasi;PPN::DPP & tarif PPN"   untuk jenis subtema (pisahkan dengan ;)
  --soal N                   soal per paket (bawaan 100, maks 200)
  --paket N                  jumlah paket (bawaan 1, maks 50)
  --durasi M                 menit (bawaan 180)
  --seed TEKS                bawaan UKP-<tingkat>-01
  --sumber bank|baru|campuran (bawaan campuran)
  --kesulitan 30,50,20       persen mudah,sedang,sulit
  --tanggal YYYY-MM-DD       tanggal acuan aturan (bawaan hari ini)
  --urutan materi|acak
  --boleh-kembar             izinkan soal sama di paket berbeda
  --format json,pdf,docx,csv,siadu-docx,siadu-xlsx,uji-html (bawaan json; dipisah koma; uji-html satu berkas per paket)
  --isi lengkap|naskah|kunci|soal-jawaban  isi PDF/Word (bawaan lengkap); SiAdu hanya lengkap atau soal-jawaban
  --setuju-acuan             sertakan soal acuan LatihUKP di ekspor SiAdu (penggunaan internal, PRD K2)
  --tanpa-acuan              keluarkan soal acuan LatihUKP dari ekspor SiAdu (soal baru/orisinal saja)
  --out FOLDER               bawaan output/<seed>`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { console.log(BANTUAN); process.exit(0); }
const ambil = (nama: string) => { const i = args.indexOf(nama); return i >= 0 ? args[i + 1] : undefined; };
const gagal = (pesan: string): never => { console.error('Error: ' + pesan); process.exit(1); };

const awal = pengaturanAwal();
const tingkat = (ambil('--tingkat') ?? 'C').toUpperCase() as Tingkat;
if (!TINGKAT.includes(tingkat)) gagal('--tingkat harus A, B, atau C');
const jenis = (ambil('--jenis') ?? 'tryout') as JenisPaket;
if (!['tryout', 'materi', 'subtema', 'jebakan'].includes(jenis)) gagal('--jenis tidak dikenal: ' + jenis);
const sumber = (ambil('--sumber') ?? 'campuran') as SumberSoal;
if (!['bank', 'baru', 'campuran'].includes(sumber)) gagal('--sumber tidak dikenal: ' + sumber);
const subtema = (ambil('--subtema') ?? '').split(';').map((s) => s.trim()).filter(Boolean);
const materi = ambil('--materi') ? ambil('--materi')!.split(',').map((s) => s.trim().toUpperCase()) as Kode[] : jenis === 'subtema' ? URUTAN_KODE.filter((k) => subtema.some((s) => s.startsWith(k + '::'))) : [...URUTAN_KODE];
for (const k of materi) if (!URUTAN_KODE.includes(k)) gagal('kode materi tidak dikenal: ' + k);
const angka = (nama: string, bawaan: number) => { const v = ambil(nama); if (v === undefined) return bawaan; const n = Number(v); if (!Number.isInteger(n) || n < 1) gagal(nama + ' harus bilangan bulat positif'); return n; };
const komposisi = (ambil('--kesulitan') ?? '30,50,20').split(',').map(Number);
if (komposisi.length !== 3 || komposisi.some((n) => !Number.isFinite(n) || n < 0)) gagal('--kesulitan harus tiga angka, misalnya 30,50,20');
const format = (ambil('--format') ?? 'json').split(',').map((s) => s.trim()) as (FormatEkspor | 'docx')[];
const isi = (ambil('--isi') ?? 'lengkap') as ModeIsi;
if (!['lengkap', 'naskah', 'kunci', 'soal-jawaban'].includes(isi)) gagal('--isi tidak dikenal: ' + isi);

const peng: Pengaturan = {
  ...awal,
  tingkat, jenis, sumber, materi, subtema,
  jumlahSoal: angka('--soal', jenis === 'tryout' ? 100 : 40),
  jumlahPaket: angka('--paket', 1),
  durasi: angka('--durasi', 180),
  seed: ambil('--seed') ?? 'UKP-' + tingkat + '-01',
  tanggalAcuan: ambil('--tanggal') ?? awal.tanggalAcuan,
  urutan: ambil('--urutan') === 'acak' ? 'acak' : 'materi',
  larangKembar: !args.includes('--boleh-kembar'),
  komposisi: { mudah: komposisi[0], sedang: komposisi[1], sulit: komposisi[2] },
  judul: jenis === 'tryout' ? 'Tryout UKP' : 'Latihan UKP',
};

async function main() {
  const data = muatDataNode();
  const hasil = buatPaket(data, peng);
  const out = path.resolve(ambil('--out') ?? path.join('output', peng.seed.replace(/[^\w.-]+/g, '_')));
  mkdirSync(out, { recursive: true });
  const ctx = { data, tanggalAcuan: peng.tanggalAcuan };
  const mutu = hasil.paket.map((p) => {
    const m = cekPaket(p, ctx, hasil.paket, peng.larangKembar);
    return {
      paket: p.id, soal: p.soal.length, lolos: m.lolos, catatan: m.catatan, gagal: m.gagal, posisiKunci: posisiKunci(p.soal),
      soalBaru: p.soal.filter((s) => s.asal === 'model').length,
      catatanPaket: m.paket.filter((c) => c.level !== 'lolos'),
      perSoal: p.soal.map((s, i) => ({ no: i + 1, uid: s.uid, cek: (m.perSoal.get(s.uid) ?? []).filter((c) => c.level === 'gagal' || c.level === 'peringatan') })).filter((x) => x.cek.length),
    };
  });
  const tulis = (nama: string, isiBerkas: Uint8Array | string) => { const f = path.join(out, nama); writeFileSync(f, isiBerkas); return f; };
  const berkas: string[] = [];
  berkas.push(tulis('validasi.json', JSON.stringify({ pengaturan: peng, kuota: hasil.baris, cekPersediaan: hasil.cek, mutu }, null, 2)));
  const PETA_FORMAT: Record<string, FormatEkspor> = { json: 'json', pdf: 'pdf', docx: 'word', csv: 'csv', 'siadu-docx': 'siadu-word', 'siadu-xlsx': 'siadu-excel', 'uji-html': 'uji-html' };
  let acuanDikeluarkan = 0;
  for (const f of format) {
    const fmt = PETA_FORMAT[f];
    if (!fmt) gagal('format tidak dikenal: ' + f);
    const siadu = FORMAT_SIADU.includes(fmt);
    const paketEkspor = siadu && args.includes('--tanpa-acuan') ? tanpaAcuan(hasil.paket) : hasil.paket;
    if (siadu && args.includes('--tanpa-acuan')) acuanDikeluarkan = soalAcuan(hasil.paket).length;
    if (!paketEkspor.length) gagal('semua soal berasal dari bank acuan; tidak ada soal untuk ekspor ' + f + ' dengan --tanpa-acuan');
    const mode: ModeIsi = siadu ? (isi === 'soal-jawaban' ? 'soal-jawaban' : 'lengkap') : isi;
    try {
      // Berkas uji HTML dibuat satu per paket.
      for (const bagianPaket of fmt === 'uji-html' ? paketEkspor.map((p) => [p]) : [paketEkspor]) {
        const b = await buatBerkas({ format: fmt, mode, paket: bagianPaket, peng, gabung: true, siadu: data.mapping.siadu, setujuAcuan: args.includes('--setuju-acuan') });
        berkas.push(tulis(fmt === 'json' ? 'paket.json' : b.nama, b.isi));
      }
    } catch (e) {
      if (e instanceof GalatAcuan) gagal(e.message + ' Tambahkan --setuju-acuan atau --tanpa-acuan.');
      throw e;
    }
  }
  const totalGagal = mutu.reduce((a, m) => a + m.gagal, 0);
  console.log('RINGKASAN -> ' + hasil.paket.length + ' paket × ' + peng.jumlahSoal + ' soal (Tingkat ' + peng.tingkat + ', ' + peng.sumber + '), ' + mutu.reduce((a, m) => a + m.soalBaru, 0) + ' soal baru, ' + (totalGagal ? totalGagal + ' soal gagal cek (lihat validasi.json)' : 'valid') + ', ' + mutu.reduce((a, m) => a + m.catatan, 0) + ' catatan mutu'
    + (acuanDikeluarkan ? ', ' + acuanDikeluarkan + ' soal acuan dikeluarkan dari ekspor SiAdu' : ''));
  for (const f of berkas) console.log('BERKAS -> ' + f);
}
main().catch((e: Error) => gagal(e.message));
