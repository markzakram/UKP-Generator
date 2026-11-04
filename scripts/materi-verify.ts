// Verifikasi mesin deck materi: metrik, paket dasar, 69 subtema nyata, kasus tepi, determinisme, dan CLI npm run materi.
// Contoh deck ditulis ke output/materi-uji/ untuk uji render PowerPoint (scripts/materi-render.ps1);
// dengan --semua, ke-69 deck juga ditulis ke output/materi-semua/.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { periksaPaket, periksaTataLetak, TEKS_TERLARANG } from '../lib/materi/cek';
import { bungkusParagraf, lebarTeks, pasUkuran, TINGGI_BARIS } from '../lib/materi/metrik';
import type { Naskah, SlideNaskah } from '../lib/materi/naskah';
import { tulisPptx } from '../lib/materi/pptx';
import { tataLetak } from '../lib/materi/tata-letak';
import { bagian, cek, selesai } from './harness';
import { muatAturan, naskahUji } from './materi-fixture';
import { muatDataNode } from '../lib/data-node';
import { tingkatSoal, tingkatSubtema } from '../lib/data';
import { MODELS } from '../lib/models';
import { adaTeksAcuan } from '../lib/materi/naskah';
import { aturSlide, bacaNaskah, buatDeck, deckDisunting, kembalikanSlide, rencanaDeck, suntingSlide, tandaiTelaah, telaahSlide, terapkanLembarTelaah, urungkan } from '../lib/materi/deck';
import { bacaLembarTelaah, bacaXlsx, lembarTelaah, ringkasTelaah } from '../lib/materi/telaah';
import { bagiPertemuan, lembarSilabus, MENIT_POLA, susunSilabus, type UnitSilabus } from '../lib/materi/silabus';
import { naskahHandout, POLA_HANDOUT } from '../lib/materi/handout';
import { folderMateri, folderTingkat, hierarkiDeck, jalurBerkasDeck, namaAman, namaDeckGabungan } from '../lib/materi/jalur';
import { xlsx } from '../lib/export/siadu';
import { berlakuPada, daftarSubtema, labelPendek, PENGATURAN_MATERI_AWAL, susunNaskah, susunNaskahMateri, type Kepadatan, type PengaturanMateri } from '../lib/materi/susun';
import type { Kode } from '../lib/types';

const KELUAR = 'output/materi-uji';
mkdirSync(KELUAR, { recursive: true });
// --semua: tulis ke-69 deck ke output/materi-semua untuk uji render penuh di PowerPoint.
const SEMUA = process.argv.includes('--semua');
const KELUAR_SEMUA = 'output/materi-semua';
if (SEMUA) mkdirSync(KELUAR_SEMUA, { recursive: true });
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const par = (t: string, b = false) => ({ runs: [{ t, b }] });

bagian('Metrik Poppins');
{
  // Lebar kalimat terukur PowerPoint (pt pada 100 pt, 3 Nov 2026).
  const acuan: [string, boolean, number][] = [
    ['Pemotong adalah pihak yang membayar penghasilan sehubungan dengan pekerjaan, jasa, atau kegiatan orang pribadi.', false, 0.551 * 111 * 100],
    ['Pemotong adalah pihak yang membayar penghasilan sehubungan dengan pekerjaan, jasa, atau kegiatan orang pribadi.', true, 0.5655 * 111 * 100],
    ['PPh Pemotongan/Pemungutan', false, 0.6328 * 25 * 100],
    ['PPh Pemotongan/Pemungutan', true, 0.6497 * 25 * 100],
    ['Wajib memotong atau dikecualikan? PPN 12% x 11/12 DPP Rp30.000.000', false, 0.5284 * 66 * 100],
    ['Wajib memotong atau dikecualikan? PPN 12% x 11/12 DPP Rp30.000.000', true, 0.5484 * 66 * 100]
  ];
  for (const [t, b, ukur] of acuan) {
    const w = lebarTeks(t, 100, b);
    cek(`lebar "${t.slice(0, 18)}…"${b ? ' tebal' : ''} tidak lebih sempit dari PowerPoint dan selisih ≤ 6%`, w >= ukur * 0.995 && w <= ukur * 1.06, { hitung: Math.round(w), ukur: Math.round(ukur) });
  }
  cek('tinggi baris Poppins 1,2', Math.abs(TINGGI_BARIS - 1.2) < 0.01, TINGGI_BARIS);
  cek('kata pendek satu baris', bungkusParagraf(par('a b c'), 20, 500).length === 1);
  cek('baris baru memecah paragraf', bungkusParagraf(par('satu\ndua'), 20, 500).length === 2);
  cek('teks kosong tetap 1 baris', bungkusParagraf(par(''), 20, 500).length === 1);
  const panjang = bungkusParagraf(par('X'.repeat(80)), 20, 200);
  cek('kata lebih panjang dari kotak diputus per huruf', panjang.length > 1 && panjang.every((b) => lebarTeks(b, 20) <= 200 + 0.01), panjang);
  const p = [par('Penerima yang dipotong: pegawai tetap, pensiunan, pegawai tidak tetap, bukan pegawai, peserta kegiatan, dan mantan pegawai.')];
  const h = pasUkuran(p, 600, 120, 30, 14);
  const lebih = pasUkuran(p, 600, 120, h.pt + 1, h.pt + 1);
  cek('pasUkuran memilih ukuran terbesar yang muat', h.muat && (h.pt === 30 || !lebih.muat), { h, lebih });
  // Jumlah baris PowerPoint (Poppins Bold 21 pt, kotak tanpa margin), diukur lewat COM 3 Nov 2026.
  const putusPpt: [string, number, number][] = [
    ['anti-pemecahan usaha', 90, 4], ['anti-pemecahan usaha', 130, 3],
    ['Pemotongan/Pemungutan', 90, 4], ['Pemotongan/Pemungutan', 130, 3],
    ['PPh 21/26 dan PPh 26', 90, 4], ['PPh 21/26 dan PPh 26', 130, 2],
    ['pusat/cabang/unit', 90, 3], ['pusat/cabang/unit', 130, 2],
    ['UU 7/2021 (HPP)', 90, 3], ['s.t.d.d. UU 36/2008', 130, 2]
  ];
  for (const [t, w, n] of putusPpt) {
    const hasil = bungkusParagraf(par(t, true), 21, w, true);
    cek(`pemutusan baris "${t}" lebar ${w}: tidak kurang dari PowerPoint (${n})`, hasil.length >= n && hasil.length <= n + 1, hasil);
  }
  cek('baris diputus setelah tanda hubung, tidak setelah garis miring', bungkusParagraf(par('anti-pemecahan', true), 21, 130, true)[0] === 'anti-' && bungkusParagraf(par('PPh 21/26', true), 21, 70, true)[0] !== 'PPh 21/');
  const baris = bungkusParagraf(p[0], 22, 500);
  cek('setiap baris hasil bungkus muat di lebar kotak', baris.every((b) => lebarTeks(b, 22) <= 500 + 0.01));
}

bagian('Paket dasar');
const DASAR = 'assets/materi/dasar.pptx';
cek('assets/materi/dasar.pptx ada (npm run materi:dasar)', existsSync(DASAR));
const dasar = new Uint8Array(readFileSync(DASAR));
{
  cek('salinan public/materi/dasar.pptx sama', existsSync('public/materi/dasar.pptx') && sha(readFileSync('public/materi/dasar.pptx')) === sha(dasar));
  const z = unzipSync(dasar);
  const pres = strFromU8(z['ppt/presentation.xml']);
  cek('daftar slide kosong', pres.includes('<p:sldIdLst></p:sldIdLst>'));
  cek('tidak ada bagian slide', !Object.keys(z).some((p) => p.startsWith('ppt/slides/')));
  cek('font tertanam hanya Poppins Regular + Bold', Object.keys(z).filter((p) => p.startsWith('ppt/fonts/')).sort().join() === 'ppt/fonts/poppins-bold.fntdata,ppt/fonts/poppins-regular.fntdata' && /typeface="Poppins"[^>]*\/><p:regular r:id="rIdFontR"\/><p:bold r:id="rIdFontB"\/>/.test(pres));
  cek('Arial Nova dan Inter tidak ikut', !/Arial Nova|Inter/.test(pres));
  cek('font tema judul dan isi = Poppins', /<a:majorFont><a:latin typeface="Poppins"/.test(strFromU8(z['ppt/theme/theme1.xml'])) && /<a:minorFont><a:latin typeface="Poppins"/.test(strFromU8(z['ppt/theme/theme1.xml'])));
  for (const m of ['foto-latar.png', 'ikon-1.png', 'ikon-1.svg', 'ikon-5.svg', 'peringatan.png', 'ilustrasi-dokumen.png', 'ilustrasi-bertanya.svg']) cek('media ' + m, !!z['ppt/media/' + m]);
  cek('layout kosong slideLayout7 ada', /type="blank"|name="Blank"/.test(strFromU8(z['ppt/slideLayouts/slideLayout7.xml'])));
  cek('ukuran paket dasar < 3 MB', dasar.length < 3 * 1024 * 1024, dasar.length);
}

bagian('69 subtema dari kartu aturan nyata');
const aturan = muatAturan();
const subtema = [...new Map(aturan.map((a) => [a.kode + '|' + a.subtema, [a.kode, a.subtema] as const])).values()];
cek('69 subtema', subtema.length === 69, subtema.length);
const laporan = { dipecah: 0, diperkecil: 0, dipotong: 0, 'label-panjang': 0 } as Record<string, number>;
let totalSlide = 0, gagalPaket = 0, gagalTata = 0, terlarang = 0, terbesar = 0, isiDipotong = 0;
// Label (judul, chip, navigasi, kepala kolom) boleh dipotong dan ditandai untuk disunting; isi tidak boleh.
const LABEL = /^(Judul|Subjudul|Label|Kepala kolom|Pil|Teks chip)/;
const contohDipotong: string[] = [];
const polaTerpakai = new Set<string>();
for (const [kode, sub] of subtema) {
  const naskah = naskahUji(aturan, kode, sub);
  let hasil;
  try { hasil = tulisPptx(naskah, dasar); } catch (e) { cek(`${kode} · ${sub} dirender`, false, String(e)); continue; }
  totalSlide += hasil.slides.length;
  terbesar = Math.max(terbesar, hasil.berkas.length);
  for (const s of hasil.slides) {
    polaTerpakai.add(s.pola);
    for (const l of s.laporan) {
      laporan[l.jenis]++;
      if (l.jenis === 'dipotong' && !LABEL.test(l.pesan)) { isiDipotong++; if (contohDipotong.length < 6) contohDipotong.push(`${kode} ${s.asal}: ${l.pesan}`); }
    }
  }
  const mp = periksaPaket(hasil.berkas);
  if (mp.length) { gagalPaket++; cek(`${kode} · ${sub}: struktur paket`, false, mp.slice(0, 4)); }
  const mt = periksaTataLetak(hasil.slides);
  if (mt.length) { gagalTata++; cek(`${kode} · ${sub}: tata letak`, false, mt.slice(0, 4)); }
  const z = unzipSync(hasil.berkas);
  if (Object.keys(z).some((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p) && TEKS_TERLARANG.test(strFromU8(z[p])))) terlarang++;
  if (SEMUA) writeFileSync(`${KELUAR_SEMUA}/${kode}-${sub.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}.pptx`, hasil.berkas);
  if (kode === 'PP' && sub === 'PPh 21: pemotong, penerima & objek') writeFileSync(`${KELUAR}/PP-pph21-pemotong.pptx`, hasil.berkas);
  if (kode === 'PPN' && sub === 'Objek PPN & saat terutang') writeFileSync(`${KELUAR}/PPN-objek.pptx`, hasil.berkas);
  if (kode === 'INT' && sub === 'P3B: hak pemajakan & Formulir DGT') writeFileSync(`${KELUAR}/INT-hak-pemajakan.pptx`, hasil.berkas);
}
cek('semua deck lolos pemeriksaan struktur paket', gagalPaket === 0, gagalPaket);
cek('semua deck lolos pemeriksaan tata letak (0 teks meluap, 0 kotak keluar batas)', gagalTata === 0, gagalTata);
cek('tidak ada teks contoh template di slide', terlarang === 0, terlarang);
cek('semua 10 pola M1 terpakai', ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P10', 'P15'].every((p) => polaTerpakai.has(p)), [...polaTerpakai]);
cek('deck terbesar ≤ 5 MB', terbesar <= 5 * 1024 * 1024, terbesar);
cek('teks isi tidak pernah dipotong (hanya label yang boleh)', isiDipotong === 0, { isiDipotong, contoh: contohDipotong });
cek('label dipotong jarang (≤ 2% slide)', laporan.dipotong <= totalSlide * 0.02, { dipotong: laporan.dipotong, totalSlide });
console.log(`  ${subtema.length} deck, ${totalSlide} slide · dipecah ${laporan.dipecah}, diperkecil ${laporan.diperkecil}, dipotong ${laporan.dipotong}, label panjang ${laporan['label-panjang']} · terbesar ${Math.round(terbesar / 1024)} KB`);

bagian('Kasus tepi');
const dasarNaskah = (slides: SlideNaskah[], nav = ['Konsep', 'Ketentuan', 'Latihan']): Naskah => ({ versi: 1, judul: 'Uji tepi', tanggalAcuan: '2026-11-03', dibuat: '2026-11-03T10:00:00Z', nav, slides });
const kalimatPanjang = 'Pengusaha Kena Pajak wajib memungut, menyetor, dan melaporkan Pajak Pertambahan Nilai yang terutang atas penyerahan Barang Kena Pajak di dalam Daerah Pabean sesuai ketentuan yang berlaku pada tanggal transaksi. ';
const tepi: SlideNaskah[] = [
  { id: 'kartu12', pola: 'P2', judul: 'Dua belas kartu', subjudul: 'Uji pemecahan ikhtisar', kartu: Array.from({ length: 12 }, (_, i) => ({ judul: 'Kartu ' + (i + 1), isi: 'Deskripsi singkat kartu ke-' + (i + 1) + '.' })) },
  { id: 'tabel25', pola: 'P6', chip: 'Tabel panjang', judul: 'Tabel dua puluh lima baris', kolom: ['No', 'Ketentuan', 'Dasar hukum'], baris: Array.from({ length: 25 }, (_, i) => [String(i + 1), kalimatPanjang.slice(0, 60 + (i % 5) * 30), 'PMK 81/2024 Pasal ' + (i + 1)]) },
  { id: 'kontras', pola: 'P5', chip: 'Kontras', judul: 'Banyak poin', pembuka: 'Poin berlebih dipindah ke slide lanjutan.', kiri: { judul: 'Termasuk', poin: Array.from({ length: 15 }, (_, i) => 'Butir ' + (i + 1) + ': ' + kalimatPanjang.slice(0, 90)) }, kanan: { judul: 'Dikecualikan', poin: ['Satu butir saja'] } },
  { id: 'panjang', pola: 'P3', chip: 'Isi panjang', judul: 'Isi tiga ribu huruf', pembuka: 'Teks pembuka singkat.', isi: kalimatPanjang.repeat(14).trim(), sorotan: { label: 'Prinsip', teks: 'Isi dipecah per kalimat.' } },
  { id: 'langkah9', pola: 'P7', chip: 'Langkah', judul: 'Sembilan langkah', langkah: Array.from({ length: 9 }, (_, i) => `Langkah ${i + 1}: ${kalimatPanjang.slice(0, 50 + i * 12)}`) },
  { id: 'def7', pola: 'P4', chip: 'Definisi', judul: 'Tujuh definisi', item: Array.from({ length: 7 }, (_, i) => ({ label: 'Istilah ' + (i + 1), isi: kalimatPanjang.slice(0, 80 + i * 20) })) },
  { id: 'simbol', pola: 'P3', chip: 'Simbol & <tag>', judul: 'Simbol "khusus" & <tag> → × ≤ ≥ “kutip” ’', pembuka: 'A & B < C > D "E" \u0007 kontrol', isi: 'PPN = 12% × 11/12 × DPP; tarif ≥ 0% dan ≤ 12%. Kutip “ganda” dan ‘tunggal’.', gambar: 'tanpa' },
  { id: 'judulPanjang', pola: 'P3', chip: 'Judul sangat panjang sekali yang melebihi lebar chip yang tersedia di kiri atas slide ini', judul: 'Judul '.repeat(40).trim(), isi: 'Isi pendek.' },
  { id: 'tersembunyi', pola: 'P3', judul: 'Tidak tampil', isi: 'x', sembunyi: true },
  { id: 'kesalahan', pola: 'P10', chip: 'Jebakan', judul: 'Kesalahan umum', pembuka: 'Bahan lama: setor tanggal 10.', keliru: { judul: 'Aturan lama', isi: 'PPh dipotong disetor tanggal 10 bulan berikutnya.' }, benar: { judul: 'Yang berlaku', isi: 'Sejak 1 Januari 2025 disetor tanggal 15 bulan berikutnya.' } },
  { id: 'pembatas', pola: 'P16', judul: 'Bagian 2', subjudul: 'PPN & SPT PPN' },
  { id: 'akhir', pola: 'P15', judul: 'Terima kasih' }
];
const nTepi = dasarNaskah(tepi);
const jadi = tataLetak(nTepi);
const per = (id: string) => jadi.filter((s) => s.asal === id);
cek('ikhtisar 12 kartu → 2 slide', per('kartu12').length === 2, per('kartu12').length);
cek('tabel 25 baris → ≥ 2 slide, kepala diulang', per('tabel25').length >= 2 && per('tabel25').every((s) => s.kotak.some((k) => k.nama === 'Kepala tabel')), per('tabel25').length);
const selTabel = per('tabel25').flatMap((s) => s.kotak.filter((k) => k.jenis === 'teks' && k.nama === 'Sel').map((k) => (k as { paragraf: { runs: { t: string }[] }[] }).paragraf[0].runs[0].t));
cek('tabel: semua 25 baris muncul tepat sekali', Array.from({ length: 25 }, (_, i) => String(i + 1)).every((n) => selTabel.filter((t) => t === n).length === 1));
cek('kontras 15 poin → slide lanjutan', per('kontras').length >= 2 && per('kontras')[1].judul.endsWith('(lanjutan)'));
const ukuran = (id: string, nama: string) => new Set(per(id).flatMap((s) => s.kotak.filter((k) => k.jenis === 'teks' && k.nama === nama && !k.miring).map((k) => (k as { pt: number }).pt)));
cek('tabel lanjutan memakai ukuran huruf yang sama', ukuran('tabel25', 'Sel').size === 1, [...ukuran('tabel25', 'Sel')]);
cek('isi lanjutan memakai ukuran huruf yang sama', ukuran('panjang', 'Isi').size === 1, [...ukuran('panjang', 'Isi')]);
cek('poin kontras lanjutan tidak lebih besar dari slide pertama', Math.max(...ukuran('kontras', 'Poin')) <= Math.max(...per('kontras')[0].kotak.filter((k) => k.nama === 'Poin' && !(k as { miring?: boolean }).miring).map((k) => (k as { pt: number }).pt)));
cek('isi 3.000 huruf → ≥ 2 slide berjudul lanjutan', per('panjang').length >= 2 && per('panjang').slice(1).every((s) => s.judul.endsWith('(lanjutan)')), per('panjang').length);
const teksIsi = per('panjang').flatMap((s) => s.kotak.filter((k) => k.nama === 'Isi').map((k) => (k as { paragraf: { runs: { t: string }[] }[] }).paragraf[0].runs[0].t)).join(' ');
cek('isi yang dipecah tidak kehilangan kalimat', teksIsi.replace(/\s+/g, ' ').trim() === kalimatPanjang.repeat(14).replace(/\s+/g, ' ').trim());
cek('sorotan hanya di slide pertama', per('panjang')[0].kotak.some((k) => k.nama === 'Sorotan') && !per('panjang').slice(1).some((s) => s.kotak.some((k) => k.nama === 'Sorotan')));
const angka = per('langkah9').flatMap((s) => s.kotak.filter((k) => k.nama === 'Angka').map((k) => (k as { paragraf: { runs: { t: string }[] }[] }).paragraf[0].runs[0].t));
cek('9 langkah → nomor 1–9 berurutan di ≥ 2 slide', per('langkah9').length >= 2 && angka.join() === '1,2,3,4,5,6,7,8,9', angka);
cek('7 definisi → dipecah', per('def7').length >= 2);
cek('judul sangat panjang dipotong dan dilaporkan', per('judulPanjang')[0].laporan.some((l) => l.jenis === 'dipotong'));
cek('chip panjang dilaporkan', per('judulPanjang')[0].laporan.some((l) => l.jenis === 'label-panjang'));
cek('slide tersembunyi tidak dirender', per('tersembunyi').length === 0);
cek('kasus tepi: tata letak bersih', periksaTataLetak(jadi).length === 0, periksaTataLetak(jadi).slice(0, 5));
const hTepi = tulisPptx(nTepi, dasar);
cek('kasus tepi: struktur paket bersih (XML sah meski ada & < > " dan karakter kontrol)', periksaPaket(hTepi.berkas).length === 0, periksaPaket(hTepi.berkas));
const xmlSimbol = Object.entries(unzipSync(hTepi.berkas)).filter(([p]) => /slides\/slide\d+\.xml$/.test(p)).map(([, d]) => strFromU8(d)).join('');
cek('simbol tersimpan apa adanya', xmlSimbol.includes('× ≤ ≥ “kutip” ’') && xmlSimbol.includes('A &amp; B &lt; C &gt; D &quot;E&quot;') && !xmlSimbol.includes('\u0007'));
cek('ikon memakai SVG dengan cadangan PNG', /<a:blip r:embed="rId\d+"><a:extLst><a:ext uri="\{96DAC541/.test(xmlSimbol));
cek('spasi baris dalam pt pasti', /<a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc>/.test(xmlSimbol) && !/spcPct/.test(xmlSimbol));
writeFileSync(`${KELUAR}/tepi.pptx`, hTepi.berkas);
let galat = '';
try { tataLetak(dasarNaskah([{ id: 'x', pola: 'P15', judul: 'x' }], ['1', '2', '3', '4', '5', '6', '7'])); } catch (e) { galat = String(e); }
cek('navigasi > 6 label ditolak', /paling banyak 6/.test(galat));
galat = '';
try { tataLetak(dasarNaskah([{ id: 'x', pola: 'P99' } as unknown as SlideNaskah])); } catch (e) { galat = String(e); }
cek('pola tidak dikenal ditolak', /tidak dikenal/.test(galat));
galat = '';
try { tulisPptx(dasarNaskah([{ id: 'x', pola: 'P3', judul: 'x', isi: 'x', sembunyi: true }]), dasar); } catch (e) { galat = String(e); }
cek('naskah tanpa slide tampil ditolak', /tidak punya slide/.test(galat));

bagian('Determinisme');
{
  const n = naskahUji(aturan, 'PPN', 'DPP & tarif PPN');
  const a = tulisPptx(n, dasar).berkas, b = tulisPptx(n, dasar).berkas;
  cek('naskah sama → berkas identik', sha(a) === sha(b));
  const c = tulisPptx({ ...n, dibuat: '2026-11-04T08:00:00Z' }, dasar).berkas;
  cek('waktu dibuat berbeda → properti berkas berbeda', sha(a) !== sha(c));
  const core = strFromU8(unzipSync(a)['docProps/core.xml']);
  cek('properti berkas berisi judul dan tanggal acuan', core.includes('<dc:title>DPP &amp; tarif PPN</dc:title>') && core.includes('aturan per 2026-11-03'));
}

bagian('Naskah sungguhan: susunNaskah, 69 subtema × 3 kepadatan');
const data = muatDataNode();
const PENG = (kode: Kode, subtema: string, o: Partial<PengaturanMateri> = {}): PengaturanMateri => ({ ...PENGATURAN_MATERI_AWAL, kode, subtema, tanggalAcuan: '2026-11-03', dibuat: '2026-11-03T10:00:00Z', ...o });
{
  const subs = daftarSubtema(data, 'C', '2026-11-03');
  cek('daftarSubtema: 69 subtema berlaku pada 2026-11-03', subs.length === 69, subs.length);
  const ringkasan: Record<string, { slide: number; maks: number }> = {};
  let gagalP = 0, gagalT = 0, isiPotong = 0, navLebih = 0, kunciSalah = 0, notesKurang = 0, drafSalah = 0, terlarangN = 0, soalTanpaAsal = 0;
  const contohGagal: unknown[] = [];
  for (const kp of ['ringkas', 'standar', 'lengkap'] as Kepadatan[]) {
    ringkasan[kp] = { slide: 0, maks: 0 };
    for (const s of subs) {
      const n = susunNaskah(data, PENG(s.kode, s.subtema, { kepadatan: kp }));
      if (n.nav.length > 6) navLebih++;
      const h = tulisPptx(n, dasar);
      ringkasan[kp].slide += h.slides.length;
      ringkasan[kp].maks = Math.max(ringkasan[kp].maks, h.slides.length);
      const mp = periksaPaket(h.berkas), mt = periksaTataLetak(h.slides);
      if (mp.length) { gagalP++; contohGagal.push([s.subtema, kp, mp.slice(0, 2)]); }
      if (mt.length) { gagalT++; contohGagal.push([s.subtema, kp, mt.slice(0, 2)]); }
      for (const j of h.slides) for (const l of j.laporan) if (l.jenis === 'dipotong' && !LABEL.test(l.pesan)) { isiPotong++; contohGagal.push([s.subtema, kp, l.pesan.slice(0, 100)]); }
      // Kunci pembahasan = kunci soal, teks kunci = opsi kunci.
      n.slides.forEach((x, i) => {
        if (x.pola !== 'P12') return;
        const b = n.slides[i + 1];
        if (!b || b.pola !== 'P13' || b.teksKunci !== x.opsi[b.kunci]) kunciSalah++;
        if (!x.asal || x.asal === 'otomatis') soalTanpaAsal++;
      });
      const z = unzipSync(h.berkas);
      const notes = Object.keys(z).filter((p) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p)).length;
      if (notes !== h.slides.filter((j) => j.catatan).length) notesKurang++;
      const core = strFromU8(z['docProps/core.xml']);
      if (h.drafInternal !== /Draf internal/.test(core) || h.drafInternal !== adaTeksAcuan(n)) drafSalah++;
      if (Object.keys(z).some((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p) && TEKS_TERLARANG.test(strFromU8(z[p])))) terlarangN++;
      if (SEMUA && kp === 'standar') writeFileSync(`${KELUAR_SEMUA}/naskah-${s.kode}-${s.subtema.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}.pptx`, h.berkas);
      if (s.kode === 'PP' && s.subtema === 'PPh 21 selain pegawai tetap & PPh 21 final') writeFileSync(`${KELUAR}/naskah-PP-pph21-final-${kp}.pptx`, h.berkas);
    }
  }
  cek('struktur paket semua deck bersih', gagalP === 0, contohGagal.slice(0, 4));
  cek('tata letak semua deck bersih (0 teks meluap, 0 keluar batas)', gagalT === 0, contohGagal.slice(0, 4));
  cek('teks isi tidak pernah dipotong', isiPotong === 0, contohGagal.slice(0, 4));
  cek('navigasi ≤ 6 label', navLebih === 0);
  cek('pembahasan tepat setelah soal, kunci dan teks kunci cocok', kunciSalah === 0, kunciSalah);
  cek('setiap contoh soal punya asal', soalTanpaAsal === 0);
  cek('setiap slide bercatatan punya halaman catatan pembicara', notesKurang === 0, notesKurang);
  cek('tanda Draf internal di properti berkas sesuai isi naskah', drafSalah === 0, drafSalah);
  cek('tidak ada teks contoh template', terlarangN === 0);
  cek('kepadatan: ringkas < standar < lengkap', ringkasan.ringkas.slide < ringkasan.standar.slide && ringkasan.standar.slide < ringkasan.lengkap.slide, ringkasan);
  console.log('  slide · ringkas ' + ringkasan.ringkas.slide + ' (maks ' + ringkasan.ringkas.maks + '/deck), standar ' + ringkasan.standar.slide + ' (maks ' + ringkasan.standar.maks + '), lengkap ' + ringkasan.lengkap.slide + ' (maks ' + ringkasan.lengkap.maks + ')');
  const subsDgnKuis = subs.filter((s) => s.kuis > 0).length, subsDgnSoal = subs.filter((s) => s.model + s.orisinal > 0).length;
  cek('kuis terpetakan ke sebagian besar subtema (≥ 40)', subsDgnKuis >= 40, subsDgnKuis);
  console.log(`  subtema dengan kuis ${subsDgnKuis}, dengan model/orisinal ${subsDgnSoal}`);
}
{
  const p = PENG('PP', 'PPh 21 selain pegawai tetap & PPh 21 final');
  const a = susunNaskah(data, p), b = susunNaskah(data, p);
  cek('naskah deterministik', JSON.stringify(a) === JSON.stringify(b));
  cek('pptx naskah deterministik', sha(tulisPptx(a, dasar).berkas) === sha(tulisPptx(b, dasar).berkas));
  const c = susunNaskah(data, { ...p, seed: 'MATERI-02' });
  cek('seed berbeda → contoh soal berbeda', JSON.stringify(c.slides.find((x) => x.pola === 'P12')) !== JSON.stringify(a.slides.find((x) => x.pola === 'P12')));
  const soalBaru = a.slides.filter((x) => x.pola === 'P12' || x.pola === 'P13');
  cek('sumber "baru": contoh soal dari model, bukan bank acuan', soalBaru.length >= 2 && soalBaru.every((x) => x.asal === 'model' || x.asal === 'orisinal'), soalBaru.map((x) => x.asal));
  const kuis = a.slides.find((x) => x.pola === 'P11');
  const jadiKuis = kuis ? tataLetak({ ...a, slides: [kuis] }) : [];
  const label = jadiKuis.flatMap((j) => j.kotak.filter((k) => k.nama === 'Label jawaban' && k.jenis === 'teks').map((k) => (k as { paragraf: { runs: { t: string }[] }[] }).paragraf[0].runs[0].t));
  cek('kuis: slide pernyataan lalu slide jawaban dengan label Benar/Salah per butir', !!kuis && kuis.pola === 'P11' && jadiKuis.length >= 2 && label.length === kuis.butir.length && label.every((t, i) => t === (kuis.butir[i].jawab ? 'Benar' : 'Salah')), label);
}
{
  // Subtema tanpa model/orisinal: sumber bank memakai soal acuan (Draf internal), sumber baru tidak.
  const tanpaModel = PENG('PP', 'Tata cara penyetoran & pelaporan');
  const baru = susunNaskah(data, tanpaModel);
  cek('tanpa model/orisinal: tidak ada contoh soal dan dicatat untuk penelaah', !baru.slides.some((x) => x.pola === 'P12') && (baru.catatan ?? []).some((c) => /Contoh soal hanya 0/.test(c)));
  const bank = susunNaskah(data, { ...tanpaModel, sumberSoal: 'bank' });
  const sb = bank.slides.find((x) => x.pola === 'P12');
  cek('sumber "bank": contoh soal bank acuan, asal acuan', !!sb && sb.asal === 'acuan' && (sb.sumber ?? [])[0]?.startsWith('E') !== undefined);
  const ditulis: Naskah = { ...baru, slides: baru.slides.map((x) => ({ ...x, asal: x.asal === 'acuan' ? 'tulis' as const : x.asal })) };
  const hTulis = tulisPptx(ditulis, dasar);
  cek('naskah yang seluruhnya ditulis ulang tidak bertanda Draf internal', !hTulis.drafInternal && !/Draf internal/.test(strFromU8(unzipSync(hTulis.berkas)['docProps/core.xml'])));
  const catatanAcuan = tulisPptx(baru, dasar).slides.find((j) => j.pola === 'P3')?.catatan ?? '';
  cek('catatan pembicara slide acuan memuat DRAF INTERNAL, ID aturan, dan dasar hukum', /^DRAF INTERNAL/.test(catatanAcuan) && /R-PP-\d+/.test(catatanAcuan) && /Dasar hukum:/.test(catatanAcuan), catatanAcuan.slice(0, 200));
}
{
  // Tanggal acuan dan tingkat menyaring aturan.
  const lama = susunNaskah(data, PENG('KUP', 'NPWP, PKP & pembukuan', { tanggalAcuan: '2024-06-01' }));
  cek('aturan yang belum berlaku pada tanggal acuan dikeluarkan dan dicatat', !lama.slides.some((x) => x.sumber?.includes('R-KUP-01')) && (lama.catatan ?? []).some((c) => c.startsWith('R-KUP-01 tidak dipakai')), lama.catatan);
  // Tingkat mengikuti cakupan materi per subtema (data/ukp-mapping.json bagian subtema), kumulatif.
  const jumlah = (['A', 'B', 'C'] as const).map((t) => daftarSubtema(data, t, '2026-11-03').length);
  cek('daftarSubtema per tingkat (pengesahan BPPK): A=34, A+B=48, A+B+C=69', jumlah.join() === '34,48,69', jumlah);
  cek('daftarSubtema membawa tingkat subtema efektif', daftarSubtema(data, 'C', '2026-11-03').every((s) => s.tingkat === tingkatSubtema(s.kode, s.subtema, data.mapping)));
  const tingkatA = susunNaskah(data, PENG('PPN', 'Objek PPN & saat terutang', { tingkat: 'A' }));
  const tingkatC = susunNaskah(data, PENG('PPN', 'Objek PPN & saat terutang', { tingkat: 'C' }));
  const dipakaiA = new Set(tingkatA.slides.flatMap((x) => x.sumber ?? []));
  cek('subtema tingkat A di deck tingkat A memakai semua aturannya (label kisi aturan tidak menyaring)', data.aturan.filter((x) => x.kode === 'PPN' && x.subtema === 'Objek PPN & saat terutang' && berlakuPada(x, '2026-11-03')).every((x) => dipakaiA.has(x.id)) && tingkatA.slides.length === tingkatC.slides.length);
  const pilSampul = (n: typeof tingkatA) => (n.slides[0] as { pil?: string[] }).pil?.[1] ?? '';
  cek('sampul menulis tingkat subtema', pilSampul(tingkatA).startsWith('Tingkat A ·') && pilSampul(susunNaskah(data, PENG('INT', 'P3B: residensi & tie breaker'))).startsWith('Tingkat C ·'), pilSampul(tingkatA));
  let galatTingkat = '';
  try { susunNaskah(data, PENG('PBB', 'Objek & subjek PBB-P5L', { tingkat: 'A' })); } catch (e) { galatTingkat = String(e); }
  cek('subtema tingkat B ditolak di deck tingkat A', /untuk tingkat A/.test(galatTingkat), galatTingkat);
  let galat = '';
  try { susunNaskah(data, PENG('KUP', 'Tidak ada')); } catch (e) { galat = String(e); }
  cek('subtema tidak dikenal ditolak', /tidak ditemukan/.test(galat));
  // Ketentuan lama di teks aturan ikut dicatat untuk penelaah.
  const dataLama = { ...data, aturan: data.aturan.map((x) => (x.id === 'R-KUP-04' ? { ...x, pokok: x.pokok + ' PPh Pasal 23 disetor paling lambat tanggal 10 bulan berikutnya.' } : x)) };
  const nLama = susunNaskah(dataLama, PENG('KUP', data.aturan.find((x) => x.id === 'R-KUP-04')!.subtema));
  cek('teks yang memuat ketentuan lama dicatat', (nLama.catatan ?? []).some((c) => /ketentuan lama/.test(c)), nLama.catatan);
}
{
  cek('label pendek: potong sebelum kata sambung setara', labelPendek('Pemotong PPh 21/26 dan pihak yang dikecualikan sebagai pemotong', 40).teks === 'Pemotong PPh 21/26', labelPendek('Pemotong PPh 21/26 dan pihak yang dikecualikan sebagai pemotong', 40));
  cek('label pendek: judul pendek tidak diubah', labelPendek('Saat terutang PPh 21/26: saat pembayaran', 40).teks === 'Saat terutang PPh 21/26' && !labelPendek('Saat terutang PPh 21/26: saat pembayaran', 40).dipotong);
  cek('label pendek: tidak melebihi batas', ['Penerima penghasilan yang dipotong PPh 21/26 dan pengecualiannya', 'Komponen penghasilan bruto pegawai tetap termasuk JKK JKM BPJS Kesehatan'].every((t) => labelPendek(t, 26).teks.length <= 26));
}

bagian('Deck tab Materi: sunting, riwayat, impor, telaah');
{
  const n = susunNaskah(data, PENG('PP', 'PPh 21: pemotong, penerima & objek'));
  const d0 = buatDeck(n, PENG('PP', 'PPh 21: pemotong, penerima & objek'), '2026-11-03T10:00:00Z');
  cek('id deck = KODE|subtema', d0.id === 'PP|PPh 21: pemotong, penerima & objek');
  const id = n.slides.find((s) => s.pola === 'P3')!.id;
  const d1 = suntingSlide(d0, id, (s) => ({ ...s, judul: 'Judul baru' }), '2026-11-03T10:01:00Z');
  const s1 = d1.naskah.slides.find((s) => s.id === id)!;
  cek('sunting: teks acuan menjadi Ditulis ulang, riwayat bertambah', s1.judul === 'Judul baru' && s1.asal === 'tulis' && d1.riwayat.length === 1);
  const d2 = kembalikanSlide(d1, id, '2026-11-03T10:02:00Z');
  cek('kembalikan teks acuan memulihkan slide asli', JSON.stringify(d2.naskah.slides.find((s) => s.id === id)) === JSON.stringify(n.slides.find((s) => s.id === id)));
  cek('urungkan kembali ke versi sebelumnya', urungkan(d2).naskah.slides.find((s) => s.id === id)!.judul === 'Judul baru');
  const t = tandaiTelaah(d0, true, '2026-11-03T10:03:00Z');
  cek('sunting setelah ditelaah mengembalikan status ke draf', t.status === 'telaah' && suntingSlide(t, id, (s) => s, '2026-11-03T10:04:00Z').status === 'draf');
  const urut = aturSlide(d0, { jenis: 'turun', id: n.slides[2].id }, 'x').naskah.slides.map((s) => s.id);
  cek('atur: turun menukar urutan', urut[3] === n.slides[2].id && urut[2] === n.slides[3].id);
  const ganda = aturSlide(d0, { jenis: 'gandakan', id }, 'x').naskah.slides;
  cek('atur: gandakan membuat id baru unik', ganda.length === n.slides.length + 1 && new Set(ganda.map((s) => s.id)).size === ganda.length);
  const sembunyi = aturSlide(d0, { jenis: 'sembunyi', id }, 'x');
  cek('atur: sembunyikan mengurangi slide berkas', tataLetak(sembunyi.naskah).length < tataLetak(d0.naskah).length);
  cek('riwayat dibatasi 20 versi', Array.from({ length: 25 }).reduce<typeof d0>((d, _, i) => suntingSlide(d, id, (s) => ({ ...s, judul: 'v' + i }), 'x'), d0).riwayat.length === 20);
  const telaahPptx = tulisPptx(n, dasar, { ditelaah: true });
  cek('deck ditelaah: tanpa tanda Draf internal di properti dan catatan', !telaahPptx.drafInternal && !telaahPptx.slides.some((j) => /DRAF INTERNAL/.test(j.catatan)) && !/Draf internal/.test(strFromU8(unzipSync(telaahPptx.berkas)['docProps/core.xml'])));
  const impor = bacaNaskah(JSON.stringify(n));
  cek('impor naskah JSON hasil ekspor', impor.slides.length === n.slides.length && buatDeck(impor, null, 'x').id === d0.id);
  const galatImpor = (teks: string) => { try { bacaNaskah(teks); return ''; } catch (e) { return String(e); } };
  cek('impor menolak berkas tidak sah dengan pesan jelas', /JSON/.test(galatImpor('{bukan json')) && /versi/.test(galatImpor('{}')) && /pola/.test(galatImpor(JSON.stringify({ ...n, slides: [{ id: 'a', pola: 'P99', judul: 'x' }] }))) && /ganda/.test(galatImpor(JSON.stringify({ ...n, slides: [n.slides[0], n.slides[0]] }))));
}

bagian('Kasus tepi pola baru (P8, P9, P11–P14)');
{
  const panjang = 'Pengusaha Kena Pajak wajib memungut, menyetor, dan melaporkan PPN yang terutang atas penyerahan di dalam Daerah Pabean. ';
  const tepiBaru: SlideNaskah[] = [
    { id: 'rumus15', pola: 'P8', chip: 'Rumus', judul: 'Lima belas baris rumus', rumus: Array.from({ length: 15 }, (_, i) => `Langkah ${i + 1}: DPP × tarif ${i + 1}% = PPN terutang bagian ${i + 1}`), keterangan: panjang.repeat(4).trim(), contoh: ['Contoh: ' + panjang.repeat(3).trim(), 'Contoh kedua: Rp100.000.000 × 12% × 11/12 = Rp11.000.000'] },
    { id: 'angka6', pola: 'P9', chip: 'Angka', judul: 'Enam angka', pembuka: 'Angka penting.', angka: Array.from({ length: 6 }, (_, i) => ({ nilai: ['12%', '11/12', 'Rp4,8 M', 'tgl 15', '20 hari', '60%'][i], label: 'Keterangan angka ke-' + (i + 1) })) },
    { id: 'kuis7', pola: 'P11', chip: 'Latihan', judul: 'Kuis tujuh butir', butir: Array.from({ length: 7 }, (_, i) => ({ teks: `Pernyataan ${i + 1}: ${panjang.slice(0, 60 + i * 15)}`, jawab: i % 2 === 0, jelas: 'Penjelasan singkat butir ' + (i + 1) + '.' })) },
    { id: 'kasusPanjang', pola: 'P12', chip: 'Latihan', judul: 'Contoh soal kasus panjang', kasus: panjang.repeat(16).trim(), soal: 'PPN yang wajib dipungut adalah ...', opsi: { A: 'Rp11.000.000', B: 'Rp12.000.000', C: 'Rp13.200.000', D: 'Rp10.000.000' } },
    { id: 'bahas9', pola: 'P13', chip: 'Latihan', judul: 'Pembahasan sembilan langkah', kunci: 'A', teksKunci: 'Rp11.000.000', inti: 'PPN = 12% × 11/12 × harga jual.', langkah: Array.from({ length: 9 }, (_, i) => `Langkah ${i + 1}: ${panjang.slice(0, 50 + i * 10)}`), dasar: 'PMK 131/2024 Pasal 3' },
    { id: 'rangkum9', pola: 'P14', chip: 'Rangkuman', judul: 'Sembilan poin', poin: Array.from({ length: 9 }, (_, i) => ({ judul: 'Poin ' + (i + 1), isi: panjang.slice(0, 80 + i * 12) })) }
  ];
  const n2 = dasarNaskah(tepiBaru);
  const j2 = tataLetak(n2);
  const per2 = (id: string) => j2.filter((s) => s.asal === id);
  const teksBernama = (id: string, nama: string) => per2(id).flatMap((s) => s.kotak.filter((k) => k.jenis === 'teks' && k.nama === nama).map((k) => (k as { paragraf: { runs: { t: string }[] }[] }).paragraf.map((p) => p.runs.map((r) => r.t).join('')).join('\n')));
  cek('rumus 15 baris → dipecah, keterangan dan contoh tetap tampil', per2('rumus15').length >= 2 && teksBernama('rumus15', 'Keterangan').length === 1 && teksBernama('rumus15', 'Contoh').length === 1);
  cek('rumus: semua baris muncul tepat sekali', Array.from({ length: 15 }, (_, i) => `Langkah ${i + 1}:`).every((t) => teksBernama('rumus15', 'Rumus').join('\n').split('\n').filter((x) => x.startsWith(t + ' ')).length === 1));
  cek('angka 6 → 2 slide', per2('angka6').length === 2);
  const angkaKuis = per2('kuis7').flatMap((s) => s.kotak.filter((k) => k.nama === 'Angka').map((k) => (k as { paragraf: { runs: { t: string }[] }[] }).paragraf[0].runs[0].t));
  cek('kuis 7 butir → pernyataan dan jawaban masing-masing berurutan 1–7', angkaKuis.join() === '1,2,3,4,5,6,7,1,2,3,4,5,6,7', angkaKuis);
  cek('kasus panjang → slide kasus lalu slide soal + opsi', per2('kasusPanjang').length >= 2 && per2('kasusPanjang').at(-1)!.kotak.filter((k) => k.nama === 'Kartu opsi').length === 4);
  const isiKasus = teksBernama('kasusPanjang', 'Kasus').join(' ').replace(/\s+/g, ' ');
  cek('kasus yang dipecah tidak kehilangan kalimat', isiKasus.includes(panjang.repeat(16).trim().replace(/\s+/g, ' ')), isiKasus.length);
  const nomorBahas = per2('bahas9').flatMap((s) => s.kotak.filter((k) => k.nama === 'Angka').map((k) => (k as { paragraf: { runs: { t: string }[] }[] }).paragraf[0].runs[0].t));
  cek('pembahasan 9 langkah → nomor 1–9 berlanjut', nomorBahas.join() === '1,2,3,4,5,6,7,8,9', nomorBahas);
  cek('rangkuman 9 poin → dipecah', per2('rangkum9').length >= 2);
  cek('kasus tepi pola baru: tata letak bersih', periksaTataLetak(j2).length === 0, periksaTataLetak(j2).slice(0, 4));
  const h2 = tulisPptx(n2, dasar);
  cek('kasus tepi pola baru: struktur paket bersih', periksaPaket(h2.berkas).length === 0, periksaPaket(h2.berkas));
  writeFileSync(`${KELUAR}/tepi-pola-baru.pptx`, h2.berkas);
}

bagian('Teks tulis ulang (R2): lapisan pengganti teks acuan, contoh Bea Meterai');
{
  const tulis = data.tulis;
  const aturanId = new Map(data.aturan.map((a) => [a.id, a]));
  const kartuId = new Map(data.materi.kartu.map((k) => [k.id, k]));
  const kuisId = new Map((data.materi.kuis as { id: string; jawab?: boolean }[]).map((q) => [q.id, q]));
  cek('ukp-tulis.json: semua id ada di sumber (15 aturan, 7 kartu, 8 kuis Bea Meterai)', Object.keys(tulis.aturan).length === 15 && Object.keys(tulis.aturan).every((id) => aturanId.get(id)?.kode === 'BM')
    && Object.keys(tulis.kartu).length === 7 && Object.keys(tulis.kartu).every((id) => kartuId.get(id)?.kode === 'BM') && Object.keys(tulis.kuis).length === 8 && Object.keys(tulis.kuis).every((id) => kuisId.has(id)));
  const angka = (s: unknown) => new Set([...String(s ?? '').matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0]));
  const gabung = (o: Record<string, unknown>, f: string[]) => f.map((x) => ([] as unknown[]).concat(o[x] ?? '').join(' ')).join(' ');
  const hilang: string[] = [], sama: string[] = [];
  const periksa = (id: string, asli: Record<string, unknown>, baru: Record<string, unknown>) => {
    const f = Object.keys(baru);
    const b = angka(gabung(baru, f));
    for (const x of angka(gabung(asli, f))) if (!b.has(x) && x !== '1' && x !== '04') hilang.push(id + ':' + x);
    // Field pendek yang murni fakta (subjek, tarif, ambang, tenggat) boleh sama dengan sumber.
    for (const x of f) if (!['subjek', 'tarifDpp', 'ambang', 'tenggat'].includes(x) && JSON.stringify(asli[x]) === JSON.stringify(baru[x])) sama.push(id + '.' + x);
  };
  for (const [id, o] of Object.entries(tulis.aturan)) periksa(id, aturanId.get(id) as unknown as Record<string, unknown>, o as Record<string, unknown>);
  for (const [id, o] of Object.entries(tulis.kartu)) periksa(id, kartuId.get(id) as unknown as Record<string, unknown>, o as Record<string, unknown>);
  for (const [id, o] of Object.entries(tulis.kuis)) periksa(id, kuisId.get(id) as unknown as Record<string, unknown>, o as Record<string, unknown>);
  cek('angka, tanggal, dan nomor pasal sumber tetap ada di teks tulis ulang', hilang.length === 0, hilang);
  cek('setiap teks tulis ulang (selain field fakta pendek) berbeda dari teks sumber, bukan salinan', sama.length === 0, sama);
  let bersih = 0, total = 0;
  for (const kp of ['ringkas', 'standar', 'lengkap'] as Kepadatan[]) {
    for (const st of data.mapping.materi.find((m) => m.kode === 'BM')!.subtema) {
      const n = susunNaskah(data, PENG('BM', st, { kepadatan: kp }));
      const h = tulisPptx(n, dasar);
      total++;
      if (!n.slides.some((s) => s.asal === 'acuan') && !adaTeksAcuan(n) && !h.drafInternal && !periksaTataLetak(h.slides).length && !periksaPaket(h.berkas).length) bersih++;
    }
  }
  cek('deck Bea Meterai (4 subtema × 3 kepadatan): tanpa slide teks acuan, bukan Draf internal, tata letak dan berkas bersih', bersih === total && total === 12, { bersih, total });
  const g = susunNaskahMateri(data, PENG('BM', '', { tingkat: 'A' }));
  cek('deck gabungan Bea Meterai Tingkat A tanpa teks acuan', !adaTeksAcuan(g) && !tulisPptx(g, dasar).drafInternal);
  const nb = susunNaskah(data, PENG('BM', 'Tarif, saat & pihak terutang', { kepadatan: 'lengkap' }));
  const kuisBm = nb.slides.find((s) => s.pola === 'P11') as Extract<SlideNaskah, { pola: 'P11' }> | undefined;
  cek('kuis tulis ulang: teks dan penjelasan baru, kunci jawaban tetap dari sumber', !!kuisBm && kuisBm.asal === 'tulis' && kuisBm.butir.every((b) => b.id && tulis.kuis[b.id]?.teks === b.teks && kuisId.get(b.id)?.jawab === b.jawab));
  cek('catatan pembicara menandai teks ditulis ulang yang belum ditelaah', nb.slides.some((s) => /teks ditulis ulang \(belum ditelaah\)/.test(s.catatanPembicara ?? '')));
  cek('materi lain tetap memakai teks acuan sampai ditulis ulang (KUP)', adaTeksAcuan(susunNaskah(data, PENG('KUP', 'Sanksi administrasi'))));
}

bagian('Telaah per slide dan lembar telaah (R1)');
{
  const n = susunNaskah(data, PENG('KUP', 'Banding, gugatan & PK', { kepadatan: 'ringkas' }));
  let d = buatDeck(n, null, '2026-11-03T10:00:00Z');
  const acuan = d.naskah.slides.filter((s) => s.asal === 'acuan' && !s.sembunyi);
  const r0 = ringkasTelaah(d.naskah);
  cek('ringkasTelaah: slide otomatis tidak dihitung, awalnya belum ada yang ditelaah', r0.perlu === d.naskah.slides.filter((s) => s.asal !== 'otomatis').length && r0.sesuai === 0 && !r0.lengkap, r0);
  d = telaahSlide(d, acuan[0].id, { status: 'ubah', catatan: 'Cek tarif', oleh: 'Uji', waktu: '2026-11-03T10:01:00Z' }, '2026-11-03T10:01:00Z');
  cek('telaahSlide mencatat status tanpa mengubah asal dan menambah riwayat', d.naskah.slides.find((s) => s.id === acuan[0].id)?.telaah?.status === 'ubah' && d.naskah.slides.find((s) => s.id === acuan[0].id)?.asal === 'acuan' && d.riwayat.length === 1);
  for (const s of d.naskah.slides) if (s.asal !== 'otomatis') d = telaahSlide(d, s.id, { status: 'sesuai', waktu: '2026-11-03T10:02:00Z' }, '2026-11-03T10:02:00Z');
  const h = tulisPptx(d.naskah, dasar);
  cek('semua slide acuan sesuai → bukan Draf internal; catatan pembicara tanpa DRAF INTERNAL', !adaTeksAcuan(d.naskah) && !h.drafInternal && h.slides.every((j) => !/DRAF INTERNAL/.test(j.catatan)) && ringkasTelaah(d.naskah).lengkap);
  const disunting = suntingSlide(d, acuan[0].id, (s) => ({ ...s, judul: s.judul + ' (revisi)' }), '2026-11-03T10:03:00Z');
  cek('menyunting isi slide menghapus hasil telaahnya (perlu ditelaah ulang)', !disunting.naskah.slides.find((s) => s.id === acuan[0].id)?.telaah && disunting.naskah.slides.find((s) => s.id === acuan[0].id)?.asal === 'tulis');
  // Lembar telaah: tulis → baca (inlineStr) → terapkan.
  const awal = buatDeck(n, null, '2026-11-03T10:00:00Z');
  const lembar = lembarTelaah([awal]);
  const baca = bacaXlsx(lembar);
  cek('lembar telaah: kepala kolom dan satu baris per slide yang perlu ditelaah', baca[0][0] === 'Deck' && baca[0][8].startsWith('Status') && baca.length - 1 === ringkasTelaah(awal.naskah).perlu, baca[0]);
  const isian = baca.map((b, i) => (i === 0 ? b : [...Array.from({ length: 8 }, (_, j) => b[j] ?? ''), i === 1 ? 'Perlu diubah' : 'Sesuai', i === 1 ? 'Dasar hukum perlu dicek' : '', 'Penelaah Uji']));
  const terisi = bacaLembarTelaah(xlsx([{ nama: 'Telaah', baris: isian }]));
  const terap = terapkanLembarTelaah({ [awal.id]: awal }, terisi, '2026-11-03T11:00:00Z');
  const hasil = terap.decks[0];
  cek('impor lembar telaah: semua baris diterapkan, satu slide Perlu diubah dengan catatan dan penelaah', terap.diterapkan === terisi.length && terap.dilewati === 0 && ringkasTelaah(hasil.naskah).ubah === 1
    && hasil.naskah.slides.find((s) => s.telaah?.status === 'ubah')?.telaah?.catatan === 'Dasar hukum perlu dicek' && hasil.naskah.slides.every((s) => s.asal === 'otomatis' || s.telaah?.oleh === 'Penelaah Uji'), terap);
  const ulang = terapkanLembarTelaah({ [hasil.id]: hasil }, terisi, '2026-11-03T12:00:00Z');
  cek('impor ulang lembar yang sama tidak mengubah apa pun', ulang.diterapkan === 0 && ulang.dilewati === terisi.length);
  let galatLembar = '';
  try { bacaLembarTelaah(xlsx([{ nama: 'X', baris: [['A', 'B'], ['1', '2']] }])); } catch (e) { galatLembar = String(e); }
  cek('lembar tanpa kolom Deck/ID slide/Status ditolak dengan pesan', /Kolom Deck, ID slide, atau Status/.test(galatLembar));
  // Pembaca sharedStrings (format yang ditulis Excel saat menyimpan ulang).
  const ss = zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8('<workbook xmlns:r="r"><sheets><sheet name="Telaah" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8('<sst><si><t>Deck</t></si><si><t>ID slide</t></si><si><t>Status (Sesuai / Perlu diubah)</t></si><si><r><t>BM|Pemungut</t></r><r><t xml:space="preserve"> &amp; pembayaran</t></r></si><si><t>ikhtisar</t></si><si><t>Sesuai</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="I1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="I2" t="s"><v>5</v></c></row></sheetData></worksheet>'),
  });
  const bss = bacaLembarTelaah(ss);
  cek('pembaca .xlsx: sharedStrings, teks kaya, entitas, dan kolom berlubang', bss.length === 1 && bss[0].deck === 'BM|Pemungut & pembayaran' && bss[0].slide === 'ikhtisar' && bss[0].status === 'sesuai', bss);
}

bagian('Deck gabungan per materi per tingkat');
{
  type P1 = Extract<SlideNaskah, { pola: 'P1' }>;
  type P6 = Extract<SlideNaskah, { pola: 'P6' }>;
  type P16 = Extract<SlideNaskah, { pola: 'P16' }>;
  const pembatas = (n: Naskah) => n.slides.filter((s): s is P16 => s.pola === 'P16');
  const ppB = susunNaskahMateri(data, PENG('PP', '', { tingkat: 'B' }));
  const aktB = susunNaskahMateri(data, PENG('AKT', '', { tingkat: 'B' }));
  const aktC = susunNaskahMateri(data, PENG('AKT', '', { tingkat: 'C' }));
  const daftarC = (aktC.slides[1] as P6).baris;
  cek('AKT: Tingkat B · A+B 5 bagian, Tingkat C 8 bagian; 3 subtema baru di C ditandai di daftar isi dan pembatas', pembatas(aktB).length === 5 && pembatas(aktC).length === 8
    && daftarC.filter((b) => b[3] === 'Tingkat C (baru)').map((b) => b[1]).join() === 'Jasa konstruksi,Bank & lembaga pembiayaan,Merger & likuidasi' && daftarC[0][3] === 'Tingkat B'
    && pembatas(aktC).filter((s) => /baru di Tingkat C/.test(s.subjudul ?? '')).length === 3, daftarC.map((b) => b[3]));
  cek('PP: 8 bagian di Tingkat A dan B (Tata cara penyetoran ikut A menurut BPPK), tanpa tanda baru di B', pembatas(susunNaskahMateri(data, PENG('PP', '', { tingkat: 'A' }))).length === 8 && pembatas(ppB).length === 8 && pembatas(ppB).every((s) => !/baru/.test(s.subjudul ?? '')));
  cek('sampul gabungan menulis materi dan tingkat ujian', ppB.slides[0].pola === 'P1' && ppB.slides[0].judul === 'PPh Pemotongan / Pemungutan' && (ppB.slides[0] as P1).pil[0] === 'Tingkat B · A+B' && ppB.subtema === undefined);
  const sub = susunNaskah(data, PENG('PP', 'PPh 21 pegawai tetap', { tingkat: 'B' }));
  const bagian2 = ppB.slides.filter((s) => s.id.startsWith('2-') && s.pola !== 'P16');
  cek('isi bagian = deck subtemanya tanpa sampul/penutup; navigasi bawah ikut subtema', JSON.stringify(bagian2.map((s) => [s.pola, s.judul])) === JSON.stringify(sub.slides.filter((s) => s.pola !== 'P1' && s.pola !== 'P15').map((s) => [s.pola, s.judul]))
    && bagian2.every((s) => JSON.stringify(s.nav) === JSON.stringify(sub.nav)));
  cek('subset subtema dihormati', pembatas(susunNaskahMateri(data, PENG('PP', '', { tingkat: 'B' }), ['PPh 21 pegawai tetap', 'Natura & kenikmatan'])).map((s) => s.judul).join() === 'PPh 21 pegawai tetap,Natura & kenikmatan');
  let galatG = '';
  try { susunNaskahMateri(data, PENG('INT', '', { tingkat: 'A' })); } catch (e) { galatG = String(e); }
  cek('materi tanpa subtema dalam cakupan ditolak', /tidak punya subtema dalam cakupan Tingkat A/.test(galatG), galatG);
  const impor = bacaNaskah(JSON.stringify(ppB));
  let galatNav = '';
  try { bacaNaskah(JSON.stringify({ ...ppB, slides: [{ ...ppB.slides[2], nav: ['1', '2', '3', '4', '5', '6', '7'] }] })); } catch (e) { galatNav = String(e); }
  cek('naskah gabungan bisa diekspor-impor; nav slide > 6 ditolak', impor.slides.length === ppB.slides.length && /paling banyak 6/.test(galatNav));
  let deck = 0, bersih = 0;
  for (const t of ['A', 'B', 'C'] as const) for (const m of data.mapping.materi) {
    let n: Naskah;
    try { n = susunNaskahMateri(data, PENG(m.kode, '', { tingkat: t, kepadatan: 'ringkas' })); } catch { continue; }
    deck++;
    const h = tulisPptx(n, dasar);
    if (!periksaTataLetak(h.slides).length && !periksaPaket(h.berkas).length && new Set(n.slides.map((s) => s.id)).size === n.slides.length && n.slides.every((s) => (s.nav ?? n.nav).length <= 6)
      && h.slides.filter((j) => j.asal === 'daftar-isi').length === 1) bersih++;
  }
  cek('semua deck gabungan (A 5, A+B 8, A+B+C 10 materi; ringkas): tata letak, berkas, id unik, navigasi bersih, daftar isi satu slide', deck === 23 && bersih === 23, { deck, bersih });
  // Contoh soal mengutamakan soal berlabel tingkat deck (soal pendalaman).
  const tingkatContoh = (t: 'A' | 'B') => {
    const n = susunNaskah(data, PENG('PP', 'PPh Pasal 22 & PPh Pasal 23', { tingkat: t, sumberSoal: 'bank', jumlahSoal: 2 }));
    return n.slides.filter((s) => s.pola === 'P12').map((s) => {
      const id = s.sumber?.[0] ?? '';
      const asal = id.startsWith('model ') ? MODELS.find((m) => m.id === id.slice(6)) : data.bank.find((x) => x.id === id);
      return asal ? tingkatSoal(asal, data.mapping) : null;
    });
  };
  const cA = tingkatContoh('A'), cB = tingkatContoh('B');
  cek('contoh soal: deck Tingkat A memakai soal A, deck Tingkat B mendahulukan soal pendalaman B', cA.length === 2 && cA.every((x) => x === 'A') && cB.length === 2 && cB.every((x) => x === 'B'), { cA, cB });
}

bagian('Silabus per tingkat (R7)');
{
  const data = muatDataNode();
  const deck = { ...PENGATURAN_MATERI_AWAL, tanggalAcuan: '2026-11-03', dibuat: '2026-11-03T00:00:00Z' };
  const a = susunSilabus(data, { tingkat: 'A', hanyaBaru: false, menitPertemuan: 90, deck });
  cek('silabus A: 5 materi, 34 subtema (cakupan A), urut materi', a.total.materi === 5 && a.total.subtema === 34 && a.materi.map((m) => m.kode).join() === 'KUP,OP,PP,PPN,BM', a.total);
  const ppn = a.materi.find((m) => m.kode === 'PPN')!;
  const naskahPpn = susunNaskahMateri(data, { ...deck, kode: 'PPN', subtema: '', tingkat: 'A' }, ppn.unit.map((u) => u.subtema));
  const jadiPpn = tataLetak(naskahPpn);
  cek('slide silabus = slide deck gabungan setelah tata letak (termasuk lanjutan), menit = jumlah menit per pola', ppn.slide === jadiPpn.length && Math.abs(ppn.menit - jadiPpn.reduce((x, j) => x + MENIT_POLA[j.pola], 0)) < 0.01, [ppn.slide, jadiPpn.length]);
  cek('unit per subtema berurutan dan menutup semua slide deck', ppn.unit.every((u, i) => u.slideAwal === (i ? ppn.unit[i - 1].slideAkhir + 1 : 1)) && ppn.unit[ppn.unit.length - 1].slideAkhir === jadiPpn.length);
  const isi = a.pertemuan.flatMap((p) => p.isi);
  cek('pertemuan: tidak ada yang melebihi 90 menit, semua slide terbagi tepat sekali', a.pertemuan.every((p) => p.menit <= 90) && isi.reduce((x, u) => x + u.slide, 0) === a.total.slide);
  cek('pertemuan selain yang terakhir terisi ≥ 60 menit (subtema boleh dilanjutkan di pertemuan berikutnya)', a.pertemuan.slice(0, -1).every((p) => p.menit >= 60), a.pertemuan.map((p) => p.menit));
  const unit = (menit: number[]): UnitSilabus => ({ kode: 'KUP', materi: 'KUP', subtema: 'x', tingkat: 'A', slideAwal: 1, slideAkhir: menit.length, slide: menit.length, menit: menit.reduce((x, y) => x + y, 0), kuis: 0, contohSoal: 0, soalBank: 0, soalOrisinal: 0, model: 0, menitSlide: menit });
  const panjang = bagiPertemuan([unit(Array(50).fill(2))], 60);
  cek('subtema 100 menit pada pertemuan 60 menit dipecah di batas slide: 60 + 40, bertanda bagian 1/2 dan 2/2', panjang.length === 2 && panjang[0].menit === 60 && panjang[1].isi[0].bagian === '2/2' && panjang[1].isi[0].slideAwal === 31, panjang.map((p) => p.menit));
  const sisaPendek = bagiPertemuan([unit(Array(40).fill(2)), unit(Array(10).fill(2))], 90);
  cek('sisa pertemuan < 30 menit: subtema berikutnya mulai di pertemuan baru', sisaPendek.length === 2 && sisaPendek[1].isi.length === 1 && !sisaPendek[1].isi[0].bagian, sisaPendek.map((p) => p.menit));
  const bBaru = susunSilabus(data, { tingkat: 'B', hanyaBaru: true, menitPertemuan: 120, deck });
  cek('silabus B hanya subtema baru: 14 subtema (AKT, BDN, BTI), berkas deck -tambahan', bBaru.total.subtema === 14 && bBaru.materi.map((m) => m.kode).join() === 'AKT,BDN,BTI' && bBaru.materi.every((m) => m.berkas.endsWith('-tingkat-b-tambahan.pptx')));
  const sunting = { ...naskahPpn, slides: naskahPpn.slides.map((s) => (s.pola === 'P12' ? { ...s, sembunyi: true } : s)) };
  const pakai = susunSilabus(data, { tingkat: 'A', hanyaBaru: false, menitPertemuan: 90, deck }, (k) => (k === 'PPN' ? sunting : undefined));
  const pPpn = pakai.materi.find((m) => m.kode === 'PPN')!;
  cek('deck gabungan yang disunting di browser dipakai (slide tersembunyi tidak dihitung)', pPpn.disunting && pPpn.slide === tataLetak(sunting).length && pPpn.slide < ppn.slide);
  const sebagian = { ...naskahPpn, slides: naskahPpn.slides.filter((s) => !(s.pola === 'P16' && s.id.startsWith('2-'))) };
  cek('deck gabungan berisi sebagian subtema saja tidak dipakai', !susunSilabus(data, { tingkat: 'A', hanyaBaru: false, menitPertemuan: 90, deck }, () => sebagian).materi.some((m) => m.disunting));
  const lembar = bacaXlsx(lembarSilabus(data, a));
  cek('lembar silabus .xlsx terbaca: baris pertemuan + kepala, kolom Pertemuan sampai Soal latihan', lembar.length === isi.length + 1 && lembar[0][0] === 'Pertemuan' && lembar[0][11] === 'Soal latihan tersedia' && lembar[1][0] === '1', lembar[0]);
}

bagian('Handout peserta (R9)');
{
  const data = muatDataNode();
  const deck = { ...PENGATURAN_MATERI_AWAL, tanggalAcuan: '2026-11-03', dibuat: '2026-11-03T00:00:00Z' };
  const lengkap = susunNaskahMateri(data, { ...deck, kode: 'BM', subtema: '', tingkat: 'A' });
  const h = naskahHandout(lengkap);
  cek('handout: hanya pola ringkas (sampul, ikhtisar, daftar isi, rumus, kuis, rangkuman, penutup, pembatas), tanpa tabel isi', h.slides.every((s) => POLA_HANDOUT.includes(s.pola) && (s.pola !== 'P6' || s.id === 'daftar-isi')) && h.slides.length < lengkap.slides.length, [h.slides.length, lengkap.slides.length]);
  cek('handout: setiap rangkuman dan kuis deck lengkap ikut, sampul bertanda Handout peserta', ['P11', 'P14'].every((pola) => h.slides.filter((s) => s.pola === pola).length === lengkap.slides.filter((s) => s.pola === pola).length)
    && h.slides[0].pola === 'P1' && (h.slides[0] as { pil: string[] }).pil.includes('Handout peserta') && /Handout peserta$/.test(h.judul));
  const dasarH = new Uint8Array(readFileSync(path.join('assets', 'materi', 'dasar.pptx')));
  const tH = tulisPptx(h, dasarH, { tanpaCatatan: true });
  const isiH = unzipSync(tH.berkas);
  cek('handout .pptx: tanpa catatan pembicara, berkas sah, 0 teks meluap', !Object.keys(isiH).some((f) => f.startsWith('ppt/notesSlides/notesSlide')) && periksaPaket(tH.berkas).length === 0 && periksaTataLetak(tH.slides).length === 0);
  const tL = unzipSync(tulisPptx(lengkap, dasarH).berkas);
  cek('deck lengkap tetap memuat catatan pembicara', Object.keys(tL).some((f) => f.startsWith('ppt/notesSlides/notesSlide')));
  const sembunyi = naskahHandout({ ...lengkap, slides: lengkap.slides.map((s) => (s.pola === 'P14' ? { ...s, sembunyi: true } : s)) });
  cek('slide tersembunyi tidak masuk handout', !sembunyi.slides.some((s) => s.pola === 'P14'));
}

bagian('Hierarki unduhan Tingkat / Materi / Subtema dan rencana deck');
{
  const data = muatDataNode();
  const tgl = '2026-11-04';
  const ILEGAL = /[\\:*?"<>|]/;
  cek('namaAman: titik dua dan garis miring diganti, tanpa karakter terlarang Windows, tanpa titik di ujung', namaAman('P3B: residensi') === 'P3B - residensi' && namaAman('PPh 25/29 & SPT') === 'PPh 25-29 & SPT' && namaAman('a*b?c"d<e>f|g.') === 'abcdefg');
  cek('folder tingkat: A, B (A+B), C (A+B+C), dan tambahan', folderTingkat('A') === 'Tingkat A' && folderTingkat('B') === 'Tingkat B (A+B)' && folderTingkat('C') === 'Tingkat C (A+B+C)' && folderTingkat('C', true) === 'Tingkat C (hanya subtema baru)');
  for (const [t, nMateri, nSub] of [['A', 5, 34], ['B', 8, 48], ['C', 10, 69]] as const) {
    const h = hierarkiDeck(data, t, tgl);
    const jalur = h.materi.flatMap((m) => m.subtema.map((s) => jalurBerkasDeck(h, m.kode, s)));
    const nomorMateri = h.materi.map((m) => Number(folderMateri(h, m.kode).split('/')[1].slice(0, 2)));
    const nomorSub = h.materi.every((m) => m.subtema.every((s, i) => Number(jalurBerkasDeck(h, m.kode, s).split('/')[2].slice(0, 2)) === i + 1));
    cek(`Tingkat ${t}: ${nMateri} materi, ${nSub} jalur unik tiga tingkat, nomor berurutan, tanpa karakter terlarang, < 160 karakter`, h.materi.length === nMateri && new Set(jalur).size === nSub
      && jalur.every((j) => j.split('/').length === 3 && j.startsWith(folderTingkat(t) + '/') && j.endsWith('.pptx') && !j.split('/').some((b) => ILEGAL.test(b)) && j.length < 160)
      && nomorMateri.every((n, i) => n === i + 1) && nomorSub, jalur.filter((j) => j.length >= 160 || ILEGAL.test(j)));
  }
  const hC = hierarkiDeck(data, 'C', tgl);
  cek('jalur subtema bernama ilegal terbaca', jalurBerkasDeck(hC, 'INT', 'P3B: residensi & tie breaker') === 'Tingkat C (A+B+C)/10 INT - Pajak Internasional/02 P3B - residensi & tie breaker.pptx', jalurBerkasDeck(hC, 'INT', 'P3B: residensi & tie breaker'));
  cek('jalur handout dan naskah di folder yang sama', jalurBerkasDeck(hC, 'PP', 'Natura & kenikmatan', 'handout').endsWith(' - handout.pptx') && jalurBerkasDeck(hC, 'PP', 'Natura & kenikmatan', 'naskah').endsWith(' - naskah.json') && jalurBerkasDeck(hC, 'PP', 'Natura & kenikmatan', 'naskah').split('/')[1] === folderMateri(hC, 'PP').split('/')[1]);
  const hB = hierarkiDeck(data, 'B', tgl, true);
  cek('hanya subtema baru: 3 materi bernomor 01–03, deck gabungan memakai nama yang sama dengan silabus', hB.tambahan && hB.materi.map((m) => m.kode).join() === 'AKT,BDN,BTI' && jalurBerkasDeck(hB, 'AKT', null) === 'Tingkat B (hanya subtema baru)/01 AKT - Akuntansi Perpajakan/' + namaDeckGabungan('AKT', 'B', true));
  cek('hierarki Tingkat A tidak memuat materi yang mulai di tingkat lebih tinggi', !hierarkiDeck(data, 'A', tgl).materi.some((m) => ['PBB', 'AKT', 'BDN', 'BTI', 'INT'].includes(m.kode)));

  const deck = { ...PENGATURAN_MATERI_AWAL, tanggalAcuan: tgl, dibuat: tgl };
  const isiC = { tingkat: 'C' as const, kepadatan: deck.kepadatan, sumberSoal: deck.sumberSoal, jumlahSoal: deck.jumlahSoal, jumlahKuis: deck.jumlahKuis, tanggalAcuan: tgl };
  const pengC = { ...deck, kode: 'PPN' as Kode, subtema: 'Pengkreditan Pajak Masukan', tingkat: 'C' as const };
  const dC = buatDeck(susunNaskah(data, pengC), pengC, tgl);
  const dA = susunNaskah(data, { ...pengC, tingkat: 'A' });
  cek('deck subtema yang sama berbeda isi antartingkat: contoh soal mengikuti tingkat', JSON.stringify(dC.naskah.slides.find((s) => s.pola === 'P12')) !== JSON.stringify(dA.slides.find((s) => s.pola === 'P12')));
  cek('rencana: belum ada → susun; pengaturan sama → pakai', rencanaDeck(undefined, isiC) === 'susun' && rencanaDeck(dC, isiC) === 'pakai');
  cek('rencana: belum disunting, tingkat/kepadatan/kuis/contoh soal/tanggal berbeda → susun ulang', (['tingkat', 'kepadatan', 'jumlahKuis', 'jumlahSoal', 'tanggalAcuan'] as const).every((k) => rencanaDeck(dC, { ...isiC, [k]: k === 'tingkat' ? 'A' : k === 'kepadatan' ? 'ringkas' : k === 'tanggalAcuan' ? '2026-11-05' : 0 }) === 'susun'));
  const disunting = suntingSlide(dC, dC.naskah.slides[1].id, (s) => s, tgl);
  cek('rencana: sudah disunting, ditelaah, atau impor dengan pengaturan lain → dipakai apa adanya, tidak ditimpa', deckDisunting(disunting) && rencanaDeck(disunting, { ...isiC, tingkat: 'A' }) === 'lama'
    && rencanaDeck(tandaiTelaah(dC, true, tgl), { ...isiC, tingkat: 'A' }) === 'lama' && rencanaDeck({ ...dC, pengaturan: null }, isiC) === 'lama');
  cek('rencana: deck disunting dengan pengaturan sama tetap dipakai', rencanaDeck(disunting, isiC) === 'pakai');
  const pengG = { ...deck, kode: 'BM' as Kode, subtema: '', tingkat: 'A' as const, gabung: ['Objek & pengecualian', 'Tarif, saat & pihak terutang'] };
  const dG = buatDeck(susunNaskahMateri(data, pengG, pengG.gabung), pengG, tgl, 'gabung:BM|A');
  const isiA = { ...isiC, tingkat: 'A' as const };
  cek('rencana gabungan: isi subtema sama (urutan bebas) → pakai; berbeda → susun ulang', rencanaDeck(dG, isiA, [...pengG.gabung].reverse()) === 'pakai' && rencanaDeck(dG, isiA, [...pengG.gabung, 'Pemungut & pembayaran']) === 'susun');
}

bagian('CLI materi: npm run materi per tingkat, kode, dan subtema');
{
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'ukp-materi-cli-'));
  const tsx = path.join('node_modules', 'tsx', 'dist', 'cli.mjs');
  const jalan = (argumen: string[]) => {
    try { return { kode: 0, out: execFileSync(process.execPath, [tsx, 'scripts/materi.ts', ...argumen], { encoding: 'utf8', stdio: 'pipe' }) }; }
    catch (e) { const x = e as { status: number; stdout: string; stderr: string }; return { kode: x.status, out: x.stdout + x.stderr }; }
  };
  const daftarA = jalan(['--tingkat', 'A', '--daftar']);
  const daftarB = jalan(['--tingkat', 'B', '--hanya-baru', '--daftar']);
  cek('--daftar per tingkat: A 34 subtema, tambahan B 14', /^RINGKASAN -> 34 subtema/m.test(daftarA.out) && /^RINGKASAN -> 14 subtema/m.test(daftarB.out) && (daftarB.out.match(/^DAFTAR -> /gm) ?? []).length === 14, daftarA.out.slice(-200));
  const tanpaSetuju = jalan(['--tingkat', 'A', '--subtema', 'KUP::Banding, gugatan & PK', '--kepadatan', 'ringkas', '--out', path.join(tmp, 'x')]);
  cek('.pptx bertek acuan tanpa --setuju-acuan ditolak (KM2), kode keluar 1', tanpaSetuju.kode === 1 && /Error: .*teks acuan LatihUKP.*--setuju-acuan/.test(tanpaSetuju.out), tanpaSetuju.out);
  const naskahSaja = jalan(['--tingkat', 'A', '--kode', 'BM', '--format', 'json', '--out', path.join(tmp, 'json')]);
  const semuaBerkas = (d: string) => (readdirSync(d, { recursive: true }) as string[]).map((f) => f.replace(/\\/g, '/'));
  cek('--format json (naskah saja) tidak butuh --setuju-acuan, berkas di folder materi', naskahSaja.kode === 0 && semuaBerkas(path.join(tmp, 'json')).filter((f) => f.startsWith('Tingkat A/05 BM - Bea Meterai/') && f.endsWith(' - naskah.json')).length === 4, naskahSaja.out);
  // Bea Meterai sudah ditulis ulang (R2): tidak bertanda Draf internal, jadi tidak perlu --setuju-acuan.
  const perKode = jalan(['--tingkat', 'A', '--kode', 'BM', '--kepadatan', 'ringkas', '--out', path.join(tmp, 'bm')]);
  const pptxBm = semuaBerkas(path.join(tmp, 'bm')).filter((f) => f.endsWith('.pptx'));
  cek('per kode: 4 deck BM tanpa --setuju-acuan (sudah ditulis ulang), 0 teks meluap, 0 Draf internal, berkas .pptx sah', perKode.kode === 0 && /^RINGKASAN -> 4 deck \(materi BM, cakupan Tingkat A, ringkas\), \d+ slide, 0 teks meluap, 0 Draf internal/m.test(perKode.out)
    && pptxBm.length === 4 && pptxBm.every((f) => periksaPaket(new Uint8Array(readFileSync(path.join(tmp, 'bm', f)))).length === 0), perKode.out);
  const lap = JSON.parse(readFileSync(path.join(tmp, 'bm', 'laporan.json'), 'utf8'));
  cek('laporan.json memuat tiap deck dengan tingkat subtema dan tanda Draf internal (BM: bukan draf)', lap.deck.length === 4 && lap.deck.every((d: { tingkatSubtema: string; drafInternal: boolean }) => d.tingkatSubtema === 'A' && !d.drafInternal));
  const perSub = jalan(['--tingkat', 'C', '--subtema', 'PPN::DPP & tarif PPN;KUP::Sanksi administrasi', '--kepadatan', 'ringkas', '--setuju-acuan', '--zip', '--out', path.join(tmp, 'sub')]);
  const isiZip = existsSync(path.join(tmp, 'sub', 'materi-subtema-2-deck.zip')) ? Object.keys(unzipSync(new Uint8Array(readFileSync(path.join(tmp, 'sub', 'materi-subtema-2-deck.zip'))))) : [];
  cek('per subtema + --zip: satu .zip berhierarki Tingkat / Materi / Subtema', perSub.kode === 0 && isiZip.length === 2 && isiZip.every((f) => /^Tingkat C \(A\+B\+C\)\/0[14] (KUP|PPN) - [^/]+\/\d\d [^/]+\.pptx$/.test(f)) && isiZip.some((f) => f.endsWith('Sanksi administrasi.pptx')), { out: perSub.out, isiZip });
  const luar = jalan(['--tingkat', 'A', '--subtema', 'PBB::Objek & subjek PBB-P5L']);
  const kodeLuar = jalan(['--tingkat', 'A', '--kode', 'INT']);
  cek('subtema/kode di luar cakupan tingkat ditolak', luar.kode === 1 && /di luar cakupan Tingkat A/.test(luar.out) && kodeLuar.kode === 1 && /INT tidak punya subtema dalam cakupan Tingkat A/.test(kodeLuar.out));
  const gab = jalan(['--tingkat', 'A', '--kode', 'BM', '--gabung', '--kepadatan', 'ringkas', '--setuju-acuan', '--out', path.join(tmp, 'gab')]);
  cek('--gabung: satu deck per materi (materi-bm-tingkat-a.pptx) dengan berkas sah', gab.kode === 0 && /^RINGKASAN -> 1 deck \(materi BM, cakupan Tingkat A, ringkas, satu deck per materi\)/m.test(gab.out)
    && existsSync(path.join(tmp, 'gab', 'materi-bm-tingkat-a.pptx')) && periksaPaket(new Uint8Array(readFileSync(path.join(tmp, 'gab', 'materi-bm-tingkat-a.pptx')))).length === 0, gab.out);
  const salah = jalan(['--kepadatan', 'padat']);
  cek('opsi tidak valid ditolak', salah.kode === 1 && /Error: --kepadatan/.test(salah.out));
  const bantuan = jalan(['--help']).out;
  const office = JSON.parse(readFileSync('agent-office.json', 'utf8'));
  const job = office.pekerjaan.find((p: { id: string }) => p.id === 'buatmateri');
  const opsi = JSON.stringify(job?.perintah ?? []).match(/--[a-z-]+/g) ?? [];
  cek('job buatmateri di agent-office.json memakai opsi yang ada di --help', !!job && job.perintah[2] === 'materi' && opsi.length >= 8 && opsi.every((o: string) => bantuan.includes(o)), opsi.filter((o: string) => !bantuan.includes(o)));
  const jobSilabus = office.pekerjaan.find((p: { id: string }) => p.id === 'buatsilabus');
  const opsiSilabus: string[] = JSON.stringify(jobSilabus?.perintah ?? []).match(/--[a-z-]+/g) ?? [];
  cek('job buatsilabus di agent-office.json memakai opsi yang ada di --help', !!jobSilabus && opsiSilabus.includes('--silabus') && opsiSilabus.every((o: string) => bantuan.includes(o)), opsiSilabus.filter((o: string) => !bantuan.includes(o)));
  const sil = jalan(['--tingkat', 'A', '--silabus', '--menit-pertemuan', '120', '--out', path.join(tmp, 'silabus')]);
  const fSil = path.join(tmp, 'silabus', 'silabus-tingkat-a-120-menit.xlsx');
  cek('--silabus: satu .xlsx tiga lembar, RINGKASAN menyebut materi, subtema, JP, dan pertemuan', sil.kode === 0 && /^RINGKASAN -> silabus Tingkat A: 5 materi, 34 subtema, \d+ slide, ±\d+ menit \(\d+ JP\), \d+ pertemuan × 120 menit/m.test(sil.out)
    && existsSync(fSil) && Object.keys(unzipSync(new Uint8Array(readFileSync(fSil)))).filter((f) => f.startsWith('xl/worksheets/')).length === 3, sil.out);
  const ho = jalan(['--tingkat', 'A', '--kode', 'BM', '--gabung', '--handout', '--kepadatan', 'ringkas', '--out', path.join(tmp, 'handout')]);
  const fHo = path.join(tmp, 'handout', 'materi-bm-tingkat-a-handout.pptx');
  cek('--handout: berkas -handout.pptx sah tanpa catatan pembicara, RINGKASAN menyebut handout', ho.kode === 0 && /handout peserta\)/.test(ho.out) && existsSync(fHo) && periksaPaket(new Uint8Array(readFileSync(fHo))).length === 0
    && !Object.keys(unzipSync(new Uint8Array(readFileSync(fHo)))).some((f) => f.startsWith('ppt/notesSlides/notesSlide')), ho.out);
  const pdfZip = jalan(['--kode', 'BM', '--pdf', '--zip']);
  cek('--pdf bersama --zip ditolak', pdfZip.kode === 1 && /--pdf tidak bisa bersama --zip/.test(pdfZip.out));
  const jobMateri = office.pekerjaan.find((p: { id: string }) => p.id === 'buatmateri');
  cek('job buatmateri memuat parameter handout dan pdf', !!jobMateri.parameter.handout && !!jobMateri.parameter.pdf && JSON.stringify(jobMateri.perintah).includes('--handout') && JSON.stringify(jobMateri.perintah).includes('--pdf'));
  const silSalah = jalan(['--kode', 'PPN', '--silabus']);
  cek('--silabus dengan --kode ditolak', silSalah.kode === 1 && /--silabus hanya untuk lingkup tingkat/.test(silSalah.out));
}

console.log('\nBERKAS -> ' + KELUAR + ' (PP-pph21-pemotong, PPN-objek, INT-hak-pemajakan, tepi, tepi-pola-baru, naskah-PP-pph21-final-*)');
selesai('verify:materi');
