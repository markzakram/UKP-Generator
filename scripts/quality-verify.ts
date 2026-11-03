// npm run verify:quality: mutu paket di banyak seed, pemetaan opsi, dan pemeriksa mutu itu sendiri.
import { HURUF, pengaturanAwal, TINGKAT } from '../lib/config';
import { muatDataNode } from '../lib/data-node';
import { buatPaket, posisiKunci } from '../lib/generate';
import { cariJebakan, cekPaket, cekSoal, kemiripan } from '../lib/quality';
import { dariBank, terapkanUrutan } from '../lib/soal';
import type { Huruf, Pengaturan, SumberSoal } from '../lib/types';
import { rng } from '../lib/util';
import { bagian, cek, selesai } from './harness';

const data = muatDataNode();
const ACUAN = '2026-11-02';
const P = (p: Partial<Pengaturan>): Pengaturan => ({ ...pengaturanAwal(), tanggalAcuan: ACUAN, ...p });

bagian('Mutu paket di banyak seed');
const sumberUji: SumberSoal[] = ['bank', 'campuran'];
let paketDiuji = 0, totalCatatan = 0, totalSoal = 0, kunciTimpang = 0, gagal = 0, mirip = 0;
const contohGagal: unknown[] = [];
for (const t of TINGKAT) for (const sumber of sumberUji) for (let i = 1; i <= 5; i++) {
  const h = buatPaket(data, P({ tingkat: t, sumber, jumlahPaket: 3, seed: 'MUTU-' + t + '-' + sumber + '-' + i }));
  for (const p of h.paket) {
    const m = cekPaket(p, { data, tanggalAcuan: ACUAN }, h.paket);
    paketDiuji++; totalSoal += p.soal.length; totalCatatan += m.catatan; gagal += m.gagal;
    if (m.gagal && contohGagal.length < 3) contohGagal.push([...m.perSoal.entries()].filter(([, c]) => c.some((x) => x.level === 'gagal')).slice(0, 2));
    if (m.paket.some((c) => c.id === 'kunci' && c.level !== 'lolos')) kunciTimpang++;
    for (const c of m.perSoal.values()) if (c.some((x) => x.judul === 'Kemiripan')) mirip++;
  }
}
cek(paketDiuji + ' paket tanpa soal gagal', gagal === 0, contohGagal);
cek('posisi kunci merata di semua paket', kunciTimpang === 0, kunciTimpang);
const rasio = totalCatatan / totalSoal;
cek('soal bercatatan ≤ 25% (heuristik panjang opsi dll.)', rasio <= 0.25, (rasio * 100).toFixed(1) + '%');
console.log('  info: ' + (rasio * 100).toFixed(1) + '% soal punya catatan; ' + mirip + ' soal ditandai mirip >80% dengan soal lain di paket yang sama');

bagian('Pemetaan opsi pada seluruh bank');
const r = rng('peta-opsi');
let rujukanHilang = 0, kunciBeda = 0, balikGagal = 0;
const RE = /\b([Oo]psi|[Pp]ilihan|[Jj]awaban)\s+([A-D])\b/g;
for (const b of data.bank) {
  const s = dariBank(b, data);
  const perm = r.shuffle(HURUF) as Huruf[];
  const t = terapkanUrutan(s, perm);
  if (t.opsi[t.kunci] !== s.opsi[s.kunci]) kunciBeda++;
  const teks = (x: typeof s) => [x.inti, ...x.langkah, ...Object.values(x.kenapaSalah), x.catatanAturan ?? '', x.poinIngat ?? ''].join(' ');
  if ((teks(s).match(RE) ?? []).length !== (teks(t).match(RE) ?? []).length) rujukanHilang++;
  // Rujukan "Opsi X" harus menunjuk teks opsi yang sama sebelum dan sesudah diacak.
  const ke = Object.fromEntries(perm.map((lama, i) => [lama, HURUF[i]]));
  for (const m of teks(s).matchAll(RE)) if (!teks(t).includes(m[1] + ' ' + ke[m[2]])) rujukanHilang++;
  // Balik permutasi mengembalikan soal semula.
  const balik = HURUF.map((h) => HURUF[perm.indexOf(h)]) as Huruf[];
  const u = terapkanUrutan(t, balik);
  if (JSON.stringify([u.opsi, u.kunci, u.kenapaSalah, u.inti, u.langkah]) !== JSON.stringify([s.opsi, s.kunci, s.kenapaSalah, s.inti, s.langkah])) balikGagal++;
}
cek('kunci tetap menunjuk teks yang sama (2.387 soal)', kunciBeda === 0, kunciBeda);
cek('rujukan "Opsi X" di pembahasan ikut terpetakan', rujukanHilang === 0, rujukanHilang);
cek('permutasi balik mengembalikan soal semula', balikGagal === 0, balikGagal);

bagian('Pemeriksa mutu');
const contoh = dariBank(data.bank.find((b) => !b.opsiAngka && !b.kasusId)!, data);
const rusak = { ...contoh, opsi: { ...contoh.opsi, B: contoh.opsi.A } };
cek('opsi kembar → gagal struktur', cekSoal(rusak, { data, tanggalAcuan: ACUAN }).some((c) => c.id === 'struktur' && c.level === 'gagal'));
const tanpaKunci = { ...contoh, kunci: 'E' as Huruf };
cek('kunci di luar A–D → gagal', cekSoal(tanpaKunci, { data, tanggalAcuan: ACUAN }).some((c) => c.level === 'gagal'));
const angka = dariBank(data.bank.find((b) => b.opsiAngka && !b.posisiTetap)!, data);
const acak = terapkanUrutan(angka, ['D', 'B', 'C', 'A']);
const cAngka = cekSoal(acak, { data, tanggalAcuan: ACUAN });
cek('opsi angka tidak urut → peringatan dengan aksi urutkan', cAngka.some((c) => c.id === 'urutan' && c.aksi === 'urutkan') || [acak.opsi.A, acak.opsi.B, acak.opsi.C, acak.opsi.D].join() === [angka.opsi.A, angka.opsi.B, angka.opsi.C, angka.opsi.D].join());
cek('soal bank diberi info asal acuan sumber', cekSoal(contoh, { data, tanggalAcuan: ACUAN }).some((c) => c.id === 'asal' && c.level === 'info'));
const aturanBaru = data.aturan.find((a) => a.berlaku.mulai && a.berlaku.mulai > '2025-06-01');
if (aturanBaru) {
  const s = { ...contoh, ruleIds: [aturanBaru.id] };
  cek('aturan yang belum berlaku pada tanggal acuan → peringatan', cekSoal(s, { data, tanggalAcuan: '2024-01-01' }).some((c) => c.id.startsWith('berlaku-')));
  cek('aturan yang sudah berlaku → tanpa peringatan masa berlaku', !cekSoal(s, { data, tanggalAcuan: ACUAN }).some((c) => c.id.startsWith('berlaku-')));
}
cek('kemiripan teks identik = 1', kemiripan(contoh.soal, contoh.soal) === 1);
cek('kemiripan dua soal berbeda rendah', kemiripan(data.bank[0].soal, data.bank[500].soal) < 0.3);
const h = buatPaket(data, P({ jumlahPaket: 2, sumber: 'bank' }));
const kembar = { ...h.paket[1], soal: [h.paket[0].soal[5], ...h.paket[1].soal.slice(1)] };
cek('soal kembar antarpaket → gagal', cekPaket(kembar, { data, tanggalAcuan: ACUAN }, [h.paket[0], kembar]).gagal >= 1);
const tukar = [...h.paket[0].soal];
const iBlok = tukar.findIndex((s) => s.kasusId);
[tukar[iBlok], tukar[tukar.length - 1]] = [tukar[tukar.length - 1], tukar[iBlok]];
cek('blok kasus terpisah → gagal paket', cekPaket({ ...h.paket[0], soal: tukar }, { data, tanggalAcuan: ACUAN }).paket.some((c) => c.id.startsWith('blok-') && c.level === 'gagal'));
const k = posisiKunci(h.paket[0].soal);
cek('posisiKunci menghitung 100 soal', HURUF.reduce((a, x) => a + k[x], 0) === 100);
cek('cariJebakan aman tanpa daftar', cariJebakan('teks', contoh, []).length === 0);

bagian('Tahap 3 · Deteksi aturan lama dan bukti model');
const uji = (kode: string, teks: string, konteksSoal = '') => cariJebakan(teks, { kode: kode as Huruf & never, soal: konteksSoal, kasus: null } as never, data.jebakan).map((j) => j.id);
cek('setor PPh tanggal 10 (2026) terdeteksi', uji('PP', 'disetor paling lambat 10 April 2026').includes('setor-tgl10'));
cek('setor PPh 15 April 2026 tidak terdeteksi', uji('PP', 'disetor paling lambat 15 April 2026').length === 0);
cek('bunga 2% per bulan terdeteksi', uji('KUP', 'bunga 2% per bulan selama 3 bulan').includes('bunga-2persen'));
cek('denda PBB 2% per bulan tidak terdeteksi', uji('PBB', 'denda 2% per bulan atas PBB').length === 0);
cek('sanksi keberatan 50% terdeteksi', uji('KUP', 'dikenai sanksi denda 50% dari jumlah pajak', 'keberatan ditolak').includes('keberatan-50'));
cek('sanksi banding 100% terdeteksi', uji('KUP', 'sanksi denda 100% dari jumlah pajak', 'putusan banding').includes('banding-100'));
cek('kenaikan 100% Pasal 15 tidak terdeteksi', uji('KUP', 'ditambah kenaikan 100%', 'SKPKBT Pasal 15 ayat (2) Pasal 13 ayat (3)').length === 0);
cek('kenaikan 50% Pasal 13 ayat (3) terdeteksi', uji('KUP', 'ditambah kenaikan 50%', 'SKPKB Pasal 13 ayat (3) huruf b').includes('kenaikan-13-3'));
cek('denda faktur 2% DPP terdeteksi', uji('PPN', 'denda 2% dari DPP', 'faktur pajak terlambat').includes('faktur-2persen'));
cek('tarif PPN 11% (2026) terdeteksi', uji('PPN', 'tarif PPN 11% atas harga jual').includes('ppn-11-harga'));
cek('"setara 11%" tidak terdeteksi', uji('PPN', '12% × 11/12, setara tarif PPN 11% efektif').length === 0);
cek('UMKM 1% terdeteksi', uji('OP', 'PPh final 1% dari omzet', 'UMKM').includes('umkm-1persen'));
cek('PSAK 46 tanpa PSAK 212 terdeteksi', uji('AKT', 'diakui sesuai PSAK 46').includes('psak-lama'));
cek('PSAK 212 (dulu PSAK 46) tidak terdeteksi', uji('AKT', 'PSAK 212 (dulu PSAK 46)').length === 0);
cek('bea meterai Rp6.000 terdeteksi', uji('BM', 'bea meterai Rp6.000', 'meterai').includes('bm-6000'));
cek('Rp6.000.000 tidak terdeteksi sebagai bea meterai lama', uji('BM', 'kuitansi Rp6.000.000', 'meterai').length === 0);
cek('lapisan Pasal 17 Rp50 juta terdeteksi', uji('OP', 'sampai dengan Rp50 juta dikenai 5%').includes('pasal17-50juta'));
cek('lapisan pesangon 50 juta tidak terdeteksi', uji('PP', 'pesangon sampai dengan Rp50 juta dikenai 5%').length === 0);
const hm = buatPaket(data, P({ sumber: 'campuran', jumlahPaket: 1 }));
const sm = hm.paket[0].soal.find((s) => s.asal === 'model')!;
cek('soal model lolos hitung ulang', cekSoal(sm, { data, tanggalAcuan: ACUAN }).some((c) => c.id === 'hitung' && c.level === 'lolos'));
const kunciLain = HURUF.find((h) => h !== sm.kunci)!;
cek('kunci model diubah → gagal hitung ulang', cekSoal({ ...sm, kunci: kunciLain }, { data, tanggalAcuan: ACUAN }).some((c) => c.id === 'hitung' && c.level === 'gagal'));
cek('soal model disunting → bukti batal (peringatan)', cekSoal({ ...sm, disunting: true }, { data, tanggalAcuan: ACUAN }).some((c) => c.id === 'hitung' && c.level === 'peringatan'));
cek('model tak dikenal → gagal', cekSoal({ ...sm, modelId: 'tidak-ada' }, { data, tanggalAcuan: ACUAN }).some((c) => c.id === 'hitung' && c.level === 'gagal'));

export { data, P, ACUAN };
selesai('verify:quality');
