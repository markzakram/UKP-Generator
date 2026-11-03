// Model soal baru materi PPN.
import { persen, rupiah } from '../util';
import { bulanTransaksi, dasar, hasilAngka, kelipatan, konteksUsaha, namaBadan, opsiDari, param, paramRaw, pilihPengecoh, type Kandidat } from './bantu';
import type { KonteksModel, ModelSoal } from './types';

const jumlahUsaha = (ctx: KonteksModel) => ctx.data.konteks.usaha.length;

// ---------------------------------------------------------------- Tarif & DPP PPN
const KONDISI_DPP: Record<string, { jenis: 'bkp' | 'jkp' | 'mewah' }> = {
  'non-mewah-bkp': { jenis: 'bkp' }, jkp: { jenis: 'jkp' }, mewah: { jenis: 'mewah' },
};
const BARANG_MEWAH = ['kendaraan bermotor penumpang', 'kapal pesiar pribadi', 'hunian mewah (rumah)'];
const hitungDpp = (p: Record<string, string | number | boolean>, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const tarif = param(ctx, 'ppn.tarif', tgl);
  const harga = Number(p.harga);
  if (p.jenis === 'mewah') return { tarif, dpp: harga, ppn: Math.round(harga * tarif) };
  const [a, b] = paramRaw(ctx, 'ppn.dppNonMewah', tgl).nilai as number[];
  const dpp = Math.round((harga * a) / b);
  return { tarif, dpp, ppn: Math.round(dpp * tarif), pecahan: a + '/' + b };
};
export const ppnDpp: ModelSoal = {
  id: 'ppn-dpp', nama: 'Tarif dan DPP PPN', kode: 'PPN', subtema: 'DPP & tarif PPN', tingkat: 'A',
  ringkas: 'Non-mewah: 12% × DPP nilai lain 11/12 (efektif 11%); barang mewah: 12% × harga jual penuh.',
  kondisi: Object.keys(KONDISI_DPP),
  kesulitan: (k) => (k === 'mewah' ? 'sedang' : 'mudah'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungDpp(p, ctx).ppn),
  buat(r, ctx, kondisi = r.pick(Object.keys(KONDISI_DPP))) {
    const k = KONDISI_DPP[kondisi];
    const kt = konteksUsaha(r, ctx);
    const t = bulanTransaksi(r, ctx);
    if (k.jenis === 'mewah' && t.iso < '2025-02-01') throw new Error('Model ppn-dpp mewah memerlukan tanggal transaksi sejak 1 Februari 2025.');
    const penjual = namaBadan(r, ctx, 'PT'), pembeli = namaBadan(r, ctx, 'PT', [penjual]);
    const harga = kelipatan(r, k.jenis === 'mewah' ? 600_000_000 : 24_000_000, k.jenis === 'mewah' ? 3_600_000_000 : 960_000_000, 12_000);
    const ppnbm = k.jenis === 'mewah' ? r.pick([0.15, 0.2, 0.4]) : 0;
    const barang = k.jenis === 'mewah' ? r.pick(BARANG_MEWAH) : k.jenis === 'jkp' ? kt.usaha.jasa! : kt.usaha.barang!;
    const params = { kondisi, jenis: k.jenis, harga, ppnbm, tanggal: t.iso };
    const h = hitungDpp(params, ctx);
    const deskripsi = k.jenis === 'mewah' ? barang + ' yang tergolong barang mewah dan dikenai PPnBM ' + persen(ppnbm) : k.jenis === 'jkp' ? barang + ' (bukan jasa yang dibebaskan)' : barang + '. Barang tersebut bukan barang mewah dan tidak mendapat fasilitas PPN';
    const peran = k.jenis === 'jkp' ? 'penyedia ' + barang : k.jenis === 'mewah' ? 'penyalur ' + barang : 'pemasok ' + barang;
    const soal = penjual + ' (PKP, ' + peran + ' di ' + kt.kota + ') pada ' + t.teks + ' ' + (k.jenis === 'jkp' ? 'menyerahkan ' : 'menjual ') + deskripsi + ' kepada ' + pembeli + ', ' + kt.usaha.jenis + ', dengan ' + (k.jenis === 'jkp' ? 'penggantian ' : 'harga jual ') + rupiah(harga) + ' (belum termasuk pajak). PPN yang wajib dipungut ' + penjual + ' adalah ...';
    const kandidat: Kandidat[] = k.jenis === 'mewah'
      ? [
          { nilai: Math.round(harga * 11 / 12 * h.tarif), alasan: 'Memakai DPP nilai lain 11/12. DPP itu untuk barang selain barang mewah; barang mewah memakai harga jual penuh.', penyebab: 'tertukar_aturan' },
          { nilai: Math.round(harga * (h.tarif + ppnbm)), alasan: 'Menjumlahkan PPN dan PPnBM. PPnBM dihitung terpisah dan tidak termasuk PPN yang ditanyakan.', penyebab: 'sulit_menggabungkan' },
          { nilai: Math.round(harga * ppnbm), alasan: 'Itu PPnBM (' + persen(ppnbm) + ' × harga jual), bukan PPN.', penyebab: 'tertukar_aturan' },
          { nilai: Math.round(harga * 0.1), alasan: 'Tarif 10% berlaku sebelum 1 April 2022.', penyebab: 'salah_periode' },
        ]
      : [
          { nilai: Math.round(harga * h.tarif), alasan: 'Mengalikan 12% dengan harga jual penuh. Cara itu hanya untuk barang mewah; selain itu DPP-nya nilai lain 11/12 (PMK 131/2024).', penyebab: 'salah_tarif_dpp' },
          { nilai: Math.round(h.dpp * 0.11), alasan: 'Mengurangi dua kali: tarif 11% dikalikan lagi dengan DPP 11/12. Yang benar 12% × 11/12 × harga jual.', penyebab: 'salah_tarif_dpp' },
          { nilai: Math.round(harga * 0.1), alasan: 'Tarif 10% berlaku sebelum 1 April 2022.', penyebab: 'salah_periode' },
          { nilai: h.dpp, alasan: 'Itu DPP nilai lain (11/12 × harga jual), bukan PPN-nya.', penyebab: 'salah_hitung' },
          { nilai: Math.round(harga * 0.012), alasan: '1,2% adalah PPN besaran tertentu (misalnya kendaraan bermotor bekas), bukan tarif umum.', penyebab: 'tertukar_aturan' },
          { nilai: Math.round((harga / 1.11) * 0.11), alasan: 'Menganggap harga jual sudah termasuk PPN; harga dalam soal belum termasuk pajak.', penyebab: 'salah_tarif_dpp' },
        ];
    const langkah = k.jenis === 'mewah'
      ? ['Barang mewah yang dikenai PPnBM: DPP PPN = harga jual penuh (PMK 131/2024 Pasal 2).', 'PPN = ' + persen(h.tarif) + ' × ' + rupiah(harga) + ' = ' + rupiah(h.ppn) + '.', 'PPnBM ' + persen(ppnbm) + ' dihitung terpisah dan tidak menambah PPN.']
      : [(k.jenis === 'jkp' ? 'JKP' : 'BKP') + ' selain barang mewah: DPP nilai lain 11/12 × ' + (k.jenis === 'jkp' ? 'penggantian' : 'harga jual') + ' (PMK 131/2024 Pasal 3).', 'DPP = 11/12 × ' + rupiah(harga) + ' = ' + rupiah(h.dpp) + '.', 'PPN = ' + persen(h.tarif) + ' × ' + rupiah(h.dpp) + ' = ' + rupiah(h.ppn) + ' (setara 11% × ' + rupiah(harga) + ').'];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: ppnDpp.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: k.jenis === 'mewah' ? 'PPN atas barang mewah: 12% × harga jual penuh' : 'Tarif 12% × DPP nilai lain 11/12 atas ' + (k.jenis === 'jkp' ? 'JKP' : 'BKP non-mewah'),
      soal, inti: k.jenis === 'mewah' ? 'Barang mewah: PPN = 12% × harga jual penuh = ' + rupiah(h.ppn) + '; PPnBM terpisah.' : 'PPN = 12% × (11/12 × ' + rupiah(harga) + ') = ' + rupiah(h.ppn) + ', setara 11% dari harga jual.', langkah,
      dasarHukum: [dasar(ctx, 'ppn.tarif', t.iso), k.jenis === 'mewah' ? dasar(ctx, 'ppn.mewahHargaPenuh', t.iso) : dasar(ctx, 'ppn.dppNonMewah', t.iso)],
      ruleIds: [k.jenis === 'mewah' ? 'R-PPN-13' : 'R-PPN-12'],
      poinIngat: 'Non-mewah: 12% × 11/12 × harga jual = 11% efektif; 12% penuh hanya untuk barang mewah; PPnBM dihitung terpisah.',
    }, r, h.ppn, kandidat);
  },
};

// ---------------------------------------------------------------- PPN terutang dan kompensasi
const KONDISI_TERUTANG = ['kurang-bayar', 'lebih-bayar', 'kompensasi-kurang-bayar'];
const PM_TAK_KREDIT = ['paket liburan keluarga direksi', 'perabot rumah pribadi pemegang saham', 'jamuan ulang tahun keluarga direktur'];
const hasilTeks = (n: number) => (n > 0 ? 'Kurang bayar ' + rupiah(n) : n < 0 ? 'Lebih bayar ' + rupiah(-n) : 'Nihil');
const hitungTerutang = (p: Record<string, string | number | boolean>) => Number(p.pk) - Number(p.pm1) - Number(p.pm2) - Number(p.kompensasi);
export const ppnTerutang: ModelSoal = {
  id: 'ppn-terutang', nama: 'PPN kurang/lebih bayar dan kompensasi', kode: 'PPN', subtema: 'Pengkreditan Pajak Masukan', tingkat: 'A',
  ringkas: 'PK − PM yang dapat dikreditkan − kompensasi; PM yang tidak berhubungan langsung dengan usaha tidak dikreditkan.',
  kondisi: KONDISI_TERUTANG,
  kesulitan: (k) => (k === 'kurang-bayar' ? 'mudah' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p) => hasilTeks(hitungTerutang(p)),
  buat(r, ctx, kondisi = r.pick(KONDISI_TERUTANG)) {
    const kt = konteksUsaha(r, ctx);
    const t = bulanTransaksi(r, ctx);
    const pkp = namaBadan(r, ctx, 'PT');
    const pk = kelipatan(r, 80_000_000, 600_000_000, 100_000);
    let pm1: number, pm2: number, kompensasi = 0;
    if (kondisi === 'lebih-bayar') { pm1 = kelipatan(r, pk * 0.7, pk * 1.05, 100_000); pm2 = kelipatan(r, pk * 0.15, pk * 0.4, 100_000); }
    else { pm1 = kelipatan(r, pk * 0.3, pk * 0.55, 100_000); pm2 = kelipatan(r, pk * 0.05, pk * 0.2, 100_000); }
    if (kondisi === 'kompensasi-kurang-bayar') kompensasi = kelipatan(r, pk * 0.05, (pk - pm1 - pm2) * 0.6, 100_000);
    const pm3 = kelipatan(r, 2_000_000, 40_000_000, 100_000);
    const params = { kondisi, pk, pm1, pm2, pm3, kompensasi, tanggal: t.iso };
    const n = hitungTerutang(params);
    const tak = r.pick(PM_TAK_KREDIT);
    const masa = t.teks.split(' ').slice(1).join(' ');
    const soal = 'Data Masa Pajak ' + masa + ' ' + pkp + ' (PKP, ' + kt.usaha.jenis + ' di ' + kt.kota + '), seluruh penyerahannya terutang PPN: Pajak Keluaran ' + rupiah(pk) + '; Pajak Masukan atas pembelian ' + kt.usaha.barang + ' ' + rupiah(pm1) + '; Pajak Masukan atas pembelian mesin produksi ' + rupiah(pm2) + '; Pajak Masukan atas ' + tak + ' ' + rupiah(pm3) + '.'
      + (kompensasi ? ' Terdapat lebih bayar Masa Pajak sebelumnya ' + rupiah(kompensasi) + ' yang dikompensasikan ke masa ini.' : '') + ' Semua Faktur Pajak lengkap dan dibuat pada masa yang sama. PPN kurang atau lebih bayar ' + pkp + ' untuk Masa Pajak tersebut adalah ...';
    const kandidatAngka: Kandidat[] = [
      { nilai: n - pm3, alasan: 'Ikut mengkreditkan Pajak Masukan atas ' + tak + '. Perolehan yang tidak berhubungan langsung dengan kegiatan usaha tidak dapat dikreditkan (UU PPN Pasal 9 ayat (8) huruf b).', penyebab: 'lupa_syarat' },
      { nilai: -n, alasan: 'Tanda terbalik: Pajak Keluaran dikurangi Pajak Masukan, bukan sebaliknya.', penyebab: 'salah_hitung' },
      { nilai: n + pm2, alasan: 'Tidak mengkreditkan PPN atas mesin produksi. Pajak Masukan atas aktiva yang dipakai untuk usaha dapat dikreditkan.', penyebab: 'belum_tahu_aturan' },
    ];
    if (kompensasi) {
      kandidatAngka.push({ nilai: n + kompensasi, alasan: 'Tidak memperhitungkan kompensasi lebih bayar masa sebelumnya.', penyebab: 'lupa_syarat' });
      kandidatAngka.push({ nilai: n + 2 * kompensasi, alasan: 'Menambahkan kompensasi. Lebih bayar yang dikompensasikan mengurangi PPN kurang bayar.', penyebab: 'salah_hitung' });
    } else kandidatAngka.push({ nilai: n - pm3 + pm2, alasan: 'Mengkreditkan PM yang tidak boleh dan tidak mengkreditkan PM mesin yang boleh.', penyebab: 'tertukar_aturan' });
    // Hasil berupa teks (kurang/lebih bayar), jadi pengecoh dipilih dengan format teks yang sama.
    const p = pilihPengecoh(r, n, kandidatAngka, hasilTeks, true);
    const pengecoh = p.map((x) => ({ teks: hasilTeks(x.nilai), alasan: x.alasan, penyebab: x.penyebab }));
    const o = opsiDari(hasilTeks(n), pengecoh);
    const kredit = pm1 + pm2;
    return {
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: ppnTerutang.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: 'PPN kurang/lebih bayar dengan Pajak Masukan yang tidak dapat dikreditkan' + (kompensasi ? ' dan kompensasi' : ''),
      soal, ...o, kunciModel: hasilTeks(n), opsiAngka: false,
      inti: 'PK ' + rupiah(pk) + ' − PM yang dapat dikreditkan ' + rupiah(kredit) + (kompensasi ? ' − kompensasi ' + rupiah(kompensasi) : '') + ' = ' + hasilTeks(n).toLowerCase() + '; PM atas ' + tak + ' tidak dapat dikreditkan.',
      langkah: [
        'Pajak Masukan atas ' + tak + ' tidak berhubungan langsung dengan kegiatan usaha → tidak dapat dikreditkan (Pasal 9 ayat (8) huruf b).',
        'PM yang dapat dikreditkan = ' + rupiah(pm1) + ' + ' + rupiah(pm2) + ' = ' + rupiah(kredit) + '.',
        rupiah(pk) + ' − ' + rupiah(kredit) + (kompensasi ? ' − ' + rupiah(kompensasi) : '') + ' = ' + (n < 0 ? '−' + rupiah(-n) : rupiah(n)) + ' → ' + hasilTeks(n).toLowerCase() + '.',
        ...(n < 0 ? ['Lebih bayar masa selain akhir tahun buku dikompensasikan ke masa berikutnya (Pasal 9 ayat (4)).'] : ['Kurang bayar disetor paling lambat akhir bulan berikutnya sebelum SPT Masa PPN disampaikan.']),
      ],
      dasarHukum: ['UU PPN Pasal 9 ayat (2), (3), (4) dan ayat (8) huruf b s.t.d.d. UU 7/2021 (HPP)'], ruleIds: ['R-PPN-26', 'R-PPN-28'],
      poinIngat: 'PPN masa = PK − PM yang dapat dikreditkan − kompensasi; PM untuk kepentingan pribadi/tidak terkait usaha tidak dapat dikreditkan.',
    };
  },
};
