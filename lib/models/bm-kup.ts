// Model soal baru materi BM (Bea Meterai) dan KUP (tenggat setor/lapor).
import { akhirBulan, buatTanggal, isoTanggal, namaBulan, rupiah, tanggal } from '../util';
import { dasar, hasilAngka, kelipatan, konteksUsaha, namaBadan, namaOrang, opsiDari, param, paramLama, type Kandidat } from './bantu';
import type { KonteksModel, ModelSoal } from './types';

// ---------------------------------------------------------------- Bea Meterai
const KONDISI_BM = ['kuitansi-objek', 'kuitansi-tepat-batas', 'pemeteraian-kemudian', 'alat-bukti', 'rangkap'];
const hitungBm = (p: Record<string, string | number | boolean>, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const tarif = param(ctx, 'bm.tarif', tgl), batas = param(ctx, 'bm.batasNominal', tgl), sanksi = param(ctx, 'bm.sanksiPemeteraianKemudian', tgl);
  switch (p.kondisi) {
    case 'kuitansi-objek': case 'kuitansi-tepat-batas': return { tarif, batas, bm: Number(p.nominal) > batas ? tarif : 0 };
    case 'pemeteraian-kemudian': return { tarif, batas, bm: Math.round(tarif * (1 + sanksi)) };
    case 'alat-bukti': return { tarif, batas, bm: tarif };
    default: return { tarif, batas, bm: tarif * Number(p.rangkap) };
  }
};
export const beaMeterai: ModelSoal = {
  id: 'bea-meterai', nama: 'Bea meterai: objek, rangkap, pemeteraian kemudian', kode: 'BM', subtema: 'Sanksi, kedaluwarsa & pidana', tingkat: 'A',
  ringkas: 'Tarif tetap Rp10.000; dokumen uang objek bila lebih dari Rp5 juta; tiap rangkap terutang; pemeteraian kemudian + sanksi 100% kecuali alat bukti di pengadilan.',
  kondisi: KONDISI_BM,
  kesulitan: (k) => (k === 'kuitansi-objek' ? 'mudah' : k === 'alat-bukti' ? 'sulit' : 'sedang'),
  jumlahKonteks: (ctx) => ctx.data.konteks.usaha.length,
  hitungUlang: (p, ctx) => rupiah(hitungBm(p, ctx).bm),
  buat(r, ctx, kondisi = r.pick(KONDISI_BM)) {
    const kt = konteksUsaha(r, ctx);
    const tgl = ctx.tanggalAcuan;
    const tarif = param(ctx, 'bm.tarif', tgl), batas = param(ctx, 'bm.batasNominal', tgl);
    const tarifLama = Number(paramLama(ctx, 'bm.tarif', tgl)?.nilai ?? 6000);
    const pihak = namaBadan(r, ctx, 'PT'), orang = namaOrang(r, ctx);
    const nominal = kondisi === 'kuitansi-tepat-batas' ? batas : kelipatan(r, batas + 500_000, 250_000_000, 500_000);
    const rangkap = kondisi === 'rangkap' ? r.int(2, 4) : 1;
    const params = { kondisi, nominal, rangkap, tanggal: tgl };
    const h = hitungBm(params, ctx);
    let soal = '', inti = '', langkah: string[] = [], subtopik = '';
    const kandidat: Kandidat[] = [];
    if (kondisi === 'kuitansi-objek' || kondisi === 'kuitansi-tepat-batas') {
      soal = pihak + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') menerima pelunasan piutang dari ' + orang + ' sebesar ' + rupiah(nominal) + ' dan menerbitkan kuitansi tanda terima uang untuk ' + orang + '. Bea Meterai yang terutang atas kuitansi tersebut adalah ...';
      subtopik = 'Dokumen yang menyatakan jumlah uang: batas lebih dari Rp5 juta';
      inti = nominal > batas ? 'Kuitansi ' + rupiah(nominal) + ' melebihi ' + rupiah(batas) + ' → objek Bea Meterai dengan tarif tetap ' + rupiah(tarif) + '.' : 'Kuitansi tepat ' + rupiah(batas) + ' tidak LEBIH dari ' + rupiah(batas) + ' → bukan objek Bea Meterai.';
      langkah = ['Dokumen yang menyatakan penerimaan uang menjadi objek bila nominalnya lebih dari ' + rupiah(batas) + ' (UU 10/2020 Pasal 3 ayat (2) huruf g).', nominal > batas ? rupiah(nominal) + ' > ' + rupiah(batas) + ' → terutang tarif tetap ' + rupiah(tarif) + ', berapa pun nominalnya.' : rupiah(nominal) + ' tidak lebih dari ' + rupiah(batas) + ' → tidak terutang.'];
      kandidat.push(
        { nilai: nominal > batas ? 0 : tarif, alasan: nominal > batas ? 'Kuitansi bernilai lebih dari ' + rupiah(batas) + ' adalah objek Bea Meterai.' : 'Batasnya LEBIH DARI ' + rupiah(batas) + '; nominal tepat ' + rupiah(batas) + ' belum menjadi objek.', penyebab: nominal > batas ? 'belum_tahu_aturan' : 'lupa_syarat' },
        { nilai: tarifLama, alasan: rupiah(tarifLama) + ' adalah tarif lama sebelum 1 Januari 2021.', penyebab: 'salah_periode' },
        { nilai: tarif * 2, alasan: 'Kuitansi sepihak dibuat satu dokumen; Bea Meterai dikenakan sekali per dokumen.', penyebab: 'salah_hitung' },
        { nilai: tarif * 3, alasan: 'Tarif Bea Meterai tetap per dokumen, tidak berjenjang menurut nominal.', penyebab: 'tertukar_aturan' },
      );
    } else if (kondisi === 'pemeteraian-kemudian') {
      soal = 'Kuitansi pelunasan sebesar ' + rupiah(nominal) + ' yang diterbitkan ' + pihak + ' kepada ' + orang + ' pada ' + tanggal((Number(tgl.slice(0, 4)) - 1) + '-0' + r.int(2, 9) + '-1' + r.int(0, 9)) + ' tidak dibubuhi meterai. Saat ini ' + orang + ' melakukan Pemeteraian Kemudian atas kuitansi tersebut di luar keperluan alat bukti di pengadilan. Jumlah yang harus dibayar adalah ...';
      subtopik = 'Pemeteraian Kemudian atas dokumen yang Bea Meterainya tidak dibayar';
      inti = 'Bea Meterai terutang ' + rupiah(tarif) + ' + sanksi administratif 100% ' + rupiah(tarif) + ' = ' + rupiah(h.bm) + '.';
      langkah = ['Kuitansi lebih dari ' + rupiah(batas) + ' terutang Bea Meterai ' + rupiah(tarif) + ' tetapi tidak dibayar.', 'Pemeteraian Kemudian atas dokumen yang Bea Meterainya tidak dibayar: Bea Meterai terutang + sanksi 100% (UU 10/2020 Pasal 17 ayat (1) huruf a dan ayat (2)).', rupiah(tarif) + ' + ' + rupiah(tarif) + ' = ' + rupiah(h.bm) + '.'];
      kandidat.push(
        { nilai: tarif, alasan: 'Tanpa sanksi 100%. Pembebasan sanksi hanya untuk dokumen yang dipakai sebagai alat bukti di pengadilan.', penyebab: 'lupa_syarat' },
        { nilai: tarif * 3, alasan: 'Sanksi 200% berlaku untuk dokumen yang terutang sebelum 1 Januari 2021 (PMK 78/2024 Pasal 49).', penyebab: 'salah_periode' },
        { nilai: tarifLama * 2, alasan: 'Memakai tarif lama ' + rupiah(tarifLama) + '; Pemeteraian Kemudian memakai tarif yang berlaku saat dilakukan.', penyebab: 'salah_periode' },
        { nilai: 0, alasan: 'Kewajiban Bea Meterai belum kedaluwarsa (5 tahun sejak terutang).', penyebab: 'belum_tahu_aturan' },
      );
    } else if (kondisi === 'alat-bukti') {
      soal = orang + ' akan menggunakan surat korespondensi biasa dengan ' + pihak + ' (bukan dokumen yang terutang Bea Meterai saat dibuat) sebagai alat bukti dalam perkara perdata di pengadilan. Bea Meterai yang harus dibayar melalui Pemeteraian Kemudian adalah ...';
      subtopik = 'Pemeteraian Kemudian atas dokumen alat bukti di pengadilan (tanpa sanksi)';
      inti = 'Dokumen yang digunakan sebagai alat bukti di pengadilan dimeteraikan kemudian sebesar Bea Meterai terutang ' + rupiah(tarif) + ', tanpa sanksi.';
      langkah = ['Dokumen yang digunakan sebagai alat bukti di pengadilan adalah objek Bea Meterai (UU 10/2020 Pasal 3 ayat (1) huruf b).', 'Pemeteraian Kemudian untuk keperluan alat bukti: sebesar Bea Meterai terutang tanpa sanksi (Pasal 17 ayat (1) huruf b, Pasal 18 ayat (1) huruf b) = ' + rupiah(tarif) + '.'];
      kandidat.push(
        { nilai: tarif * 2, alasan: 'Menambahkan sanksi 100%. Untuk dokumen alat bukti di pengadilan tidak ada sanksi.', penyebab: 'lupa_syarat' },
        { nilai: 0, alasan: 'Dokumen yang digunakan sebagai alat bukti di pengadilan termasuk objek Bea Meterai.', penyebab: 'belum_tahu_aturan' },
        { nilai: tarifLama, alasan: rupiah(tarifLama) + ' adalah tarif lama sebelum 2021.', penyebab: 'salah_periode' },
        { nilai: tarif * 3, alasan: 'Sanksi 200% hanya untuk dokumen terutang sebelum 2021 yang tidak dibayar, bukan dokumen alat bukti.', penyebab: 'tertukar_aturan' },
      );
    } else {
      soal = pihak + ' dan ' + orang + ' menandatangani surat perjanjian sewa alat kerja yang dibuat dalam ' + rangkap + ' rangkap asli; setiap rangkap ditandatangani kedua pihak dan disimpan oleh pihak yang berbeda. Jumlah seluruh Bea Meterai yang terutang atas perjanjian tersebut adalah ...';
      subtopik = 'Bea Meterai atas dokumen rangkap';
      inti = 'Setiap rangkap adalah dokumen tersendiri: ' + rangkap + ' × ' + rupiah(tarif) + ' = ' + rupiah(h.bm) + '.';
      langkah = ['Surat perjanjian adalah objek Bea Meterai berapa pun nilainya (UU 10/2020 Pasal 3 ayat (2) huruf a).', 'Rangkap adalah satuan dokumen; setiap rangkap terutang tarif tetap ' + rupiah(tarif) + '.', rangkap + ' × ' + rupiah(tarif) + ' = ' + rupiah(h.bm) + '.'];
      kandidat.push(
        { nilai: tarif, alasan: 'Menghitung satu dokumen saja; setiap rangkap merupakan dokumen tersendiri.', penyebab: 'lupa_syarat' },
        { nilai: tarif * (rangkap + 1), alasan: 'Menambah satu dokumen yang tidak ada.', penyebab: 'salah_hitung' },
        { nilai: tarifLama * rangkap, alasan: 'Memakai tarif lama ' + rupiah(tarifLama) + '.', penyebab: 'salah_periode' },
        { nilai: 0, alasan: 'Surat perjanjian selalu objek Bea Meterai, tanpa batas nominal.', penyebab: 'belum_tahu_aturan' },
      );
    }
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: beaMeterai.kesulitan(kondisi), bloom: kondisi === 'kuitansi-objek' ? 'understand' : 'apply', tipe: 'Konsep & hitungan', subtopik,
      soal, inti, langkah, dasarHukum: [dasar(ctx, 'bm.tarif', tgl), dasar(ctx, 'bm.batasNominal', tgl), ...(kondisi === 'pemeteraian-kemudian' || kondisi === 'alat-bukti' ? [dasar(ctx, 'bm.sanksiPemeteraianKemudian', tgl)] : [])],
      ruleIds: kondisi === 'rangkap' ? ['R-BM-04'] : kondisi.startsWith('kuitansi') ? ['R-BM-02', 'R-BM-04'] : ['R-BM-11'],
      poinIngat: 'Bea Meterai Rp10.000 per dokumen (tiap rangkap); dokumen uang objek bila LEBIH dari Rp5 juta; Pemeteraian Kemudian + sanksi 100%, kecuali alat bukti di pengadilan.',
    }, r, h.bm, kandidat);
  },
};

// ---------------------------------------------------------------- Tenggat setor dan lapor
const KONDISI_TENGGAT = ['setor-pph23', 'lapor-spt-masa-pph', 'setor-ppn', 'setor-pph-akhir-pekan'];
const hariKerja = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
const geserKerja = (d: Date) => { const x = new Date(d); while (!hariKerja(x)) x.setUTCDate(x.getUTCDate() + 1); return x; };
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function jatuhTempo(p: Record<string, string | number | boolean>, ctx: KonteksModel) {
  const y = Number(p.tahun), m = Number(p.masa);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const acuan = isoTanggal(buatTanggal(ny, nm, 1));
  let hari: number;
  if (p.kondisi === 'setor-ppn') hari = akhirBulan(ny, nm);
  else if (p.kondisi === 'lapor-spt-masa-pph') hari = param(ctx, 'tenggat.laporSptMasaPph', acuan);
  else hari = param(ctx, 'tenggat.setorPphMasa', acuan);
  const asli = buatTanggal(ny, nm, hari);
  return { ny, nm, asli, akhir: geserKerja(asli) };
}
export const tenggat: ModelSoal = {
  id: 'tenggat-setor-lapor', nama: 'Batas setor dan lapor masa', kode: 'KUP', subtema: 'Pembayaran & pelaporan', tingkat: 'A',
  ringkas: 'Setor PPh masa tanggal 15, lapor SPT Masa PPh tanggal 20, PPN akhir bulan berikutnya; jatuh tempo hari libur bergeser ke hari kerja berikutnya.',
  kondisi: KONDISI_TENGGAT,
  kesulitan: (k) => (k === 'setor-pph-akhir-pekan' ? 'sedang' : 'mudah'),
  // Konteks = masa pajak yang jatuh temponya cocok dengan kondisi dalam 12 bulan terakhir (perkiraan konservatif).
  jumlahKonteks: () => 5,
  hitungUlang: (p, ctx) => tanggal(isoTanggal(jatuhTempo(p, ctx).akhir)),
  buat(r, ctx, kondisi = r.pick(KONDISI_TENGGAT)) {
    const kt = konteksUsaha(r, ctx);
    const [ay, am] = ctx.tanggalAcuan.split('-').map(Number);
    // Masa pajak 1–11 bulan sebelum tanggal acuan; pilih yang jatuh temponya sesuai kondisi (akhir pekan atau hari kerja).
    let params: Record<string, string | number | boolean> = {}, jt = null as ReturnType<typeof jatuhTempo> | null;
    for (const mundur of r.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])) {
      const d = buatTanggal(ay, am - mundur, 1);
      const cobaP = { kondisi, tahun: d.getUTCFullYear(), masa: d.getUTCMonth() + 1 };
      const j = jatuhTempo(cobaP, ctx);
      if (j.asli < buatTanggal(2025, 1, 1)) continue;
      const akhirPekan = !hariKerja(j.asli);
      if ((kondisi === 'setor-pph-akhir-pekan') === akhirPekan) { params = cobaP; jt = j; break; }
    }
    if (!jt) throw new Error('Tidak ada masa pajak yang cocok untuk kondisi ' + kondisi + ' sekitar ' + ctx.tanggalAcuan + '.');
    const pemotong = namaBadan(r, ctx, 'PT');
    const masaTeks = namaBulan(Number(params.masa) - 1) + ' ' + params.tahun;
    const kunciTeks = tanggal(isoTanggal(jt.akhir));
    const d = (hari: number) => tanggal(isoTanggal(buatTanggal(jt!.ny, jt!.nm, hari)));
    const keterangan = ' Tidak ada hari libur nasional atau cuti bersama pada bulan jatuh tempo.';
    let soal: string, inti: string, langkah: string[];
    const kandidat: { teks: string; alasan: string; penyebab: string }[] = [];
    const lama = paramLama(ctx, 'tenggat.setorPphMasa');
    if (kondisi === 'setor-ppn') {
      soal = pemotong + ' (PKP, ' + kt.usaha.jenis + ' di ' + kt.kota + ') mempunyai PPN kurang bayar untuk Masa Pajak ' + masaTeks + '.' + keterangan + ' Batas akhir penyetoran PPN tersebut adalah ...';
      inti = 'PPN kurang bayar disetor paling lambat akhir bulan berikutnya setelah masa pajak berakhir dan sebelum SPT Masa PPN disampaikan: ' + kunciTeks + '.';
      langkah = ['PPN/PPnBM: setor paling lambat akhir bulan berikutnya (PMK 81/2024 Pasal 94 ayat (3) huruf e).', 'Masa ' + masaTeks + ' → akhir ' + namaBulan(jt.nm - 1) + ' ' + jt.ny + ' = ' + kunciTeks + ' (hari ' + NAMA_HARI[jt.akhir.getUTCDay()] + ').'];
      kandidat.push({ teks: d(15), alasan: 'Tanggal 15 bulan berikutnya adalah batas setor PPh masa, bukan PPN.', penyebab: 'tertukar_aturan' }, { teks: d(20), alasan: 'Tanggal 20 adalah batas lapor SPT Masa PPh.', penyebab: 'tertukar_aturan' }, { teks: d(10), alasan: 'Tanggal 10 adalah batas setor PPh masa menurut aturan lama.', penyebab: 'salah_periode' });
    } else if (kondisi === 'lapor-spt-masa-pph') {
      soal = pemotong + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') memotong PPh Pasal 23 atas pembayaran ' + kt.usaha.jasa + ' pada Masa Pajak ' + masaTeks + '.' + keterangan + ' Batas akhir penyampaian SPT Masa PPh Unifikasi untuk masa tersebut adalah ...';
      inti = 'SPT Masa PPh disampaikan paling lambat tanggal 20 bulan berikutnya: ' + kunciTeks + '.';
      langkah = ['Batas lapor SPT Masa PPh: tanggal 20 bulan berikutnya (UU KUP Pasal 3 ayat (3) huruf a).', 'Masa ' + masaTeks + ' → ' + kunciTeks + ' (hari ' + NAMA_HARI[jt.akhir.getUTCDay()] + ').'];
      kandidat.push({ teks: d(15), alasan: 'Tanggal 15 adalah batas setor PPh, bukan batas lapor SPT Masa.', penyebab: 'tertukar_aturan' }, { teks: d(akhirBulan(jt.ny, jt.nm)), alasan: 'Akhir bulan berikutnya adalah batas setor dan lapor PPN.', penyebab: 'tertukar_aturan' }, { teks: d(10), alasan: 'Tanggal 10 adalah batas setor PPh menurut aturan lama.', penyebab: 'salah_periode' });
    } else {
      const akhirPekan = kondisi === 'setor-pph-akhir-pekan';
      const asliTeks = tanggal(isoTanggal(jt.asli));
      soal = pemotong + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') memotong PPh Pasal 23 atas pembayaran ' + kt.usaha.jasa + ' pada Masa Pajak ' + masaTeks + '.' + (akhirPekan ? ' Tanggal ' + asliTeks + ' jatuh pada hari ' + NAMA_HARI[jt.asli.getUTCDay()] + '.' : '') + keterangan + ' Batas akhir penyetoran PPh Pasal 23 tersebut adalah ...';
      inti = 'PPh Pasal 23 disetor paling lambat tanggal 15 bulan berikutnya' + (akhirPekan ? '; karena ' + asliTeks + ' hari ' + NAMA_HARI[jt.asli.getUTCDay()] + ', batasnya bergeser ke hari kerja berikutnya, ' + kunciTeks : ': ' + kunciTeks) + '.';
      langkah = ['Batas setor PPh yang dipotong: tanggal 15 bulan berikutnya (PMK 81/2024 Pasal 94 ayat (2)).', ...(akhirPekan ? [asliTeks + ' jatuh pada hari ' + NAMA_HARI[jt.asli.getUTCDay()] + ' → bergeser ke hari kerja berikutnya, ' + kunciTeks + ' (hari ' + NAMA_HARI[jt.akhir.getUTCDay()] + ').'] : ['Masa ' + masaTeks + ' → ' + kunciTeks + '.'])];
      if (akhirPekan) {
        const jumat = new Date(jt.asli); while (!hariKerja(jumat)) jumat.setUTCDate(jumat.getUTCDate() - 1);
        kandidat.push({ teks: asliTeks, alasan: 'Tidak menggeser tanggal jatuh tempo; jatuh tempo pada hari libur bergeser ke hari kerja berikutnya.', penyebab: 'lupa_syarat' }, { teks: tanggal(isoTanggal(jumat)), alasan: 'Bergeser ke hari kerja SEBELUMNYA; aturannya hari kerja berikutnya.', penyebab: 'salah_hitung' });
      }
      kandidat.push({ teks: d(10), alasan: 'Tanggal 10 adalah batas setor menurut aturan lama' + (lama ? ' (' + lama.dasar + ')' : '') + '; sejak 1 Januari 2025 tanggal 15.', penyebab: 'salah_periode' }, { teks: d(20), alasan: 'Tanggal 20 adalah batas lapor SPT Masa PPh, bukan batas setor.', penyebab: 'tertukar_aturan' }, { teks: d(akhirBulan(jt.ny, jt.nm)), alasan: 'Akhir bulan berikutnya adalah batas setor PPN.', penyebab: 'tertukar_aturan' });
    }
    const unik = kandidat.filter((k, i) => k.teks !== kunciTeks && kandidat.findIndex((x) => x.teks === k.teks) === i);
    const pilih = r.shuffle(unik).slice(0, 3);
    if (pilih.length < 3) throw new Error('Pengecoh tenggat kurang dari 3.');
    const o = opsiDari(kunciTeks, pilih);
    return {
      kondisi, konteks: 'm' + params.masa, params, kesulitan: tenggat.kesulitan(kondisi), bloom: 'apply', tipe: 'Konsep & batas waktu',
      subtopik: kondisi === 'setor-ppn' ? 'Batas setor PPN akhir bulan berikutnya' : kondisi === 'lapor-spt-masa-pph' ? 'Batas lapor SPT Masa PPh tanggal 20' : 'Batas setor PPh masa tanggal 15' + (kondisi === 'setor-pph-akhir-pekan' ? ' bergeser karena akhir pekan' : ''),
      soal, ...o, kunciModel: kunciTeks, opsiAngka: false, inti, langkah,
      dasarHukum: [kondisi === 'setor-ppn' ? dasar(ctx, 'tenggat.ppnAkhirBulan') : kondisi === 'lapor-spt-masa-pph' ? dasar(ctx, 'tenggat.laporSptMasaPph') : dasar(ctx, 'tenggat.setorPphMasa')], ruleIds: ['R-KUP-04'],
      poinIngat: 'Setor PPh masa tgl 15, lapor SPT Masa PPh tgl 20, PPN akhir bulan berikutnya; jatuh tempo hari libur → hari kerja berikutnya.',
    };
  },
};

