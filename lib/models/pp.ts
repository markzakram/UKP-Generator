// Model soal baru materi PP (PPh Pemotongan/Pemungutan). Tarif dari data/ukp-parameter.json (PRD F5).
import type { Kesulitan } from '../types';
import { persen, rupiah, type Rng } from '../util';
import { bulanTransaksi, dasar, hasilAngka, kelipatan, konteksUsaha, lapisan17, lapisan17Lama, namaBadan, namaOrang, param, paramRaw, pph17, type Kandidat } from './bantu';
import type { HasilModel, KonteksModel, ModelSoal } from './types';

const KESULITAN = (peta: Record<string, Kesulitan>) => (k: string) => peta[k] ?? 'sedang';
const jumlahUsaha = (ctx: KonteksModel) => ctx.data.konteks.usaha.length;

// ---------------------------------------------------------------- PPh 23
type JenisPph23 = 'jasa' | 'sewa' | 'royalti';
const SEWA_HARTA = ['alat berat ekskavator', 'forklift', 'genset 500 kVA', 'truk tronton', 'mesin fotokopi digital', 'crane mobil'];
const ROYALTI = ['penggunaan merek dagang', 'hak cipta perangkat lunak akuntansi', 'resep dan formula produk', 'hak siar konten pelatihan'];
const KONDISI_23: Record<string, { jenis: JenisPph23; npwp: boolean; ppn: boolean }> = {
  'jasa-npwp': { jenis: 'jasa', npwp: true, ppn: false },
  'jasa-tanpa-npwp': { jenis: 'jasa', npwp: false, ppn: false },
  'jasa-tagihan-ppn': { jenis: 'jasa', npwp: true, ppn: true },
  'sewa-npwp': { jenis: 'sewa', npwp: true, ppn: false },
  'royalti-npwp': { jenis: 'royalti', npwp: true, ppn: false },
  'royalti-tanpa-npwp': { jenis: 'royalti', npwp: false, ppn: false },
};
function hitung23(p: Record<string, string | number | boolean>, ctx: KonteksModel) {
  const tgl = String(p.tanggal);
  const dasarTarif = param(ctx, p.jenis === 'royalti' ? 'pph23.tarifModal' : 'pph23.tarifJasaSewa', tgl);
  const tarif = p.npwp ? dasarTarif : dasarTarif * (1 + param(ctx, 'pph23.kenaikanTanpaNpwp', tgl));
  return { dasarTarif, tarif, pph: Math.round(Number(p.bruto) * tarif) };
}
export const pph23: ModelSoal = {
  id: 'pph23', nama: 'PPh 23 jasa, sewa, royalti', kode: 'PP', subtema: 'PPh Pasal 22 & PPh Pasal 23', tingkat: 'A',
  ringkas: 'Tarif 2%/15% dari bruto tanpa PPN; tanpa NPWP tarif 100% lebih tinggi.',
  kondisi: Object.keys(KONDISI_23),
  kesulitan: KESULITAN({ 'jasa-npwp': 'mudah', 'sewa-npwp': 'mudah', 'royalti-npwp': 'mudah', 'jasa-tanpa-npwp': 'sedang', 'royalti-tanpa-npwp': 'sedang', 'jasa-tagihan-ppn': 'sedang' }),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitung23(p, ctx).pph),
  buat(r: Rng, ctx: KonteksModel, kondisi = r.pick(Object.keys(KONDISI_23))): HasilModel {
    const k = KONDISI_23[kondisi];
    const kt = konteksUsaha(r, ctx);
    const t = bulanTransaksi(r, ctx);
    const pemotong = namaBadan(r, ctx, 'PT');
    const penerima = namaBadan(r, ctx, k.jenis === 'royalti' ? 'PT' : 'CV', [pemotong]);
    const bruto = kelipatan(r, 20_000_000, 480_000_000, 1_000_000);
    const params = { kondisi, jenis: k.jenis, npwp: k.npwp, bruto, tanggal: t.iso, ppn: k.ppn };
    const h = hitung23(params, ctx);
    const ppnTarif = param(ctx, 'ppn.tarif', t.iso);
    const [pemb, peny] = paramRaw(ctx, 'ppn.dppNonMewah', t.iso).nilai as number[];
    const ppn = Math.round(bruto * (pemb / peny) * ppnTarif);
    const objek = k.jenis === 'jasa' ? kt.usaha.jasa! : k.jenis === 'sewa' ? 'sewa ' + r.pick(SEWA_HARTA) : 'royalti atas ' + r.pick(ROYALTI);
    const jenisObjek = k.jenis === 'royalti' ? 'royalti (penghasilan modal)' : k.jenis === 'sewa' ? 'sewa harta selain tanah/bangunan' : 'jasa lain menurut PMK 141/2015';
    const statusPenerima = k.npwp ? 'Wajib Pajak badan dalam negeri yang memiliki NPWP' : 'Wajib Pajak badan dalam negeri yang belum memiliki NPWP';
    const nilaiTeks = k.ppn ? 'Tagihan ' + penerima + ' sebesar ' + rupiah(bruto + ppn) + ' sudah termasuk PPN ' + rupiah(ppn) + '.' : 'Nilai ' + (k.jenis === 'royalti' ? 'royalti' : k.jenis === 'sewa' ? 'sewa' : 'jasa') + ' ' + rupiah(bruto) + ' (belum termasuk PPN).';
    const soal = pemotong + ', ' + kt.usaha.jenis + ' di ' + kt.kota + ', pada ' + t.teks + ' membayar ' + objek + ' kepada ' + penerima + ', ' + statusPenerima + '. ' + nilaiTeks + ' PPh Pasal 23 yang wajib dipotong ' + pemotong + ' adalah ...';
    const tarifLain = param(ctx, k.jenis === 'royalti' ? 'pph23.tarifJasaSewa' : 'pph23.tarifModal', t.iso) * (k.npwp ? 1 : 2);
    const kandidat: Kandidat[] = [
      { nilai: Math.round(bruto * tarifLain), alasan: 'Memakai tarif ' + persen(tarifLain) + '. ' + (k.jenis === 'royalti' ? 'Royalti termasuk penghasilan modal yang dipotong 15%, bukan 2% untuk jasa/sewa.' : 'Tarif 15% hanya untuk dividen, bunga, royalti, dan hadiah; ' + (k.jenis === 'sewa' ? 'sewa harta selain tanah/bangunan' : 'jasa') + ' dipotong 2%.'), penyebab: 'tertukar_aturan' },
      { nilai: Math.round(bruto * 0.2), alasan: '20% adalah tarif PPh Pasal 26 untuk penerima luar negeri; penerima di sini Wajib Pajak dalam negeri.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round((bruto + (k.ppn ? ppn : Math.round(bruto * 0.11))) * h.tarif), alasan: 'Menghitung dari jumlah yang termasuk PPN. Dasar PPh 23 adalah jumlah bruto tanpa PPN.', penyebab: 'salah_tarif_dpp' },
    ];
    if (k.npwp) kandidat.push({ nilai: Math.round(bruto * h.dasarTarif * 2), alasan: 'Menaikkan tarif 100%. Kenaikan itu hanya untuk penerima yang tidak memiliki NPWP; ' + penerima + ' memiliki NPWP.', penyebab: 'lupa_syarat' });
    else kandidat.push({ nilai: Math.round(bruto * h.dasarTarif), alasan: 'Lupa kenaikan tarif 100% bagi penerima yang tidak memiliki NPWP (UU PPh Pasal 23 ayat (1a)).', penyebab: 'lupa_syarat' });
    if (k.jenis === 'sewa') kandidat.push({ nilai: Math.round(bruto * 0.1), alasan: 'Tarif 10% final berlaku untuk sewa tanah dan/atau bangunan (PPh 4 ayat (2)), bukan sewa ' + objek.replace('sewa ', '') + '.', penyebab: 'tertukar_aturan' });
    // Pengecoh bernilai lebih kecil dari kunci, supaya posisi kunci setelah opsi diurutkan tidak mudah ditebak.
    kandidat.push(
      { nilai: Math.round(bruto * 0.5 * h.tarif), alasan: 'Memakai 50% dari bruto sebagai dasar. DPP 50% hanya untuk PPh 21 bukan pegawai; PPh 23 dihitung dari jumlah bruto.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(bruto * (pemb / peny) * h.tarif), alasan: 'Memakai DPP nilai lain 11/12. DPP nilai lain hanya untuk PPN; PPh 23 dihitung dari jumlah bruto.', penyebab: 'salah_tarif_dpp' },
    );
    const langkah = [
      'Objek: ' + objek + ' termasuk ' + jenisObjek + ', dipotong PPh 23 ' + persen(h.dasarTarif) + ' dari jumlah bruto.',
      ...(k.ppn ? ['Jumlah bruto tidak termasuk PPN: ' + rupiah(bruto + ppn) + ' − ' + rupiah(ppn) + ' = ' + rupiah(bruto) + '.'] : []),
      ...(!k.npwp ? ['Penerima tidak memiliki NPWP, sehingga tarifnya 100% lebih tinggi: ' + persen(h.dasarTarif) + ' × 2 = ' + persen(h.tarif) + '.'] : []),
      'PPh 23 = ' + persen(h.tarif) + ' × ' + rupiah(bruto) + ' = ' + rupiah(h.pph) + '.',
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pph23.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'PPh 23 atas ' + jenisObjek + (k.npwp ? '' : ' tanpa NPWP') + (k.ppn ? ', tagihan termasuk PPN' : ''),
      soal, inti: 'PPh 23 atas ' + objek + ' = ' + persen(h.tarif) + ' × ' + rupiah(bruto) + ' = ' + rupiah(h.pph) + '.', langkah,
      dasarHukum: [dasar(ctx, k.jenis === 'royalti' ? 'pph23.tarifModal' : 'pph23.tarifJasaSewa', t.iso), ...(!k.npwp ? [dasar(ctx, 'pph23.kenaikanTanpaNpwp', t.iso)] : [])],
      ruleIds: [k.jenis === 'royalti' ? 'R-PP-22' : 'R-PP-23', ...(!k.npwp ? ['R-PP-25'] : [])],
      poinIngat: 'Jasa dan sewa harta selain tanah/bangunan 2%; dividen, bunga, royalti, hadiah 15%; dihitung dari bruto tanpa PPN; tanpa NPWP tarif dua kali lipat.',
    }, r, h.pph, kandidat);
  },
};

// ---------------------------------------------------------------- PPh 4(2) sewa tanah/bangunan
const PROPERTI = ['satu unit ruko tiga lantai', 'gudang seluas 800 m²', 'satu lantai gedung perkantoran', 'lahan parkir dan bangunan kantor cabang', 'rumah tinggal untuk mes karyawan'];
const KONDISI_42: Record<string, { tahun: number; service: boolean }> = {
  'sewa-setahun': { tahun: 1, service: false },
  'sewa-dimuka-multi-tahun': { tahun: 3, service: false },
  'sewa-service-charge': { tahun: 1, service: true },
};
const hitung42 = (p: Record<string, string | number | boolean>, ctx: KonteksModel) => {
  const tarif = param(ctx, 'pph42.sewaTanahBangunan', String(p.tanggal));
  const bruto = Number(p.sewaPerTahun) * Number(p.tahun) + Number(p.service);
  return { tarif, bruto, pph: Math.round(bruto * tarif) };
};
export const pph42Sewa: ModelSoal = {
  id: 'pph42-sewa', nama: 'PPh 4(2) sewa tanah/bangunan', kode: 'PP', subtema: 'PPh final Pasal 4 ayat (2)', tingkat: 'A',
  ringkas: '10% final dari seluruh bruto sewa, termasuk service charge dan pembayaran di muka beberapa tahun.',
  kondisi: Object.keys(KONDISI_42),
  kesulitan: KESULITAN({ 'sewa-setahun': 'mudah', 'sewa-dimuka-multi-tahun': 'sedang', 'sewa-service-charge': 'sedang' }),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitung42(p, ctx).pph),
  buat(r, ctx, kondisi = r.pick(Object.keys(KONDISI_42))) {
    const k = KONDISI_42[kondisi];
    const kt = konteksUsaha(r, ctx);
    const t = bulanTransaksi(r, ctx);
    const penyewa = namaBadan(r, ctx, 'PT');
    const pemilik = r.next() < 0.5 ? namaOrang(r, ctx) : namaBadan(r, ctx, 'CV', [penyewa]);
    const sewaPerTahun = kelipatan(r, 60_000_000, 600_000_000, 5_000_000);
    const tahun = k.tahun === 1 ? 1 : r.int(2, 3);
    const service = k.service ? kelipatan(r, 12_000_000, 120_000_000, 1_000_000) : 0;
    const params = { kondisi, sewaPerTahun, tahun, service, tanggal: t.iso };
    const h = hitung42(params, ctx);
    const properti = r.pick(PROPERTI);
    const soal = penyewa + ' (' + kt.usaha.jenis + ') menyewa ' + properti + ' di ' + kt.kota + ' milik ' + pemilik + ' untuk ' + tahun + ' tahun. Pada ' + t.teks + ' ' + penyewa + ' membayar sekaligus sewa ' + rupiah(sewaPerTahun) + ' per tahun untuk ' + tahun + ' tahun'
      + (k.service ? ' serta biaya pemeliharaan dan keamanan (service charge) ' + rupiah(service) + ' yang ditagih ' + pemilik + ' dalam perjanjian terpisah' : '') + '. Abaikan PPN. PPh yang wajib dipotong ' + penyewa + ' atas pembayaran tersebut adalah ...';
    const sewaSaja = sewaPerTahun * tahun;
    const kandidat: Kandidat[] = [
      { nilai: Math.round(h.bruto * 0.02), alasan: 'Memakai tarif PPh 23 2%. Sewa tanah dan/atau bangunan dikenai PPh final Pasal 4 ayat (2) 10%.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(h.bruto * 1.11 * h.tarif), alasan: 'Menambahkan PPN ke dasar pemotongan; dasar PPh adalah jumlah bruto nilai persewaan tanpa PPN.', penyebab: 'salah_tarif_dpp' },
      { nilai: Math.round(h.bruto * 0.15), alasan: '15% adalah tarif PPh 23 atas dividen/bunga/royalti, bukan sewa bangunan.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round((h.bruto / 1.11) * h.tarif), alasan: 'Menganggap nilai sewa sudah termasuk PPN lalu mengeluarkannya; nilai sewa dalam soal belum termasuk PPN.', penyebab: 'salah_tarif_dpp' },
      { nilai: Math.round(h.bruto * 0.025), alasan: '2,5% adalah tarif PPh final pengalihan hak atas tanah/bangunan, bukan sewa.', penyebab: 'tertukar_aturan' },
    ];
    if (tahun > 1) kandidat.push({ nilai: Math.round((sewaPerTahun + service) * h.tarif), alasan: 'Hanya menghitung sewa tahun pertama. PPh final terutang saat pembayaran atas seluruh jumlah yang dibayar, termasuk sewa tahun-tahun berikutnya.', penyebab: 'salah_periode' });
    if (k.service) kandidat.push({ nilai: Math.round(sewaSaja * h.tarif), alasan: 'Tidak memasukkan service charge. Menurut PP 34/2017, biaya pemeliharaan, keamanan, dan service charge termasuk bruto sewa walaupun perjanjiannya terpisah.', penyebab: 'lupa_syarat' });
    const langkah = [
      'Sewa ' + properti + ' adalah sewa tanah dan/atau bangunan: PPh final Pasal 4 ayat (2) ' + persen(h.tarif) + ' dari jumlah bruto, dipotong penyewa badan.',
      'Jumlah bruto = ' + rupiah(sewaPerTahun) + ' × ' + tahun + (k.service ? ' + ' + rupiah(service) + ' (service charge)' : '') + ' = ' + rupiah(h.bruto) + '.',
      'PPh final = ' + persen(h.tarif) + ' × ' + rupiah(h.bruto) + ' = ' + rupiah(h.pph) + '.',
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pph42Sewa.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: 'PPh final sewa bangunan' + (tahun > 1 ? ' dibayar di muka ' + tahun + ' tahun' : '') + (k.service ? ' dengan service charge' : ''),
      soal, inti: 'PPh final sewa = ' + persen(h.tarif) + ' × ' + rupiah(h.bruto) + ' = ' + rupiah(h.pph) + ', atas seluruh jumlah yang dibayar.', langkah,
      dasarHukum: [dasar(ctx, 'pph42.sewaTanahBangunan', t.iso)], ruleIds: ['R-PP-26'],
      poinIngat: 'Sewa tanah/bangunan: 10% final × seluruh bruto yang dibayar (termasuk service charge dan sewa beberapa tahun di muka).',
    }, r, h.pph, kandidat);
  },
};

// ---------------------------------------------------------------- PPh 21 bukan pegawai
const PROFESI = ['dokter spesialis mitra yang bukan pegawai', 'konsultan hukum perorangan', 'penerjemah lepas', 'desainer grafis lepas', 'arsitek perorangan', 'penceramah pada acara internal'];
const KONDISI_21: Record<string, { npwp: boolean; lapis: 1 | 2 }> = {
  'satu-lapisan': { npwp: true, lapis: 1 },
  'dua-lapisan': { npwp: true, lapis: 2 },
  'tanpa-npwp': { npwp: false, lapis: 1 },
};
const hitung21 = (p: Record<string, string | number | boolean>, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const dpp = Math.round(Number(p.bruto) * param(ctx, 'pph21.dppBukanPegawai', tgl));
  const dasarPph = pph17(dpp, lapisan17(ctx, tgl));
  const naik = p.npwp ? 1 : 1 + param(ctx, 'pph21.kenaikanTanpaNpwp', tgl);
  return { dpp, dasar: dasarPph, pph: Math.round(dasarPph.total * naik), naik };
};
export const pph21BukanPegawai: ModelSoal = {
  id: 'pph21-bukan-pegawai', nama: 'PPh 21 bukan pegawai', kode: 'PP', subtema: 'PPh 21 selain pegawai tetap & PPh 21 final', tingkat: 'A',
  ringkas: 'Tarif Pasal 17 × 50% bruto per pembayaran, tanpa kumulasi; tanpa NPWP 20% lebih tinggi.',
  kondisi: Object.keys(KONDISI_21),
  kesulitan: KESULITAN({ 'satu-lapisan': 'mudah', 'dua-lapisan': 'sedang', 'tanpa-npwp': 'sedang' }),
  jumlahKonteks: () => PROFESI.length,
  hitungUlang: (p, ctx) => rupiah(hitung21(p, ctx).pph),
  buat(r, ctx, kondisi = r.pick(Object.keys(KONDISI_21))) {
    const k = KONDISI_21[kondisi];
    const t = bulanTransaksi(r, ctx);
    const ip = r.int(0, PROFESI.length - 1);
    const pemberi = namaBadan(r, ctx, 'PT');
    const orang = namaOrang(r, ctx);
    const batas1 = lapisan17(ctx, t.iso)[0][0]!;
    const bruto = k.lapis === 1 ? kelipatan(r, 10_000_000, 2 * batas1 - 2_000_000, 1_000_000) : kelipatan(r, 2 * batas1 + 20_000_000, 400_000_000, 1_000_000);
    const params = { kondisi, bruto, npwp: k.npwp, tanggal: t.iso, profesi: ip };
    const h = hitung21(params, ctx);
    const soal = orang + ', ' + PROFESI[ip] + ' ' + pemberi + ', menerima imbalan jasa ' + rupiah(bruto) + ' pada ' + t.teks + '. ' + orang + (k.npwp ? ' memiliki NPWP (NIK tervalidasi)' : ' tidak memiliki NPWP maupun NIK yang dapat dipakai sebagai NPWP') + ' dan tidak menerima pembayaran lain dari ' + pemberi + ' pada bulan itu. PPh Pasal 21 yang wajib dipotong ' + pemberi + ' adalah ...';
    const lapis = lapisan17(ctx, t.iso);
    const kandidat: Kandidat[] = [
      { nilai: Math.round(pph17(bruto, lapis).total * h.naik), alasan: 'Menerapkan tarif Pasal 17 pada seluruh bruto. Bagi bukan pegawai, dasar pemotongannya 50% dari bruto.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(bruto * 0.02), alasan: '2% adalah tarif PPh 23 untuk jasa yang diterima Wajib Pajak badan; imbalan kepada orang pribadi bukan pegawai dipotong PPh 21.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(h.dpp * lapis[lapis.length - 1][1] * h.naik), alasan: 'Memakai tarif tertinggi untuk seluruh DPP. Tarif Pasal 17 berlapis.', penyebab: 'salah_hitung' },
      { nilai: Math.round(pph17(Math.round(h.dpp * 0.95), lapis).total * h.naik), alasan: 'Mengurangkan biaya jabatan 5%. Biaya jabatan hanya untuk pegawai tetap, bukan bukan pegawai.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(pph17(Math.round(h.dpp * 0.5), lapis).total * h.naik), alasan: 'Mengalikan 50% dua kali. DPP bukan pegawai cukup 50% × bruto.', penyebab: 'salah_hitung' },
    ];
    if (k.npwp) kandidat.push({ nilai: Math.round(h.dasar.total * 1.2), alasan: 'Menaikkan tarif 20%. Kenaikan itu hanya untuk penerima tanpa NPWP.', penyebab: 'lupa_syarat' });
    else kandidat.push({ nilai: h.dasar.total, alasan: 'Lupa kenaikan 20% bagi penerima tanpa NPWP (UU PPh Pasal 21 ayat (5a)).', penyebab: 'lupa_syarat' });
    if (k.lapis === 2) {
      kandidat.push({ nilai: Math.round(h.dpp * lapis[0][1] * h.naik), alasan: 'Memakai tarif lapisan pertama untuk seluruh DPP; bagian DPP di atas ' + rupiah(batas1) + ' dikenai tarif lapisan berikutnya.', penyebab: 'salah_hitung' });
      const lama = lapisan17Lama(ctx);
      if (lama) kandidat.push({ nilai: Math.round(pph17(h.dpp, lama).total * h.naik), alasan: 'Memakai lapisan tarif lama (lapisan pertama Rp50 juta). Sejak UU HPP lapisan pertama Rp60 juta.', penyebab: 'salah_periode' });
    }
    const langkah = [
      PROFESI[ip][0].toUpperCase() + PROFESI[ip].slice(1) + ' adalah bukan pegawai: PPh 21 = tarif Pasal 17 × 50% × bruto, per pembayaran tanpa kumulasi.',
      'DPP = 50% × ' + rupiah(bruto) + ' = ' + rupiah(h.dpp) + '.',
      'Tarif Pasal 17: ' + h.dasar.rinci.map((x) => persen(x.tarif) + ' × ' + rupiah(x.sampai - x.dari) + ' = ' + rupiah(x.pajak)).join('; ') + (h.dasar.rinci.length > 1 ? '; jumlah ' + rupiah(h.dasar.total) : '') + '.',
      ...(!k.npwp ? ['Tanpa NPWP: 120% × ' + rupiah(h.dasar.total) + ' = ' + rupiah(h.pph) + '.'] : []),
    ];
    return hasilAngka({
      kondisi, konteks: 'p' + ip, params, kesulitan: pph21BukanPegawai.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: 'PPh 21 bukan pegawai' + (k.lapis === 2 ? ' (dua lapisan tarif)' : '') + (k.npwp ? '' : ' tanpa NPWP'),
      soal, inti: 'PPh 21 bukan pegawai = tarif Pasal 17 × 50% × ' + rupiah(bruto) + ' = ' + rupiah(h.pph) + '.', langkah,
      dasarHukum: [dasar(ctx, 'pph21.dppBukanPegawai', t.iso), dasar(ctx, 'pph17.lapisan', t.iso), ...(!k.npwp ? [dasar(ctx, 'pph21.kenaikanTanpaNpwp', t.iso)] : [])],
      ruleIds: ['R-PP-11', 'R-OP-08', ...(!k.npwp ? ['R-PP-25'] : [])],
      poinIngat: 'Bukan pegawai: tarif Pasal 17 × 50% bruto per pembayaran (tanpa PTKP dan biaya jabatan); tanpa NPWP +20%.',
    }, r, h.pph, kandidat);
  },
};

// ---------------------------------------------------------------- PPh 26 dan P3B
const JENIS_26: Record<string, string> = { dividen: 'dividen', bunga: 'bunga pinjaman', royalti: 'royalti atas penggunaan paten' };
const KONDISI_26: Record<string, { jenis: string; dgt: boolean }> = {
  'dividen-dgt': { jenis: 'dividen', dgt: true }, 'bunga-dgt': { jenis: 'bunga', dgt: true }, 'royalti-dgt': { jenis: 'royalti', dgt: true },
  'royalti-tanpa-dgt': { jenis: 'royalti', dgt: false }, 'dividen-tanpa-dgt': { jenis: 'dividen', dgt: false },
};
const hitung26 = (p: Record<string, string | number | boolean>, ctx: KonteksModel) => {
  const umum = param(ctx, 'pph26.tarif', String(p.tanggal));
  const tarif = p.dgt ? Math.min(umum, Number(p.tarifP3b)) : umum;
  return { umum, tarif, pph: Math.round(Number(p.bruto) * tarif) };
};
export const pph26P3b: ModelSoal = {
  id: 'pph26-p3b', nama: 'PPh 26 dan tarif P3B', kode: 'PP', subtema: 'PPh Pasal 26 & BUT', tingkat: 'C',
  ringkas: '20% bruto; tarif P3B hanya bila Formulir DGT memenuhi syarat sebelum pembayaran.',
  kondisi: Object.keys(KONDISI_26),
  kesulitan: (k) => (KONDISI_26[k]?.dgt ? 'sedang' : 'sulit'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitung26(p, ctx).pph),
  buat(r, ctx, kondisi = r.pick(Object.keys(KONDISI_26))) {
    const k = KONDISI_26[kondisi];
    const kt = konteksUsaha(r, ctx);
    const t = bulanTransaksi(r, ctx);
    const pembayar = namaBadan(r, ctx, 'PT');
    const penerima = r.pick(ctx.data.konteks.namaPt) + ' ' + r.pick(['Holdings Ltd', 'International Pte Ltd', 'Global BV', 'Capital Inc']);
    const tarifP3b = r.pick([0.05, 0.1, 0.15]);
    const bruto = kelipatan(r, 100_000_000, 4_000_000_000, 10_000_000);
    const params = { kondisi, jenis: k.jenis, dgt: k.dgt, tarifP3b, bruto, tanggal: t.iso };
    const h = hitung26(params, ctx);
    const soal = pembayar + ', ' + kt.usaha.jenis + ' di ' + kt.kota + ', pada ' + t.teks + ' membayar ' + JENIS_26[k.jenis] + ' sebesar ' + rupiah(bruto) + ' kepada ' + penerima + ', badan yang berkedudukan di negara mitra P3B dan tidak mempunyai BUT di Indonesia. P3B antara Indonesia dan negara tersebut membatasi tarif atas ' + JENIS_26[k.jenis] + ' paling tinggi ' + persen(tarifP3b) + '. '
      + (k.dgt ? penerima + ' telah menyampaikan Formulir DGT yang memenuhi persyaratan formal dan materiil sebelum pembayaran.' : 'Sampai saat pembayaran, ' + penerima + ' tidak menyampaikan Formulir DGT.') + ' PPh Pasal 26 yang wajib dipotong ' + pembayar + ' adalah ...';
    const kandidat: Kandidat[] = [
      k.dgt
        ? { nilai: Math.round(bruto * h.umum), alasan: 'Memakai tarif umum ' + persen(h.umum) + '. Formulir DGT yang memenuhi syarat sudah diterima, sehingga tarif P3B ' + persen(tarifP3b) + ' dapat diterapkan.', penyebab: 'lupa_syarat' }
        : { nilai: Math.round(bruto * tarifP3b), alasan: 'Menerapkan tarif P3B tanpa Formulir DGT. Tanpa DGT yang memenuhi syarat, pemotong wajib memakai tarif UU PPh ' + persen(h.umum) + '.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(bruto * 0.15), alasan: '15% adalah tarif PPh 23 untuk penerima dalam negeri; penerima di sini Wajib Pajak luar negeri.', penyebab: 'tertukar_aturan' },
      { nilai: 0, alasan: 'Penghasilan ' + JENIS_26[k.jenis] + ' dari Indonesia kepada WP luar negeri tetap objek PPh 26 walaupun penerima tidak mempunyai BUT.', penyebab: 'belum_tahu_aturan' },
      { nilai: Math.round(bruto * h.tarif * 2), alasan: 'Menggandakan tarif. Kenaikan 100% tanpa NPWP berlaku untuk PPh 23, bukan PPh 26.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(bruto * h.tarif * 0.5), alasan: 'Menerapkan tarif atas 50% bruto. PPh 26 atas ' + JENIS_26[k.jenis] + ' dihitung dari jumlah bruto; perkiraan neto hanya untuk penghasilan tertentu seperti penjualan saham atau premi asuransi.', penyebab: 'tertukar_aturan' },
    ];
    const langkah = [
      JENIS_26[k.jenis][0].toUpperCase() + JENIS_26[k.jenis].slice(1) + ' kepada WP luar negeri tanpa BUT adalah objek PPh 26 dengan tarif ' + persen(h.umum) + ' dari bruto (final).',
      k.dgt ? 'Formulir DGT memenuhi syarat dan disampaikan sebelum pembayaran, sehingga tarif P3B ' + persen(tarifP3b) + ' dapat diterapkan.' : 'Tanpa Formulir DGT, ketentuan P3B tidak dapat diterapkan; berlaku tarif UU PPh ' + persen(h.umum) + '.',
      'PPh 26 = ' + persen(h.tarif) + ' × ' + rupiah(bruto) + ' = ' + rupiah(h.pph) + '.',
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pph26P3b.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: 'PPh 26 atas ' + JENIS_26[k.jenis] + (k.dgt ? ' dengan Formulir DGT' : ' tanpa Formulir DGT'),
      soal, inti: 'PPh 26 = ' + persen(h.tarif) + ' × ' + rupiah(bruto) + ' = ' + rupiah(h.pph) + (k.dgt ? ' (tarif P3B, DGT memenuhi syarat).' : ' (tarif UU karena tidak ada DGT).'), langkah,
      dasarHukum: [dasar(ctx, 'pph26.tarif', t.iso), 'UU PPh Pasal 32A', 'PMK 112/2025 (Formulir DGT)'], ruleIds: ['R-PP-29', 'R-PP-30'],
      poinIngat: 'PPh 26: 20% bruto; tarif P3B hanya bila Formulir DGT yang memenuhi syarat diterima sebelum pembayaran.',
    }, r, h.pph, kandidat);
  },
};
