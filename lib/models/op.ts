// Model soal baru materi OP (PPh Orang Pribadi).
import { angka, namaBulan, persen, rupiah } from '../util';
import { bulatBawahRibu, dasar, hasilAngka, kelipatan, konteksUsaha, lapisan17, lapisan17Lama, namaOrang, param, paramRaw, pph17, type Kandidat } from './bantu';
import type { KonteksModel, ModelSoal } from './types';

// ---------------------------------------------------------------- PPh terutang OP
interface Ptkp { diri: number; kawin: number; tanggungan: number; maksTanggungan: number }
const STATUS = [
  { kode: 'TK/0', kawin: false, anak: 0, teks: 'belum kawin dan tidak mempunyai tanggungan' },
  { kode: 'TK/1', kawin: false, anak: 1, teks: 'belum kawin dan menanggung sepenuhnya seorang ibu kandung' },
  { kode: 'K/0', kawin: true, anak: 0, teks: 'kawin, istrinya tidak berpenghasilan, belum mempunyai anak' },
  { kode: 'K/1', kawin: true, anak: 1, teks: 'kawin dengan 1 anak yang menjadi tanggungan sepenuhnya; istrinya tidak berpenghasilan' },
  { kode: 'K/2', kawin: true, anak: 2, teks: 'kawin dengan 2 anak yang menjadi tanggungan sepenuhnya; istrinya tidak berpenghasilan' },
  { kode: 'K/3', kawin: true, anak: 3, teks: 'kawin dengan 4 anak kandung yang semuanya menjadi tanggungan sepenuhnya; istrinya tidak berpenghasilan' },
];
const KONDISI_OP: Record<string, { lapis: number; kredit: boolean }> = {
  'satu-lapisan': { lapis: 1, kredit: false }, 'dua-lapisan': { lapis: 2, kredit: false }, 'tiga-lapisan': { lapis: 3, kredit: false }, 'kredit-pph29': { lapis: 2, kredit: true },
};
const ptkpDari = (p: Ptkp, kawin: boolean, anak: number) => p.diri + (kawin ? p.kawin : 0) + Math.min(anak, p.maksTanggungan) * p.tanggungan;
const hitungOp = (pr: Record<string, string | number | boolean>, ctx: KonteksModel) => {
  const tgl = String(pr.tanggal);
  const s = STATUS[Number(pr.status)];
  const ptkp = ptkpDari(paramRaw(ctx, 'ptkp', tgl).nilai as unknown as Ptkp, s.kawin, s.anak);
  const pkp = bulatBawahRibu(Number(pr.neto) - ptkp);
  const pajak = pph17(pkp, lapisan17(ctx, tgl));
  return { ptkp, pkp, pajak, hasil: pajak.total - Number(pr.kredit) };
};
export const pphOp: ModelSoal = {
  id: 'pph-op-terutang', nama: 'PPh terutang orang pribadi', kode: 'OP', subtema: 'PTKP, tarif & PPh terutang', tingkat: 'A',
  ringkas: 'Neto − PTKP (status awal tahun) = PKP dibulatkan ke bawah ribuan × tarif Pasal 17 berlapis; dikurangi kredit pajak untuk PPh 29.',
  kondisi: Object.keys(KONDISI_OP),
  kesulitan: (k) => (k === 'satu-lapisan' ? 'mudah' : k === 'kredit-pph29' ? 'sulit' : 'sedang'),
  jumlahKonteks: () => STATUS.length,
  hitungUlang: (p, ctx) => rupiah(hitungOp(p, ctx).hasil),
  buat(r, ctx, kondisi = r.pick(Object.keys(KONDISI_OP))) {
    const k = KONDISI_OP[kondisi];
    const kt = konteksUsaha(r, ctx);
    const tahunPajak = Number(ctx.tanggalAcuan.slice(0, 4)) - 1;
    const tgl = tahunPajak + '-12-31';
    const lap = lapisan17(ctx, tgl);
    const is = r.int(0, STATUS.length - 1);
    const s = STATUS[is];
    const ptkp = ptkpDari(paramRaw(ctx, 'ptkp', tgl).nilai as unknown as Ptkp, s.kawin, s.anak);
    const [b1, b2, b3] = [lap[0][0]!, lap[1][0]!, lap[2][0]!];
    const pkpTarget = k.lapis === 1 ? kelipatan(r, 15_000_000, b1 - 1_000_000, 1_000_000) : k.lapis === 2 ? kelipatan(r, b1 + 20_000_000, b2 - 10_000_000, 1_000_000) : kelipatan(r, b2 + 20_000_000, b3 - 10_000_000, 1_000_000);
    const neto = pkpTarget + ptkp + r.int(1, 999) * (r.next() < 0.5 ? 1 : 0) + kelipatan(r, 0, 900_000, 1000);
    const orang = namaOrang(r, ctx);
    const pph25 = k.kredit ? kelipatan(r, 1_000_000, 6_000_000, 100_000) : 0;
    const pph23 = k.kredit ? kelipatan(r, 500_000, 3_000_000, 50_000) : 0;
    const params = { kondisi, status: is, neto, kredit: pph25 + pph23, tanggal: tgl };
    const h = hitungOp(params, ctx);
    const soal = orang + ', ' + s.teks + ' sejak sebelum awal Tahun Pajak ' + tahunPajak + ', menjalankan usaha ' + kt.usaha.jenis + ' di ' + kt.kota + ' dengan pembukuan. Penghasilan neto usahanya (tidak final) Tahun Pajak ' + tahunPajak + ' ' + rupiah(neto) + '; tidak ada penghasilan lain, zakat, atau kompensasi kerugian.'
      + (k.kredit ? ' Selama ' + tahunPajak + ' ia telah membayar angsuran PPh Pasal 25 ' + rupiah(pph25) + ' dan dipotong PPh Pasal 23 ' + rupiah(pph23) + ' (tidak final). PPh Pasal 29 yang harus dibayar adalah ...' : ' PPh terutang ' + orang + ' Tahun Pajak ' + tahunPajak + ' adalah ...');
    const ptkpSalah = ptkpDari(paramRaw(ctx, 'ptkp', tgl).nilai as unknown as Ptkp, false, 0);
    const salahPtkp = s.kode === 'TK/0'
      ? pph17(bulatBawahRibu(neto - ptkpDari(paramRaw(ctx, 'ptkp', tgl).nilai as unknown as Ptkp, true, 0)), lap).total
      : pph17(bulatBawahRibu(neto - ptkpSalah), lap).total;
    const kandidat: Kandidat[] = [
      { nilai: salahPtkp - params.kredit, alasan: s.kode === 'TK/0' ? 'Memakai PTKP K/0; status ' + orang + ' TK/0.' : 'Memakai PTKP TK/0. Status ' + s.kode + ' menambah PTKP untuk kawin dan/atau tanggungan.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(h.pkp * lap[Math.max(0, h.pajak.rinci.length - 1)][1]) - params.kredit, alasan: 'Mengalikan seluruh PKP dengan tarif lapisan tertinggi yang dicapai. Tarif Pasal 17 berlapis.', penyebab: 'salah_hitung' },
      { nilai: pph17(bulatBawahRibu(neto), lap).total - params.kredit, alasan: 'Tidak mengurangkan PTKP dari penghasilan neto.', penyebab: 'lupa_syarat' },
    ];
    const lama = lapisan17Lama(ctx);
    if (lama && k.lapis > 1) kandidat.push({ nilai: pph17(h.pkp, lama).total - params.kredit, alasan: 'Memakai lapisan tarif lama (lapisan pertama Rp50 juta). Sejak 2022 (UU HPP) lapisan pertama Rp60 juta.', penyebab: 'salah_periode' });
    if (k.kredit) kandidat.push({ nilai: h.pajak.total, alasan: 'Itu PPh terutang. PPh 29 = PPh terutang − kredit pajak (PPh 25 dan PPh 23 tidak final).', penyebab: 'lupa_syarat' });
    if (k.lapis === 1) kandidat.push({ nilai: Math.round(h.pkp * lap[1][1]), alasan: 'Memakai tarif 15%. PKP di bawah ' + rupiah(b1) + ' hanya dikenai lapisan pertama 5%.', penyebab: 'salah_tarif_dpp' });
    if (k.lapis > 1) kandidat.push({ nilai: Math.round(h.pkp * lap[0][1]) - params.kredit, alasan: 'Memakai tarif 5% untuk seluruh PKP; bagian PKP di atas ' + rupiah(b1) + ' dikenai tarif lapisan berikutnya.', penyebab: 'salah_hitung' });
    kandidat.push(
      { nilai: pph17(bulatBawahRibu(neto - h.ptkp - ptkpDari(paramRaw(ctx, 'ptkp', tgl).nilai as unknown as Ptkp, false, 0)), lap).total - params.kredit, alasan: 'Mengurangkan PTKP diri dua kali.', penyebab: 'salah_hitung' },
      { nilai: pph17(bulatBawahRibu(Math.max(0, neto - h.ptkp - 0.05 * neto)), lap).total - params.kredit, alasan: 'Mengurangkan biaya jabatan 5%. Biaya jabatan hanya untuk penghasilan pegawai, bukan penghasilan usaha.', penyebab: 'tertukar_aturan' },
    );
    const langkah = [
      'PTKP ' + s.kode + ' (keadaan awal tahun) = ' + rupiah(h.ptkp) + '.',
      'PKP = ' + rupiah(neto) + ' − ' + rupiah(h.ptkp) + ' = ' + rupiah(neto - h.ptkp) + ', dibulatkan ke bawah ribuan penuh = ' + rupiah(h.pkp) + '.',
      'Tarif Pasal 17: ' + h.pajak.rinci.map((x) => persen(x.tarif) + ' × ' + rupiah(x.sampai - x.dari) + ' = ' + rupiah(x.pajak)).join('; ') + '; PPh terutang ' + rupiah(h.pajak.total) + '.',
      ...(k.kredit ? ['PPh 29 = ' + rupiah(h.pajak.total) + ' − (' + rupiah(pph25) + ' + ' + rupiah(pph23) + ') = ' + rupiah(h.hasil) + '.'] : []),
    ];
    return hasilAngka({
      kondisi, konteks: 's' + is, params, kesulitan: pphOp.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: 'PPh terutang OP ' + s.kode + ' (' + k.lapis + ' lapisan tarif)' + (k.kredit ? ' dan PPh 29' : ''),
      soal, inti: 'PKP ' + rupiah(h.pkp) + ' (setelah PTKP ' + s.kode + ' ' + rupiah(h.ptkp) + ') × tarif berlapis = ' + rupiah(h.pajak.total) + (k.kredit ? '; dikurangi kredit pajak → PPh 29 ' + rupiah(h.hasil) : '') + '.', langkah,
      dasarHukum: [dasar(ctx, 'ptkp', tgl), dasar(ctx, 'pph17.lapisan', tgl), ...(k.kredit ? ['UU PPh Pasal 28 dan 29'] : [])], ruleIds: ['R-OP-07', 'R-OP-08', 'R-OP-09'],
      poinIngat: 'PTKP 54 jt + 4,5 jt kawin + 4,5 jt per tanggungan (maks 3); PKP dibulatkan ke bawah ribuan; lapisan 60 jt/250 jt/500 jt/5 M.',
    }, r, h.hasil, kandidat);
  },
};

// ---------------------------------------------------------------- PPh final UMKM 0,5%
const KONDISI_UMKM: Record<string, { posisi: 'melewati' | 'setelah' | 'belum'; badan: boolean }> = {
  'bulan-melewati': { posisi: 'melewati', badan: false },
  'setelah-melewati': { posisi: 'setelah', badan: false },
  'belum-melewati': { posisi: 'belum', badan: false },
  'perseroan-perorangan': { posisi: 'melewati', badan: true },
};
const USAHA_KECIL = ['warung makan', 'toko kelontong', 'usaha katering', 'bengkel sepeda motor', 'toko pakaian daring', 'usaha binatu (laundry)', 'kedai kopi', 'usaha fotokopi dan alat tulis', 'toko bahan kue', 'usaha sablon kaos'];
const hitungUmkm = (p: Record<string, string | number | boolean>, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const tarif = param(ctx, 'umkm.tarif', tgl);
  const bebas = p.badan ? 0 : param(ctx, 'umkm.bebasOp', tgl);
  const omzet = String(p.omzet).split(',').map(Number);
  const i = Number(p.bulanDitanya) - 1;
  const sebelum = omzet.slice(0, i).reduce((a, b) => a + b, 0);
  const sampai = sebelum + omzet[i];
  const kena = Math.max(0, sampai - Math.max(bebas, sebelum));
  return { tarif, bebas, sebelum, sampai, omzetBulan: omzet[i], kena, pph: Math.round(kena * tarif) };
};
export const umkm: ModelSoal = {
  id: 'pph-final-umkm', nama: 'PPh final UMKM 0,5%', kode: 'OP', subtema: 'PPh final UMKM (peredaran bruto tertentu)', tingkat: 'A',
  ringkas: '0,5% × omzet bulanan; bagi OP, omzet kumulatif sampai Rp500 juta setahun tidak dikenai PPh (tidak berlaku bagi perseroan perorangan).',
  kondisi: Object.keys(KONDISI_UMKM),
  kesulitan: (k) => (k === 'perseroan-perorangan' ? 'sulit' : k === 'bulan-melewati' ? 'sedang' : 'mudah'),
  jumlahKonteks: () => USAHA_KECIL.length,
  hitungUlang: (p, ctx) => rupiah(hitungUmkm(p, ctx).pph),
  buat(r, ctx, kondisi = r.pick(Object.keys(KONDISI_UMKM))) {
    const k = KONDISI_UMKM[kondisi];
    const iu = r.int(0, USAHA_KECIL.length - 1);
    const kt = { indeks: iu, usaha: { jenis: USAHA_KECIL[iu] }, kota: r.pick(ctx.data.konteks.kota) };
    const [ty, tm] = ctx.tanggalAcuan.split('-').map(Number);
    const tahun = tm >= 9 ? ty : ty - 1;
    const tgl = tahun + '-12-31';
    const bebas = param(ctx, 'umkm.bebasOp', tgl);
    // Susun omzet bulanan sehingga bulan yang ditanya berada pada posisi yang diminta terhadap batas Rp500 juta.
    let omzet: number[] = [], ditanya = 0;
    for (let coba = 0; coba < 200; coba++) {
      const n = r.int(5, 8);
      omzet = Array.from({ length: n }, () => kelipatan(r, 40_000_000, 160_000_000, 5_000_000));
      let kum = 0, lewat = -1;
      omzet.forEach((v, i) => { if (lewat < 0 && kum < bebas && kum + v > bebas) lewat = i; kum += v; });
      if (k.posisi === 'melewati' && lewat >= 0 && omzet.slice(0, lewat).reduce((a, b) => a + b, 0) < bebas) { ditanya = lewat; break; }
      if (k.posisi === 'setelah' && lewat >= 0 && lewat < n - 1) { ditanya = r.int(lewat + 1, n - 1); break; }
      // Bulan yang ditanya bukan Januari, supaya omzet kumulatif berbeda dari omzet bulan itu.
      if (k.posisi === 'belum' && (lewat >= 2 || lewat < 0)) { ditanya = r.int(1, (lewat < 0 ? n : lewat) - 1); break; }
    }
    const params = { kondisi, omzet: omzet.join(','), bulanDitanya: ditanya + 1, badan: k.badan, tanggal: tgl };
    const h = hitungUmkm(params, ctx);
    const orang = namaOrang(r, ctx);
    const pelaku = k.badan ? 'PT ' + orang.replace(/^(Tn\.|Ny\.) /, '') + ' Mandiri, perseroan perorangan yang didirikan ' + orang + ' tahun ' + (tahun - 1) + ',' : orang + ', Wajib Pajak orang pribadi,';
    const daftar = omzet.map((v, i) => namaBulan(i) + ' ' + rupiah(v)).join('; ');
    const soal = pelaku + ' menjalankan usaha ' + kt.usaha.jenis + ' di ' + kt.kota + ' dan memenuhi syarat PPh final 0,5% (peredaran bruto tahun sebelumnya di bawah Rp4,8 miliar). Peredaran bruto ' + tahun + ': ' + daftar + '. PPh final yang terutang untuk Masa ' + namaBulan(ditanya) + ' ' + tahun + ' adalah ...';
    const kandidat: Kandidat[] = [
      { nilai: Math.round(h.omzetBulan * h.tarif), alasan: k.badan ? 'Hasil ini benar untuk perseroan perorangan, tetapi angkanya tertukar dengan perhitungan lain.' : 'Mengenakan 0,5% atas seluruh omzet bulan itu; bagian omzet kumulatif sampai ' + rupiah(bebas) + ' bagi OP tidak dikenai PPh.', penyebab: 'lupa_syarat' },
      { nilai: 0, alasan: k.badan ? 'Batas omzet tidak kena pajak Rp500 juta hanya untuk orang pribadi, bukan perseroan perorangan.' : 'Menganggap omzet bulan ini belum dikenai PPh; omzet kumulatif sudah melewati ' + rupiah(bebas) + '.', penyebab: k.badan ? 'tertukar_aturan' : 'belum_tahu_aturan' },
      { nilai: Math.round(Math.max(0, h.sampai - bebas) * h.tarif), alasan: 'Mengenakan 0,5% atas seluruh kelebihan omzet kumulatif sejak Januari. PPh final dihitung per bulan atas omzet bulan itu yang belum dikenai.', penyebab: 'salah_hitung' },
      { nilai: Math.round(h.kena * 0.01), alasan: 'Tarif 1% (PP 46/2013) sudah diganti 0,5% sejak 1 Juli 2018.', penyebab: 'salah_periode' },
      { nilai: Math.round(h.sampai * h.tarif), alasan: 'Mengenakan 0,5% atas omzet kumulatif sejak Januari; PPh final dihitung dari omzet bulan bersangkutan.', penyebab: 'salah_hitung' },
      { nilai: Math.round(h.omzetBulan * 0.01), alasan: 'Memakai tarif 1% (PP 46/2013) atas seluruh omzet bulan itu; tarif kini 0,5% dan bagian omzet OP sampai ' + rupiah(bebas) + ' setahun tidak dikenai.', penyebab: 'salah_periode' },
      { nilai: Math.round(h.kena * h.tarif * 0.5), alasan: 'Membagi dua hasilnya; PPh final 0,5% dihitung penuh atas bagian omzet yang dikenai.', penyebab: 'salah_hitung' },
      { nilai: Math.round(h.sampai * 0.01), alasan: 'Memakai tarif lama 1% atas omzet kumulatif; tarif kini 0,5% atas omzet bulan bersangkutan yang melewati batas.', penyebab: 'salah_periode' },
    ].filter((x) => !(k.badan && x.nilai === Math.round(h.omzetBulan * h.tarif)));
    if (k.badan) kandidat.push({ nilai: Math.round(Math.max(0, h.sampai - Math.max(bebas, h.sebelum)) * h.tarif), alasan: 'Menerapkan batas Rp500 juta. Batas itu khusus orang pribadi; perseroan perorangan dikenai 0,5% atas seluruh omzet.', penyebab: 'tertukar_aturan' });
    const langkah = k.badan
      ? ['Perseroan perorangan memakai tarif 0,5% tetapi tidak mendapat bagian omzet Rp500 juta yang tidak dikenai PPh (khusus orang pribadi).', 'PPh final Masa ' + namaBulan(ditanya) + ' = ' + persen(h.tarif) + ' × ' + rupiah(h.omzetBulan) + ' = ' + rupiah(h.pph) + '.']
      : [
          'Omzet kumulatif sampai akhir ' + (ditanya ? namaBulan(ditanya - 1) : 'bulan sebelumnya') + ' = ' + rupiah(h.sebelum) + '; sampai akhir ' + namaBulan(ditanya) + ' = ' + rupiah(h.sampai) + '.',
          'Bagian omzet ' + namaBulan(ditanya) + ' yang melewati ' + rupiah(bebas) + ' = ' + rupiah(h.kena) + '.',
          'PPh final = ' + persen(h.tarif) + ' × ' + rupiah(h.kena) + ' = ' + rupiah(h.pph) + '.',
        ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: umkm.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: k.badan ? 'PPh final 0,5% perseroan perorangan (tanpa batas Rp500 juta)' : 'PPh final 0,5% OP dengan batas omzet Rp500 juta (bulan ' + (k.posisi === 'melewati' ? 'melewati' : k.posisi === 'setelah' ? 'setelah melewati' : 'sebelum melewati') + ' batas)',
      soal, inti: 'PPh final Masa ' + namaBulan(ditanya) + ' = 0,5% × ' + rupiah(h.kena) + ' = ' + rupiah(h.pph) + (k.badan ? ' (perseroan perorangan, tanpa batas Rp500 juta).' : ' (bagian omzet di atas batas kumulatif ' + angka(bebas / 1e6) + ' juta).'), langkah,
      dasarHukum: [dasar(ctx, 'umkm.tarif', tgl), ...(k.badan ? [] : [dasar(ctx, 'umkm.bebasOp', tgl)])], ruleIds: ['R-OP-16', 'R-OP-17'],
      poinIngat: 'UMKM 0,5% × omzet bulan; OP: omzet kumulatif sampai Rp500 juta setahun bebas; perseroan perorangan tidak mendapat batas itu.',
    }, r, h.pph, kandidat);
  },
};
