// Verifikasi mesin deck materi (tahap M1): metrik, paket dasar, 69 subtema nyata, kasus tepi, determinisme.
// Contoh deck ditulis ke output/materi-uji/ untuk uji render PowerPoint (scripts/materi-render.ps1);
// dengan --semua, ke-69 deck juga ditulis ke output/materi-semua/.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { periksaPaket, periksaTataLetak, TEKS_TERLARANG } from '../lib/materi/cek';
import { bungkusParagraf, lebarTeks, pasUkuran, TINGGI_BARIS } from '../lib/materi/metrik';
import type { Naskah, SlideNaskah } from '../lib/materi/naskah';
import { tulisPptx } from '../lib/materi/pptx';
import { tataLetak } from '../lib/materi/tata-letak';
import { bagian, cek, selesai } from './harness';
import { muatAturan, naskahUji } from './materi-fixture';

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

console.log('\nBERKAS -> ' + KELUAR + ' (PP-pph21-pemotong, PPN-objek, INT-hak-pemajakan, tepi)');
selesai('verify:materi');
