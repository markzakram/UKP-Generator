// Model soal baru tambahan (R4, 3 Nov 2026): subtema berbobot besar di bank yang belum punya model.
// Semua angka aturan dibaca dari data/ukp-parameter.json; nilai lama hanya dipakai sebagai pengecoh.
import { buatTanggal, namaBulan, persen, rupiah, type Rng } from '../util';
import { bulanTransaksi, bulatBawahRibu, dasar, hasilAngka, kelipatan, konteksUsaha, namaBadan, param, paramLama, paramRaw, type Kandidat } from './bantu';
import type { KonteksModel, ModelSoal } from './types';

type P = Record<string, string | number | boolean>;
const jumlahUsaha = (ctx: KonteksModel) => ctx.data.konteks.usaha.length;
const tahunLalu = (ctx: KonteksModel) => Number(ctx.tanggalAcuan.slice(0, 4)) - 1;
const nilaiLama = (ctx: KonteksModel, kunci: string, pada: string) => paramLama(ctx, kunci, pada)?.nilai as number | undefined;
// Usaha yang penyerahannya bukan objek PPN atau dibebaskan (hotel dan restoran kena PBJT; jasa kesehatan dan pendidikan)
// tidak dipakai untuk soal pengkreditan Pajak Masukan.
const BUKAN_PPN = /hotel|restoran|rumah sakit|sekolah/;
const indeksPkp = (ctx: KonteksModel) => ctx.data.konteks.usaha.map((u, i) => (BUKAN_PPN.test(u.jenis) ? -1 : i)).filter((i) => i >= 0);
function konteksPkp(r: Rng, ctx: KonteksModel) {
  const kt = konteksUsaha(r, ctx);
  const pilihan = indeksPkp(ctx);
  if (pilihan.includes(kt.indeks)) return kt;
  const i = r.pick(pilihan);
  return { ...kt, indeks: i, usaha: ctx.data.konteks.usaha[i] };
}

// ---------------------------------------------------------------- Pengkreditan Pajak Masukan
const PM_TIDAK = new Set(['tanpa-hubungan-usaha', 'faktur-tidak-lengkap']);
const KONDISI_PM = ['tanpa-hubungan-usaha', 'faktur-tidak-lengkap', 'sedan-operasional', 'pm-masa-sebelumnya'];
const hitungPm = (p: P, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const tarif = param(ctx, 'ppn.tarif', tgl);
  const [a, b] = paramRaw(ctx, 'ppn.dppNonMewah', tgl).nilai as number[];
  const dpp = Math.round((Number(p.harga) * a) / b);
  const pk = Math.round(dpp * tarif);
  const kredit = Number(p.pmBahan) + (PM_TIDAK.has(String(p.kondisi)) ? 0 : Number(p.pmLain));
  return { tarif, a, b, dpp, pk, kredit, kurang: pk - kredit };
};
export const pengkreditanPm: ModelSoal = {
  id: 'pengkreditan-pm', nama: 'PPN kurang bayar: PK − PM yang dapat dikreditkan', kode: 'PPN', subtema: 'Pengkreditan Pajak Masukan', tingkat: 'A',
  ringkas: 'PK = tarif × DPP nilai lain 11/12; PM tidak dapat dikreditkan bila tidak berhubungan langsung dengan usaha atau Faktur Pajak cacat; PM sedan boleh sejak UU HPP; PM masa lain paling lama 3 Masa Pajak.',
  kondisi: KONDISI_PM,
  kesulitan: (k) => (k === 'tanpa-hubungan-usaha' ? 'mudah' : k === 'sedan-operasional' ? 'sulit' : 'sedang'),
  jumlahKonteks: (ctx) => indeksPkp(ctx).length,
  hitungUlang: (p, ctx) => rupiah(hitungPm(p, ctx).kurang),
  buat(r, ctx, kondisi = r.pick(KONDISI_PM)) {
    const kt = konteksPkp(r, ctx);
    const t = bulanTransaksi(r, ctx);
    const harga = kelipatan(r, 600_000_000, 4_800_000_000, 12_000);
    const awal = hitungPm({ kondisi, harga, pmBahan: 0, pmLain: 0, tanggal: t.iso }, ctx);
    const pmBahan = kelipatan(r, awal.pk * 0.3, awal.pk * 0.55, 1_000);
    const pmLain = kelipatan(r, awal.pk * 0.05, awal.pk * 0.2, 1_000);
    const params = { kondisi, harga, pmBahan, pmLain, tanggal: t.iso };
    const h = hitungPm(params, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const masa = namaBulan(t.bulan - 1) + ' ' + t.tahun;
    const lalu = buatTanggal(t.tahun, t.bulan - r.int(1, 2), 1);
    const masaLalu = namaBulan(lalu.getUTCMonth()) + ' ' + lalu.getUTCFullYear();
    const item: Record<string, string> = {
      'tanpa-hubungan-usaha': 'pembelian perabot untuk rumah pribadi direktur, yang tidak berkaitan dengan kegiatan usaha',
      'faktur-tidak-lengkap': 'pembelian peralatan kerja, tetapi Faktur Pajaknya tidak mencantumkan nama, alamat, dan NPWP pembeli',
      'sedan-operasional': 'pembelian mobil sedan untuk operasional manajemen (bukan barang dagangan dan tidak disewakan)',
      'pm-masa-sebelumnya': 'pembelian bahan penolong dengan Faktur Pajak Masa ' + masaLalu + ' yang belum pernah dikreditkan dan belum dibebankan sebagai biaya',
    };
    const soal = wp + ' adalah PKP ' + kt.usaha.jenis + ' di ' + kt.kota + '. Pada Masa Pajak ' + masa + ' perusahaan melakukan penyerahan Barang/Jasa Kena Pajak di dalam negeri dengan harga jual/penggantian ' + rupiah(harga) + ' (bukan barang mewah, tanpa fasilitas PPN). PPN dalam Faktur Pajak Masukan yang dikreditkan pada masa itu: (1) pembelian ' + kt.usaha.barang + ' untuk kegiatan usaha, Faktur Pajak Masa ' + masa + ' ' + rupiah(pmBahan) + '; (2) ' + item[kondisi] + ' ' + rupiah(pmLain) + '. PPN kurang bayar Masa Pajak ' + masa + ' adalah ...';
    const pkPenuh = Math.round(harga * h.tarif);
    const tidak = PM_TIDAK.has(kondisi);
    const tarifLama = nilaiLama(ctx, 'ppn.tarif', t.iso);
    const kandidat: Kandidat[] = [
      ...(tarifLama ? [{ nilai: Math.round(h.dpp * tarifLama) - h.kredit, alasan: 'Memakai tarif ' + persen(tarifLama) + ' dengan DPP nilai lain; sejak 2025 PK = ' + persen(h.tarif) + ' × DPP ' + h.a + '/' + h.b + ' × harga jual.', penyebab: 'salah_periode' }] : []),
      { nilai: Math.round(Math.round((h.dpp * h.a) / h.b) * h.tarif) - h.kredit, alasan: 'Menerapkan faktor ' + h.a + '/' + h.b + ' dua kali; DPP nilai lain cukup ' + h.a + '/' + h.b + ' × harga jual.', penyebab: 'salah_tarif_dpp' },
      tidak
        ? { nilai: h.pk - pmBahan - pmLain, alasan: 'Ikut mengkreditkan PM butir (2); ' + (kondisi === 'tanpa-hubungan-usaha' ? 'pengeluaran yang tidak berhubungan langsung dengan usaha tidak dapat dikreditkan (Pasal 9 ayat (8) huruf b).' : 'Faktur Pajak tanpa nama, alamat, dan NPWP pembeli tidak dapat dikreditkan (Pasal 9 ayat (8) huruf f).'), penyebab: 'lupa_syarat' }
        : kondisi === 'sedan-operasional'
          ? { nilai: h.pk - pmBahan, alasan: 'Menganggap PM sedan tidak dapat dikreditkan; Pasal 9 ayat (8) huruf c sudah dihapus UU HPP sejak 1 April 2022.', penyebab: 'salah_periode' }
          : { nilai: h.pk - pmBahan, alasan: 'Menganggap PM masa lain tidak boleh dikreditkan; PM dapat dikreditkan paling lama 3 Masa Pajak setelah masa Faktur Pajak dibuat (Pasal 9 ayat (9)).', penyebab: 'lupa_syarat' },
      { nilai: pkPenuh - h.kredit, alasan: 'Menghitung PK dengan tarif × harga jual penuh; untuk barang bukan mewah DPP-nya nilai lain ' + h.a + '/' + h.b + ' × harga jual.', penyebab: 'salah_tarif_dpp' },
      { nilai: h.pk, alasan: 'Tidak mengurangkan Pajak Masukan yang dapat dikreditkan.', penyebab: 'salah_hitung' },
      { nilai: pkPenuh - pmBahan - (tidak ? pmLain : 0), alasan: 'PK dihitung dari harga jual penuh dan PM butir (2) diperlakukan keliru.', penyebab: 'sulit_menggabungkan' },
      { nilai: h.pk - pmLain, alasan: 'Hanya mengurangkan PM butir (2); PM butir (1) untuk kegiatan usaha dapat dikreditkan.', penyebab: 'salah_hitung' },
    ];
    const status2 = tidak ? 'tidak dapat dikreditkan (' + (kondisi === 'tanpa-hubungan-usaha' ? 'huruf b' : 'huruf f') + ')' : kondisi === 'sedan-operasional' ? 'dapat dikreditkan (larangan sedan, huruf c, dihapus UU HPP)' : 'dapat dikreditkan (masih dalam 3 Masa Pajak)';
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pengkreditanPm.kesulitan(kondisi), bloom: kondisi === 'tanpa-hubungan-usaha' ? 'apply' : 'analyze', tipe: 'Hitungan', subtopik: 'Pengkreditan PM: ' + (tidak ? 'PM tidak dapat dikreditkan' : kondisi === 'sedan-operasional' ? 'PM sedan pasca-UU HPP' : 'PM masa sebelumnya'),
      soal, inti: 'PK ' + rupiah(h.pk) + ' − PM yang dapat dikreditkan ' + rupiah(h.kredit) + ' = ' + rupiah(h.kurang) + '; PM butir (2) ' + status2 + '.',
      langkah: [
        'PK = ' + persen(h.tarif) + ' × (' + h.a + '/' + h.b + ' × ' + rupiah(harga) + ') = ' + persen(h.tarif) + ' × ' + rupiah(h.dpp) + ' = ' + rupiah(h.pk) + '.',
        'PM butir (1) ' + rupiah(pmBahan) + ' dapat dikreditkan; PM butir (2) ' + rupiah(pmLain) + ' ' + status2 + '.',
        'PPN kurang bayar = ' + rupiah(h.pk) + ' − ' + rupiah(h.kredit) + ' = ' + rupiah(h.kurang) + '.',
      ],
      dasarHukum: [dasar(ctx, 'ppn.tarif', t.iso), dasar(ctx, 'ppn.dppNonMewah', t.iso), 'UU PPN Pasal 9 ayat (2), (8), dan (9) s.t.d.d. UU 7/2021 (HPP)'],
      ruleIds: ['R-PPN-26', kondisi === 'pm-masa-sebelumnya' ? 'R-PPN-27' : 'R-PPN-28'],
      poinIngat: 'PM tidak dapat dikreditkan: tidak berhubungan langsung dengan usaha (huruf b) dan Faktur Pajak cacat (huruf f). PM sedan boleh dikreditkan sejak UU HPP; PM masa lain paling lama 3 Masa Pajak.',
    }, r, h.kurang, kandidat);
  },
};

// ---------------------------------------------------------------- Rekonsiliasi fiskal
const KONDISI_REKON = ['pkp-susut-positif', 'pkp-susut-negatif', 'pph-terutang'];
const hitungRekon = (p: P, ctx: KonteksModel) => {
  const tarif = param(ctx, 'pphBadan.tarif', String(p.tanggal));
  const susut = p.arah === 'positif' ? Number(p.selisih) : -Number(p.selisih);
  const pkp = bulatBawahRibu(Number(p.laba) + Number(p.sumbangan) + Number(p.sanksi) - Number(p.bunga) + susut);
  return { tarif, susut, pkp, pph: Math.round(pkp * tarif) };
};
export const rekonsiliasiFiskal: ModelSoal = {
  id: 'rekonsiliasi-fiskal', nama: 'Rekonsiliasi fiskal: laba komersial ke PKP dan PPh badan', kode: 'AKT', subtema: 'Rekonsiliasi fiskal: beda tetap & beda temporer', tingkat: 'B',
  ringkas: 'PKP = laba komersial + sumbangan biasa + sanksi pajak − bunga deposito (final) ± selisih penyusutan; dibulatkan ke bawah ribuan; PPh = tarif badan × PKP.',
  kondisi: KONDISI_REKON,
  kesulitan: (k) => (k === 'pkp-susut-positif' ? 'sedang' : 'sulit'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => { const h = hitungRekon(p, ctx); return rupiah(p.tanya === 'pph' ? h.pph : h.pkp); },
  buat(r, ctx, kondisi = r.pick(KONDISI_REKON)) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx), tgl = tahun + '-12-31';
    const arah = kondisi === 'pkp-susut-negatif' ? 'negatif' : kondisi === 'pkp-susut-positif' ? 'positif' : r.pick(['positif', 'negatif']);
    const tanya = kondisi === 'pph-terutang' ? 'pph' : 'pkp';
    const laba = kelipatan(r, 2_000_000_000, 12_000_000_000, 1_000_000) + r.int(1, 9) * 100;
    const params = { kondisi, tanya, arah, laba, sumbangan: kelipatan(r, 20_000_000, 150_000_000, 500_000), sanksi: kelipatan(r, 5_000_000, 60_000_000, 100_000), bunga: kelipatan(r, 30_000_000, 300_000_000, 1_000_000), selisih: kelipatan(r, 40_000_000, 400_000_000, 1_000_000), tanggal: tgl };
    const h = hitungRekon(params, ctx);
    const { sumbangan, sanksi, bunga, selisih } = params;
    const wp = namaBadan(r, ctx, 'PT');
    const bruto = r.int(55, 150);
    const soal = wp + ', ' + kt.usaha.jenis + ' di ' + kt.kota + ', melaporkan laba sebelum pajak menurut laporan keuangan komersial Tahun Pajak ' + tahun + ' sebesar ' + rupiah(laba) + ' dengan peredaran bruto Rp' + bruto + ' miliar (tidak memakai PPh final 0,5% dan tidak memenuhi syarat Pasal 31E). Dalam laba itu sudah termasuk: (1) sumbangan kepada warga sekitar ' + rupiah(sumbangan) + ' (bukan sumbangan yang boleh dikurangkan); (2) beban bunga STP pajak ' + rupiah(sanksi) + '; (3) penghasilan bunga deposito ' + rupiah(bunga) + ' yang telah dipotong PPh final; (4) penyusutan komersial ' + (arah === 'positif' ? 'lebih besar' : 'lebih kecil') + ' ' + rupiah(selisih) + ' daripada penyusutan fiskal. Tidak ada kompensasi kerugian. ' + (tanya === 'pph' ? 'PPh badan terutang' : 'Penghasilan Kena Pajak') + ' Tahun Pajak ' + tahun + ' adalah ...';
    const bersih = (x: number) => bulatBawahRibu(x);
    const balik = -h.susut;
    const pkpSalah: { nilai: number; alasan: string; penyebab: string }[] = [
      { nilai: bersih(laba + sumbangan + sanksi + bunga + h.susut), alasan: 'Menambahkan bunga deposito; penghasilan yang sudah dikenai PPh final dikoreksi negatif.', penyebab: 'tertukar_aturan' },
      { nilai: bersih(laba + sumbangan + sanksi + h.susut), alasan: 'Tidak mengeluarkan bunga deposito yang sudah dikenai PPh final dari laba.', penyebab: 'lupa_syarat' },
      { nilai: bersih(laba + sumbangan + sanksi - bunga + balik), alasan: 'Membalik arah koreksi penyusutan: penyusutan komersial yang lebih besar dikoreksi positif, yang lebih kecil dikoreksi negatif.', penyebab: 'tertukar_aturan' },
      { nilai: bersih(laba - bunga + h.susut), alasan: 'Menganggap sumbangan biasa dan sanksi pajak boleh dibiayakan; keduanya koreksi positif (Pasal 9 ayat (1) huruf g dan k).', penyebab: 'belum_tahu_aturan' },
      { nilai: bersih(laba), alasan: 'Memakai laba komersial tanpa koreksi fiskal.', penyebab: 'salah_hitung' },
    ];
    const lama = nilaiLama(ctx, 'pphBadan.tarif', tgl);
    const kandidat: Kandidat[] = tanya === 'pkp' ? pkpSalah : [
      ...pkpSalah.slice(0, 4).map((k) => ({ ...k, nilai: Math.round(k.nilai * h.tarif) })),
      ...(lama ? [{ nilai: Math.round(h.pkp * lama), alasan: 'Memakai tarif ' + persen(lama) + ' yang berlaku sampai 2019.', penyebab: 'salah_periode' }] : []),
      { nilai: Math.round(bersih(laba) * h.tarif), alasan: 'Mengalikan tarif dengan laba komersial tanpa koreksi fiskal.', penyebab: 'salah_hitung' },
    ];
    const kunci = tanya === 'pph' ? h.pph : h.pkp;
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: rekonsiliasiFiskal.kesulitan(kondisi), bloom: 'analyze', tipe: 'Hitungan', subtopik: 'Rekonsiliasi fiskal: ' + (tanya === 'pph' ? 'PPh badan terutang' : 'PKP') + ', penyusutan komersial ' + (arah === 'positif' ? 'lebih besar' : 'lebih kecil'),
      soal, inti: 'PKP = ' + rupiah(laba) + ' + ' + rupiah(sumbangan) + ' + ' + rupiah(sanksi) + ' − ' + rupiah(bunga) + ' ' + (h.susut >= 0 ? '+ ' : '− ') + rupiah(selisih) + ' = ' + rupiah(h.pkp) + (tanya === 'pph' ? '; PPh = ' + persen(h.tarif) + ' × PKP = ' + rupiah(h.pph) : '') + '.',
      langkah: [
        'Beda tetap, koreksi positif: sumbangan biasa ' + rupiah(sumbangan) + ' dan bunga STP ' + rupiah(sanksi) + ' (Pasal 9 ayat (1) huruf g dan k).',
        'Beda tetap, koreksi negatif: bunga deposito ' + rupiah(bunga) + ' sudah dikenai PPh final (Pasal 4 ayat (2)).',
        'Beda waktu: penyusutan komersial ' + (arah === 'positif' ? 'lebih besar, koreksi positif ' : 'lebih kecil, koreksi negatif ') + rupiah(selisih) + '.',
        'PKP = ' + rupiah(h.pkp) + ' (dibulatkan ke bawah ribuan)' + (tanya === 'pph' ? '; PPh badan = ' + persen(h.tarif) + ' × ' + rupiah(h.pkp) + ' = ' + rupiah(h.pph) : '') + '.',
      ],
      dasarHukum: [dasar(ctx, 'pphBadan.tarif', tgl), 'UU PPh Pasal 4 ayat (2), Pasal 6 ayat (1), Pasal 9 ayat (1) huruf g dan k s.t.d.d. UU 7/2021 (HPP)'],
      ruleIds: ['R-AKT-08', 'R-AKT-09', 'R-AKT-10'],
      poinIngat: 'Koreksi positif: biaya Pasal 9 (sumbangan biasa, sanksi pajak) dan penyusutan komersial yang lebih besar. Koreksi negatif: penghasilan final/bukan objek dan penyusutan komersial yang lebih kecil.',
    }, r, kunci, kandidat);
  },
};

// ---------------------------------------------------------------- Pajak tangguhan (PSAK 212)
const KONDISI_TANGGUHAN = ['liabilitas-penyusutan', 'aset-ckpn', 'beban-perubahan'];
const hitungTangguhan = (p: P, ctx: KonteksModel) => {
  const tarif = param(ctx, 'pphBadan.tarif', String(p.tanggal));
  const beda = p.kondisi === 'beban-perubahan' ? Number(p.akhir) - Number(p.awal) : Number(p.akhir);
  return { tarif, beda, nilai: Math.round(beda * tarif) };
};
export const pajakTangguhan: ModelSoal = {
  id: 'pajak-tangguhan', nama: 'Aset, liabilitas, dan beban pajak tangguhan', kode: 'AKT', subtema: 'Pajak tangguhan (PSAK 212)', tingkat: 'B',
  ringkas: 'Saldo aset/liabilitas pajak tangguhan = beda temporer × tarif PPh badan; beban pajak tangguhan = perubahan beda temporer × tarif.',
  kondisi: KONDISI_TANGGUHAN,
  kesulitan: (k) => (k === 'beban-perubahan' ? 'sulit' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungTangguhan(p, ctx).nilai),
  buat(r, ctx, kondisi = r.pick(KONDISI_TANGGUHAN)) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx), tgl = tahun + '-12-31';
    const akhir = kelipatan(r, 200_000_000, 3_000_000_000, 1_000_000);
    const awal = kondisi === 'beban-perubahan' ? kelipatan(r, akhir * 0.3, akhir * 0.8, 1_000_000) : 0;
    const params = { kondisi, akhir, awal, tanggal: tgl };
    const h = hitungTangguhan(params, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const lama = nilaiLama(ctx, 'pphBadan.tarif', tgl);
    // Pengecoh di bawah kunci: tarif lain yang tertukar (fasilitas Pasal 31E, PPh final UMKM).
    const f31e = (paramRaw(ctx, 'pasal31E', tgl).nilai as { pengurangan: number }).pengurangan;
    const umkm = param(ctx, 'umkm.tarif', tgl);
    const tertukar = (beda: number): Kandidat[] => [
      { nilai: Math.round(beda * h.tarif * f31e), alasan: 'Memakai tarif efektif fasilitas Pasal 31E (' + persen(f31e) + ' × ' + persen(h.tarif) + '); soal menyatakan tarif PPh badan umum yang dipakai.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(beda * umkm), alasan: 'Memakai tarif PPh final UMKM ' + persen(umkm) + '; pajak tangguhan diukur dengan tarif PPh badan umum.', penyebab: 'tertukar_aturan' },
    ];
    const pembuka = wp + ', ' + kt.usaha.jenis + ' di ' + kt.kota + ', menyusun laporan keuangan menurut PSAK 212 dan memakai tarif PPh badan umum (tidak ada perubahan tarif yang telah disahkan). ';
    const soal = pembuka + (kondisi === 'liabilitas-penyusutan'
      ? 'Per 31 Desember ' + tahun + ', akumulasi penyusutan fiskal atas peralatan usaha lebih besar ' + rupiah(akhir) + ' daripada akumulasi penyusutan komersial, sehingga nilai tercatat peralatan melebihi dasar pengenaan pajaknya sebesar itu. Saldo liabilitas pajak tangguhan per 31 Desember ' + tahun + ' adalah ...'
      : kondisi === 'aset-ckpn'
        ? 'Per 31 Desember ' + tahun + ', saldo cadangan kerugian penurunan nilai piutang usaha yang dibebankan secara komersial tetapi belum boleh dibiayakan secara fiskal sebesar ' + rupiah(akhir) + '. Laba kena pajak di masa depan diperkirakan cukup. Saldo aset pajak tangguhan per 31 Desember ' + tahun + ' adalah ...'
        : 'Beda temporer kena pajak dari penyusutan fiskal yang lebih cepat berjumlah ' + rupiah(awal) + ' per 31 Desember ' + (tahun - 1) + ' dan ' + rupiah(akhir) + ' per 31 Desember ' + tahun + '. Beban pajak tangguhan yang diakui dalam laba rugi Tahun ' + tahun + ' adalah ...');
    const kandidat: Kandidat[] = kondisi === 'beban-perubahan'
      ? [
          { nilai: Math.round(akhir * h.tarif), alasan: 'Memakai saldo akhir; beban pajak tangguhan adalah perubahan saldo selama tahun berjalan.', penyebab: 'salah_hitung' },
          { nilai: Math.round((akhir + awal) * h.tarif), alasan: 'Menjumlahkan saldo awal dan akhir; yang dihitung selisihnya.', penyebab: 'salah_hitung' },
          ...(lama ? [{ nilai: Math.round(h.beda * lama), alasan: 'Memakai tarif ' + persen(lama) + ' yang berlaku sampai 2019.', penyebab: 'salah_periode' }] : []),
          { nilai: h.beda, alasan: 'Menyebut perubahan beda temporer tanpa mengalikan tarif pajak.', penyebab: 'salah_hitung' },
          { nilai: Math.round(awal * h.tarif), alasan: 'Memakai saldo awal; beban tahun berjalan berasal dari perubahan saldo.', penyebab: 'salah_hitung' },
          ...tertukar(h.beda),
        ]
      : [
          ...(lama ? [{ nilai: Math.round(akhir * lama), alasan: 'Memakai tarif ' + persen(lama) + ' yang berlaku sampai 2019.', penyebab: 'salah_periode' }] : []),
          { nilai: akhir, alasan: 'Menyebut beda temporer tanpa mengalikan tarif pajak.', penyebab: 'salah_hitung' },
          { nilai: Math.round(akhir * (1 - h.tarif)), alasan: 'Mengurangkan pajak dari beda temporer; yang diminta adalah pajak atas beda temporer.', penyebab: 'salah_hitung' },
          { nilai: Math.round(akhir * h.tarif * 2), alasan: 'Menggandakan dampak pajak; pajak tangguhan cukup beda temporer × tarif.', penyebab: 'salah_hitung' },
          ...tertukar(akhir),
        ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pajakTangguhan.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: kondisi === 'liabilitas-penyusutan' ? 'Liabilitas pajak tangguhan (penyusutan)' : kondisi === 'aset-ckpn' ? 'Aset pajak tangguhan (CKPN piutang)' : 'Beban pajak tangguhan dari perubahan saldo',
      soal, inti: (kondisi === 'beban-perubahan' ? '(' + rupiah(akhir) + ' − ' + rupiah(awal) + ')' : rupiah(akhir)) + ' × ' + persen(h.tarif) + ' = ' + rupiah(h.nilai) + '.',
      langkah: kondisi === 'beban-perubahan'
        ? ['Kenaikan beda temporer kena pajak = ' + rupiah(akhir) + ' − ' + rupiah(awal) + ' = ' + rupiah(h.beda) + '.', 'Beban pajak tangguhan = ' + rupiah(h.beda) + ' × ' + persen(h.tarif) + ' = ' + rupiah(h.nilai) + ' (Debit Beban Pajak Tangguhan; Kredit Liabilitas Pajak Tangguhan).']
        : [kondisi === 'liabilitas-penyusutan' ? 'Nilai tercatat aset > dasar pajak: beda temporer kena pajak → liabilitas pajak tangguhan.' : 'CKPN yang baru dapat dibiayakan kelak: beda temporer dapat dikurangkan → aset pajak tangguhan.', rupiah(akhir) + ' × ' + persen(h.tarif) + ' = ' + rupiah(h.nilai) + '.'],
      dasarHukum: [dasar(ctx, 'pphBadan.tarif', tgl), 'PSAK 212 Pajak Penghasilan'],
      ruleIds: kondisi === 'beban-perubahan' ? ['R-AKT-11', 'R-AKT-12'] : ['R-AKT-11'],
      poinIngat: 'Beda temporer kena pajak → liabilitas; dapat dikurangkan → aset (bila laba kena pajak cukup). Saldo = beda × tarif; beban (manfaat) = perubahan saldo.',
    }, r, h.nilai, kandidat);
  },
};

// ---------------------------------------------------------------- Denda keberatan (Pasal 25 ayat (9) UU KUP)
const KONDISI_KEBERATAN = ['ditolak', 'dikabulkan-sebagian', 'banding'];
const hitungKeberatan = (p: P, ctx: KonteksModel) => {
  const tarif = param(ctx, 'sanksi.keberatan', String(p.tanggal));
  const dasarDenda = Number(p.menurutSk) - Number(p.dibayar);
  return { tarif, dasarDenda, denda: p.kondisi === 'banding' ? 0 : Math.round(tarif * dasarDenda) };
};
export const dendaKeberatan: ModelSoal = {
  id: 'denda-keberatan', nama: 'Denda keberatan Pasal 25 ayat (9) UU KUP', kode: 'KUP', subtema: 'Pembetulan, keberatan & pengurangan/pembatalan', tingkat: 'A',
  ringkas: 'Keberatan ditolak atau dikabulkan sebagian dan tidak banding: denda = tarif × (pajak menurut SK Keberatan − pajak yang dibayar sebelum keberatan); bila banding, denda keberatan tidak dikenakan.',
  kondisi: KONDISI_KEBERATAN,
  kesulitan: (k) => (k === 'ditolak' ? 'mudah' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungKeberatan(p, ctx).denda),
  buat(r, ctx, kondisi = r.pick(KONDISI_KEBERATAN)) {
    const kt = konteksUsaha(r, ctx);
    const t = bulanTransaksi(r, ctx);
    const tahunPajak = t.tahun - r.int(2, 3);
    const skpkb = kelipatan(r, 200_000_000, 2_000_000_000, 1_000_000);
    const dibayar = kelipatan(r, skpkb * 0.1, skpkb * 0.4, 1_000_000);
    const menurutSk = kondisi === 'dikabulkan-sebagian' ? kelipatan(r, dibayar + (skpkb - dibayar) * 0.3, dibayar + (skpkb - dibayar) * 0.8, 1_000_000) : skpkb;
    const params = { kondisi, skpkb, dibayar, menurutSk, tanggal: t.iso };
    const h = hitungKeberatan(params, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const lama = nilaiLama(ctx, 'sanksi.keberatan', t.iso);
    const soal = wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') menerima SKPKB PPh Badan Tahun Pajak ' + tahunPajak + ' dengan pokok kurang bayar ' + rupiah(skpkb) + '. Dalam pembahasan akhir hasil pemeriksaan perusahaan menyetujui ' + rupiah(dibayar) + ' dan melunasinya sebelum mengajukan keberatan atas sisanya. Pada ' + t.teks + ' terbit Surat Keputusan Keberatan yang ' + (kondisi === 'dikabulkan-sebagian' ? 'mengabulkan sebagian keberatan sehingga pajak terutang menjadi ' + rupiah(menurutSk) : 'menolak keberatan') + '. ' + (kondisi === 'banding' ? 'Perusahaan kemudian mengajukan banding ke Pengadilan Pajak dalam jangka waktu yang ditentukan.' : 'Perusahaan tidak mengajukan banding.') + ' Denda Pasal 25 ayat (9) UU KUP yang dikenakan atas keputusan keberatan itu adalah ...';
    const dasarSalah = skpkb - dibayar;
    const kandidat: Kandidat[] = kondisi === 'banding'
      ? [
          { nilai: Math.round(h.tarif * dasarSalah), alasan: 'Mengenakan denda keberatan; bila WP mengajukan banding, denda Pasal 25 ayat (9) tidak dikenakan (Pasal 25 ayat (10)).', penyebab: 'lupa_syarat' },
          ...(lama ? [{ nilai: Math.round(lama * dasarSalah), alasan: 'Mengenakan denda dengan tarif lama ' + persen(lama) + '; lagi pula denda keberatan tidak dikenakan bila banding.', penyebab: 'salah_periode' }] : []),
          { nilai: Math.round(h.tarif * skpkb), alasan: 'Mengenakan denda atas seluruh SKPKB; bila banding, denda keberatan tidak dikenakan.', penyebab: 'lupa_syarat' },
          { nilai: dasarSalah, alasan: 'Menyebut sisa pajak yang belum dibayar, bukan denda.', penyebab: 'salah_hitung' },
        ]
      : [
          ...(lama ? [{ nilai: Math.round(lama * h.dasarDenda), alasan: 'Memakai tarif ' + persen(lama) + ' sebelum UU HPP; sejak 29 Oktober 2021 tarifnya ' + persen(h.tarif) + '.', penyebab: 'salah_periode' }] : []),
          { nilai: Math.round(h.tarif * menurutSk), alasan: 'Tidak mengurangkan pajak yang sudah dibayar sebelum mengajukan keberatan.', penyebab: 'lupa_syarat' },
          { nilai: Math.round(h.tarif * dasarSalah), alasan: 'Memakai jumlah dalam SKPKB; dasar denda adalah pajak menurut SK Keberatan.', penyebab: 'salah_hitung' },
          { nilai: h.dasarDenda, alasan: 'Menyebut dasar pengenaan denda, belum dikalikan tarif.', penyebab: 'salah_hitung' },
          { nilai: Math.round(h.tarif * dibayar), alasan: 'Menghitung denda dari pajak yang sudah dibayar; dasar denda adalah pajak menurut SK Keberatan dikurangi pajak yang dibayar sebelum keberatan.', penyebab: 'salah_hitung' },
          { nilai: Math.round(h.tarif * (skpkb - menurutSk)), alasan: 'Mengenakan denda atas bagian yang dikabulkan; dasar denda adalah pajak menurut SK Keberatan dikurangi pajak yang dibayar sebelum keberatan.', penyebab: 'salah_hitung' },
          { nilai: 0, alasan: 'Menganggap denda hanya bila banding ditolak; denda keberatan dikenakan bila keberatan ditolak atau dikabulkan sebagian dan WP tidak banding.', penyebab: 'belum_tahu_aturan' },
        ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: dendaKeberatan.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'Denda keberatan: ' + (kondisi === 'banding' ? 'WP mengajukan banding' : kondisi === 'ditolak' ? 'keberatan ditolak' : 'dikabulkan sebagian'),
      soal, inti: kondisi === 'banding' ? 'WP mengajukan banding, jadi denda keberatan tidak dikenakan: Rp0.' : persen(h.tarif) + ' × (' + rupiah(menurutSk) + ' − ' + rupiah(dibayar) + ') = ' + rupiah(h.denda) + '.',
      langkah: kondisi === 'banding'
        ? ['Denda Pasal 25 ayat (9) hanya bila keberatan ditolak/dikabulkan sebagian dan WP tidak mengajukan banding.', 'Perusahaan mengajukan banding, sehingga denda keberatan tidak dikenakan (Pasal 25 ayat (10)).']
        : ['Pajak menurut SK Keberatan ' + rupiah(menurutSk) + ' dikurangi pajak yang dibayar sebelum keberatan ' + rupiah(dibayar) + ' = ' + rupiah(h.dasarDenda) + '.', 'Denda = ' + persen(h.tarif) + ' × ' + rupiah(h.dasarDenda) + ' = ' + rupiah(h.denda) + '.'],
      dasarHukum: [dasar(ctx, 'sanksi.keberatan', t.iso), 'UU KUP Pasal 25 ayat (10) s.t.d.t.d. UU 7/2021 (HPP)'],
      ruleIds: ['R-KUP-21', 'R-KUP-20'],
      poinIngat: 'Denda keberatan = tarif × (pajak menurut SK Keberatan − pajak dibayar sebelum keberatan); tidak dikenakan bila WP mengajukan banding.',
    }, r, h.denda, kandidat);
  },
};

export const MODEL_TAMBAHAN: ModelSoal[] = [pengkreditanPm, rekonsiliasiFiskal, pajakTangguhan, dendaKeberatan];

