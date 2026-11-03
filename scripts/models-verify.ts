// npm run verify:models: model soal baru dihitung ulang di banyak seed + uji emas dari contoh kartu rumus/bank.
import { HURUF, pengaturanAwal } from '../lib/config';
import { muatDataNode } from '../lib/data-node';
import { buatPaket, dariModel } from '../lib/generate';
import { kapasitasModel, kondisiTersedia, MODELS, modelById } from '../lib/models';
import { GalatModel, type KonteksModel } from '../lib/models/types';
import { cekSoal } from '../lib/quality';
import { gantiNomor } from '../lib/replace';
import { pilihUrutan, terapkanUrutan, hitungKunciKosong } from '../lib/soal';
import type { Pengaturan } from '../lib/types';
import { normalTeks, rng } from '../lib/util';
import { galatStruktur } from '../lib/validate';
import { bagian, cek, selesai } from './harness';

const data = muatDataNode();
const ACUAN = '2026-11-02';
const ctx: KonteksModel = { data, tanggalAcuan: ACUAN };
const PENYEBAB = new Set(['tertukar_aturan', 'belum_tahu_aturan', 'lupa_syarat', 'salah_tarif_dpp', 'salah_periode', 'salah_hitung', 'sulit_menggabungkan']);
const aturan = new Set(data.aturan.map((a) => a.id));
const m = (id: string) => modelById(id)!;
const hu = (id: string, p: Record<string, string | number | boolean>) => m(id).hitungUlang(p, ctx);

bagian('Uji emas (contoh kartu rumus dan kunci soal bank)');
cek('PPh 23 jasa Rp50 juta → Rp1.000.000 (kartu PP-07)', hu('pph23', { jenis: 'jasa', npwp: true, bruto: 50_000_000, tanggal: '2026-03-10' }) === 'Rp1.000.000');
cek('PPh 23 royalti Rp50 juta → Rp7.500.000 (kartu PP-07)', hu('pph23', { jenis: 'royalti', npwp: true, bruto: 50_000_000, tanggal: '2026-03-10' }) === 'Rp7.500.000');
cek('PPh 23 jasa tanpa NPWP Rp50 juta → Rp2.000.000 (4%)', hu('pph23', { jenis: 'jasa', npwp: false, bruto: 50_000_000, tanggal: '2026-03-10' }) === 'Rp2.000.000');
cek('PPh 23 sewa crane Rp80 juta → Rp1.600.000 (kunci bank P1-AKT-02)', hu('pph23', { jenis: 'sewa', npwp: true, bruto: 80_000_000, tanggal: '2026-03-18' }) === 'Rp1.600.000');
cek('PPh 4(2) sewa Rp120 juta → Rp12.000.000', hu('pph42-sewa', { sewaPerTahun: 120_000_000, tahun: 1, service: 0, tanggal: '2026-03-01' }) === 'Rp12.000.000');
cek('PPh 21 bukan pegawai Rp30 juta → Rp750.000 (pembahasan bank, 5% × 50%)', hu('pph21-bukan-pegawai', { bruto: 30_000_000, npwp: true, tanggal: '2026-01-14' }) === 'Rp750.000');
cek('PPh 21 bukan pegawai Rp200 juta → Rp9.000.000 (60 jt × 5% + 40 jt × 15%)', hu('pph21-bukan-pegawai', { bruto: 200_000_000, npwp: true, tanggal: '2026-01-14' }) === 'Rp9.000.000');
cek('PPh 26 royalti Rp1 miliar, DGT 10% → Rp100.000.000', hu('pph26-p3b', { dgt: true, tarifP3b: 0.1, bruto: 1_000_000_000, tanggal: '2026-03-01' }) === 'Rp100.000.000');
cek('PPh 26 tanpa DGT → 20% = Rp200.000.000', hu('pph26-p3b', { dgt: false, tarifP3b: 0.1, bruto: 1_000_000_000, tanggal: '2026-03-01' }) === 'Rp200.000.000');
cek('PPN non-mewah Rp100 juta → Rp11.000.000 (kartu PPN-01)', hu('ppn-dpp', { jenis: 'bkp', harga: 100_000_000, tanggal: '2026-03-01' }) === 'Rp11.000.000');
cek('PPN keramik Rp180 juta → Rp19.800.000 (kunci bank E2-PPN-01)', hu('ppn-dpp', { jenis: 'bkp', harga: 180_000_000, tanggal: '2026-05-06' }) === 'Rp19.800.000');
cek('PPN barang mewah Rp1 miliar → Rp120.000.000', hu('ppn-dpp', { jenis: 'mewah', harga: 1_000_000_000, tanggal: '2026-03-01' }) === 'Rp120.000.000');
cek('PPN terutang 100 − 40 − 10 jt → Kurang bayar Rp50.000.000', hu('ppn-terutang', { pk: 100_000_000, pm1: 40_000_000, pm2: 10_000_000, pm3: 5_000_000, kompensasi: 0 }) === 'Kurang bayar Rp50.000.000');
cek('PPN terutang lebih bayar', hu('ppn-terutang', { pk: 50_000_000, pm1: 60_000_000, pm2: 5_000_000, pm3: 1_000_000, kompensasi: 0 }) === 'Lebih bayar Rp15.000.000');
// PKP Rp300 juta → Rp44 juta (kartu OP-01): neto = 300 jt + PTKP K/2 67,5 jt.
cek('PPh OP PKP Rp300 juta → Rp44.000.000 (kartu OP-01)', hu('pph-op-terutang', { status: 4, neto: 367_500_000, kredit: 0, tanggal: '2025-12-31' }) === 'Rp44.000.000');
cek('PPh OP PKP dibulatkan ke bawah ribuan', hu('pph-op-terutang', { status: 0, neto: 54_000_000 + 10_000_999, kredit: 0, tanggal: '2025-12-31' }) === 'Rp500.000');
const umkmBulan = (bulan: number) => Number(hu('pph-final-umkm', { omzet: '300000000,300000000,200000000', bulanDitanya: bulan, badan: false, tanggal: '2026-12-31' }).replace(/\D/g, ''));
cek('UMKM OP omzet Rp800 juta → total Rp1.500.000 (kartu OP-07)', umkmBulan(1) + umkmBulan(2) + umkmBulan(3) === 1_500_000, [umkmBulan(1), umkmBulan(2), umkmBulan(3)]);
cek('UMKM perseroan perorangan tanpa batas Rp500 juta', hu('pph-final-umkm', { omzet: '300000000,300000000', bulanDitanya: 1, badan: true, tanggal: '2026-12-31' }) === 'Rp1.500.000');
cek('Pemeteraian kemudian kuitansi Rp20 juta → Rp20.000 (kartu BM-06)', hu('bea-meterai', { kondisi: 'pemeteraian-kemudian', nominal: 20_000_000, rangkap: 1, tanggal: ACUAN }) === 'Rp20.000');
cek('Kuitansi tepat Rp5 juta → Rp0', hu('bea-meterai', { kondisi: 'kuitansi-tepat-batas', nominal: 5_000_000, rangkap: 1, tanggal: ACUAN }) === 'Rp0');
cek('Perjanjian 3 rangkap → Rp30.000', hu('bea-meterai', { kondisi: 'rangkap', nominal: 0, rangkap: 3, tanggal: ACUAN }) === 'Rp30.000');
cek('Setor PPh 23 Masa Maret 2026 → 15 April 2026 (kunci bank P1-AKT-02)', hu('tenggat-setor-lapor', { kondisi: 'setor-pph23', tahun: 2026, masa: 3 }) === '15 April 2026');
cek('Lapor SPT Masa PPh Maret 2026 → 20 April 2026', hu('tenggat-setor-lapor', { kondisi: 'lapor-spt-masa-pph', tahun: 2026, masa: 3 }) === '20 April 2026');
cek('Setor PPN Masa Maret 2026 → 30 April 2026', hu('tenggat-setor-lapor', { kondisi: 'setor-ppn', tahun: 2026, masa: 3 }) === '30 April 2026');
// 15 Februari 2026 = Minggu → Senin 16 Februari 2026.
cek('Setor PPh Masa Januari 2026: 15 Feb (Minggu) bergeser ke 16 Februari 2026', hu('tenggat-setor-lapor', { kondisi: 'setor-pph-akhir-pekan', tahun: 2026, masa: 1 }) === '16 Februari 2026');

bagian('Uji emas model lanjutan (Tahap 5)');
cek('Bunga Pasal 8(2): Rp10 juta, 30 Apr–15 Jul, 1,01% → Rp303.000 (kartu KUP-04)', hu('sanksi-bunga', { kondisi: '8-2', pokok: 10_000_000, mulai: '2026-04-30', bayar: '2026-07-15', acuan: 0.0708 }) === 'Rp303.000');
cek('Bunga Pasal 9(2a): Rp40 juta, 15 Okt–3 Nov, 1,01% → Rp404.000 (pembahasan bank)', hu('sanksi-bunga', { kondisi: '9-2a', pokok: 40_000_000, mulai: '2026-10-15', bayar: '2026-11-03', acuan: 0.0708 }) === 'Rp404.000');
cek('Bunga dibatasi 24 bulan', hu('sanksi-bunga', { kondisi: 'maks-24', pokok: 10_000_000, mulai: '2022-04-30', bayar: '2025-01-10', acuan: 0.0708 }) === 'Rp2.424.000');
cek('Pasal 31E: bruto 20 M, PKP 2 M → Rp387.200.000 (kartu BDN-02)', hu('pasal-31e', { bruto: 20_000_000_000, pkp: 2_000_000_000, tanggal: '2025-12-31' }) === 'Rp387.200.000');
cek('Pasal 31E: bruto ≤ 4,8 M → 11% seluruh PKP', hu('pasal-31e', { bruto: 4_000_000_000, pkp: 400_000_000, tanggal: '2025-12-31' }) === 'Rp44.000.000');
cek('Pasal 31E: bruto > 50 M → 22%', hu('pasal-31e', { bruto: 60_000_000_000, pkp: 1_000_000_000, tanggal: '2025-12-31' }) === 'Rp220.000.000');
cek('Branch profit tax: PKP 1 M → Rp156.000.000 (kartu BTI-03)', hu('branch-profit-tax', { pkp: 1_000_000_000, p3b: false, tarifP3b: 0.1, tanggal: '2025-12-31' }) === 'Rp156.000.000');
cek('Thin cap: utang 60 M, modal 10 M, bunga 3 M → koreksi Rp1.000.000.000 (kartu BTI-04)', hu('thin-cap', { utang: 60_000_000_000, modal: 10_000_000_000, biaya: 3_000_000_000 }) === 'Rp1.000.000.000');
cek('PBB-P5L perkebunan NJOP 10 M → Rp19.976.000', hu('pbb-p5l', { njop: 10_000_000_000, sektor: 'perkebunan' }) === 'Rp19.976.000');
cek('PBB-P5L lainnya NJOP 500 jt → NJKP 20% = Rp488.000', hu('pbb-p5l', { njop: 500_000_000, sektor: 'lainnya' }) === 'Rp488.000');
cek('Pesangon Rp420 juta → Rp50.500.000 (pembahasan bank P1-PP-06)', hu('pesangon-final', { jumlah: 420_000_000, tanggal: '2026-03-01' }) === 'Rp50.500.000');
cek('Penyusutan GL kel. 2, Rp120 jt, April → Rp11.250.000', hu('penyusutan-fiskal', { kondisi: 'garis-lurus-tahun-pertama', kelompok: '2', bulanPerolehan: 4, harga: 120_000_000, tanggal: '2025-12-31' }) === 'Rp11.250.000');
cek('Penyusutan SM kel. 1 tahun kedua, Rp96 jt, Juli', hu('penyusutan-fiskal', { kondisi: 'saldo-menurun-tahun-kedua', kelompok: '1', bulanPerolehan: 7, harga: 96_000_000, tanggal: '2024-12-31' }) === 'Rp36.000.000');
cek('Jasa konstruksi menengah Rp1 M → Rp26.500.000', hu('jasa-konstruksi', { kondisi: 'menengah-besar', nilai: 1_000_000_000, tanggal: '2026-03-01' }) === 'Rp26.500.000');
cek('Kredit PPh 24: DN 8 M, LN 2 M, pajak LN 600 jt → Rp440.000.000', hu('kredit-pph24', { dn: 8_000_000_000, ln: 2_000_000_000, pajakLn: 600_000_000, tanggal: '2025-12-31' }) === 'Rp440.000.000');
cek('NPPN: bruto Rp1,2 M, norma 30%, TK/0 → Rp45.500.000', hu('nppn', { bruto: 1_200_000_000, norma: 0.3, kawin: false, anak: 0, tanggal: '2025-12-31' }) === 'Rp45.500.000');
cek('PPh 25: (1,2 M − 100 jt − 50 jt) / 12 → Rp87.500.000', hu('angsuran-pph25', { terutang: 1_200_000_000, pph22: 100_000_000, pph23: 50_000_000, pph24: 0 }) === 'Rp87.500.000');

bagian('Setiap model di banyak seed');
const SEED_TOTAL = 240;
let totalSoal = 0;
const posisiAngka = hitungKunciKosong();
for (const model of MODELS) {
  const masalah: string[] = [];
  const tanda = new Set<string>();
  let n = 0;
  const SEED = Math.ceil(SEED_TOTAL / model.kondisi.length);
  for (const kondisi of model.kondisi) for (let i = 0; i < SEED; i++) {
    const r = rng('uji|' + model.id + '|' + kondisi + '|' + i);
    let h;
    try { h = model.buat(r, ctx, kondisi); } catch (e) { masalah.push(kondisi + '#' + i + ' gagal dibuat: ' + (e as Error).message); continue; }
    n++;
    const s = dariModel(h, model, data);
    const teksSemua = JSON.stringify([s.soal, s.opsi, s.inti, s.langkah, s.kenapaSalah, s.poinIngat, s.dasarHukum]);
    const g = galatStruktur({ ...s, id: s.uid });
    if (g.length) masalah.push(kondisi + '#' + i + ' struktur: ' + g.join('; '));
    const ulang = model.hitungUlang(s.params ?? {}, ctx);
    if (normalTeks(ulang) !== normalTeks(s.opsi[s.kunci])) masalah.push(kondisi + '#' + i + ' hitung ulang ' + ulang + ' ≠ kunci ' + s.opsi[s.kunci]);
    if (HURUF.some((x) => x !== s.kunci && normalTeks(s.opsi[x]) === normalTeks(s.opsi[s.kunci]))) masalah.push(kondisi + '#' + i + ' pengecoh sama dengan kunci');
    if (HURUF.some((x) => x !== s.kunci && !s.kenapaSalah[x])) masalah.push(kondisi + '#' + i + ' alasan pengecoh kosong');
    if (HURUF.some((x) => x !== s.kunci && !PENYEBAB.has(s.penyebabSalah[x] ?? ''))) masalah.push(kondisi + '#' + i + ' penyebab salah tidak dikenal');
    if (!s.dasarHukum.length || s.ruleIds.some((id) => !aturan.has(id)) || !s.ruleIds.length) masalah.push(kondisi + '#' + i + ' rujukan/dasar hukum');
    if (/undefined|NaN|null|\[object/.test(teksSemua)) masalah.push(kondisi + '#' + i + ' teks rusak');
    if (!/\.\.\.$/.test(s.soal)) masalah.push(kondisi + '#' + i + ' batang soal tidak diakhiri "..."');
    if (s.kesulitan !== model.kesulitan(kondisi)) masalah.push(kondisi + '#' + i + ' kesulitan');
    const mutu = cekSoal(s, ctx);
    if (mutu.some((c) => c.level === 'gagal')) masalah.push(kondisi + '#' + i + ' cek mutu gagal: ' + mutu.filter((c) => c.level === 'gagal').map((c) => c.ket).join('; '));
    if (mutu.some((c) => c.id.startsWith('lama-'))) masalah.push(kondisi + '#' + i + ' kunci memuat aturan lama');
    // Setelah diurutkan/diacak oleh generator, kunci tetap teks yang sama.
    const t = terapkanUrutan(s, pilihUrutan(s, r, hitungKunciKosong()));
    if (t.opsi[t.kunci] !== s.opsi[s.kunci]) masalah.push(kondisi + '#' + i + ' kunci berubah setelah urutan');
    if (s.opsiAngka) posisiAngka[t.kunci]++;
    tanda.add(s.tanda);
  }
  totalSoal += n;
  cek(model.id + ': ' + n + ' soal tanpa masalah', masalah.length === 0, masalah.slice(0, 5));
  cek(model.id + ': ≥ 200 seed', n >= 200, n);
  const ulang = model.buat(rng('det|' + model.id), ctx, model.kondisi[0]);
  cek(model.id + ': deterministik', JSON.stringify(ulang) === JSON.stringify(model.buat(rng('det|' + model.id), ctx, model.kondisi[0])));
  console.log('  info: ' + model.id + ' · ' + model.kondisi.length + ' kondisi · kapasitas ' + kapasitasModel(model, ctx) + ' · ' + tanda.size + ' tanda unik dari ' + n + ' soal');
}
const totalAngka = HURUF.reduce((a, h) => a + posisiAngka[h], 0);
cek('posisi kunci soal angka model bervariasi (tiap huruf ≥ 10%)', HURUF.every((h) => posisiAngka[h] >= 0.1 * totalAngka), posisiAngka);
console.log('  info: posisi kunci soal angka model setelah diurutkan ' + JSON.stringify(posisiAngka) + ' dari ' + totalAngka);

bagian('Tanggal acuan dan parameter');
const ctxLama: KonteksModel = { data, tanggalAcuan: '2024-06-01' };
let tolak: unknown = null;
try { m('ppn-dpp').buat(rng('lama'), ctxLama, 'non-mewah-bkp'); } catch (e) { tolak = e; }
cek('model menolak bila parameter belum berlaku (DPP 11/12 pada 2024)', tolak instanceof GalatModel, String(tolak));
cek('kondisi yang ditolak tidak dihitung tersedia', !kondisiTersedia(m('ppn-dpp'), ctxLama).includes('non-mewah-bkp'));
const p2024 = buatPaket(data, { ...pengaturanAwal(), tanggalAcuan: '2024-06-01', jumlahPaket: 1, sumber: 'campuran' } as Pengaturan);
cek('paket 2024 tetap terbentuk; PPN diisi bank', p2024.paket[0].soal.length === 100 && !p2024.paket[0].soal.some((s) => s.modelId === 'ppn-dpp'));
const tenggatLama = m('tenggat-setor-lapor');
const hLama = tenggatLama.hitungUlang({ kondisi: 'setor-pph23', tahun: 2024, masa: 3 }, ctx);
cek('tanggal 10 untuk masa 2024 (aturan saat itu)', hLama === '10 April 2024', hLama);

bagian('Integrasi dengan perakit');
const P = (p: Partial<Pengaturan>): Pengaturan => ({ ...pengaturanAwal(), tanggalAcuan: ACUAN, ...p });
const baru = buatPaket(data, P({ sumber: 'baru', jenis: 'materi', materi: ['KUP', 'OP', 'PP', 'PPN', 'BM'], jumlahSoal: 30, jumlahPaket: 2 }));
cek('sumber baru: semua soal dari model', baru.paket.every((p) => p.soal.every((s) => s.asal === 'model')));
const tandaBaru = baru.paket.flatMap((p) => p.soal.map((s) => s.tanda));
cek('sumber baru: tanpa kembar logika di 2 paket', new Set(tandaBaru).size === tandaBaru.length);
const campur = buatPaket(data, P({ sumber: 'campuran', jumlahPaket: 3 }));
const nBaru = campur.paket.map((p) => p.soal.filter((s) => s.asal === 'model').length);
cek('campuran: tiap paket memuat soal baru', nBaru.every((n) => n >= 15), nBaru);
console.log('  info: soal baru per paket campuran ' + JSON.stringify(nBaru));
const iModel = campur.paket[0].soal.findIndex((s) => s.asal === 'model');
const g = gantiNomor(data, P({ sumber: 'campuran', jumlahPaket: 3 }), campur.paket, 0, [iModel + 1], 'ganti-model');
const lama = campur.paket[0].soal[iModel], ganti = g.paket[0].soal[iModel];
cek('ganti nomor soal model → soal model lain dengan materi sama', g.diganti === 1 && ganti.uid !== lama.uid && ganti.kode === lama.kode && ganti.tanda !== lama.tanda, { lama: lama.tanda, baru: ganti.tanda });
console.log('  info: ' + totalSoal + ' soal model diuji');

selesai('verify:models');
