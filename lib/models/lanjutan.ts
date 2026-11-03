// Model soal baru lanjutan (Tahap 5, PRD bagian 9 "Tahap berikutnya").
import { angka, buatTanggal, isoTanggal, namaBulan, persen, rupiah, tanggal } from '../util';
import { bulatBawahRibu, dasar, hasilAngka, kelipatan, konteksUsaha, lapisan17, lapisan17Lama, namaBadan, namaOrang, param, paramRaw, pph17, type Kandidat } from './bantu';
import type { KonteksModel, ModelSoal } from './types';

type P = Record<string, string | number | boolean>;
const jumlahUsaha = (ctx: KonteksModel) => ctx.data.konteks.usaha.length;
const obj = <T,>(ctx: KonteksModel, kunci: string, pada = ctx.tanggalAcuan) => paramRaw(ctx, kunci, pada).nilai as unknown as T;
const tahunLalu = (ctx: KonteksModel) => Number(ctx.tanggalAcuan.slice(0, 4)) - 1;

// ---------------------------------------------------------------- Sanksi bunga
const PASAL_BUNGA: Record<string, { kode: string; label: string }> = {
  '9-2a': { kode: '9-2a', label: 'Pasal 9 ayat (2a)' }, '8-2': { kode: '8-2', label: 'Pasal 8 ayat (2)' },
  '19-1': { kode: '19', label: 'Pasal 19 ayat (1)' }, 'maks-24': { kode: '8-2', label: 'Pasal 8 ayat (2)' },
};
/** Jumlah bulan: bulan penuh dari tanggal ke tanggal yang sama, sisa hari dihitung 1 bulan. */
export function jumlahBulan(mulai: string, akhir: string) {
  const [y1, m1, d1] = mulai.split('-').map(Number), [y2, m2, d2] = akhir.split('-').map(Number);
  const penuh = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const sisa = d2 !== d1 ? 1 : 0;
  return Math.max(1, penuh + sisa);
}
const tarifBulan = (acuan: number, uplift: number) => Math.round(((acuan + uplift) / 12) * 10000) / 10000;
const hitungBunga = (p: P, ctx: KonteksModel) => {
  const up = obj<Record<string, number>>(ctx, 'bunga.uplift');
  const tarif = tarifBulan(Number(p.acuan), up[PASAL_BUNGA[String(p.kondisi)].kode]);
  const bulanAsli = jumlahBulan(String(p.mulai), String(p.bayar));
  const bulan = Math.min(bulanAsli, param(ctx, 'bunga.maksBulan'));
  return { tarif, bulanAsli, bulan, bunga: Math.round(Number(p.pokok) * tarif * bulan) };
};
export const sanksiBunga: ModelSoal = {
  id: 'sanksi-bunga', nama: 'Sanksi bunga per bulan (KMK)', kode: 'KUP', subtema: 'Sanksi administrasi', tingkat: 'C',
  ringkas: 'Pokok × tarif KMK pasal yang tepat × jumlah bulan (bagian bulan = 1 bulan, maks 24). Tabel tarif disebut di soal sebagai fakta.',
  kondisi: Object.keys(PASAL_BUNGA),
  kesulitan: (k) => (k === '9-2a' ? 'sedang' : 'sulit'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungBunga(p, ctx).bunga),
  buat(r, ctx, kondisi = r.pick(Object.keys(PASAL_BUNGA))) {
    const kt = konteksUsaha(r, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const acuan = r.pick([0.0575, 0.06, 0.0625, 0.065, 0.0675, 0.07, 0.0708]);
    const up = obj<Record<string, number>>(ctx, 'bunga.uplift');
    // Semua tanggal pembayaran sebelum tanggal acuan: tahun dasar = tahun lalu.
    const ty = tahunLalu(ctx);
    let mulai: string, bayar: string, latar: string;
    if (kondisi === '9-2a') {
      const masa = r.int(1, 9);
      mulai = isoTanggal(buatTanggal(ty, masa + 1, 15));
      bayar = isoTanggal(buatTanggal(ty, masa + 1 + r.int(0, 2), 15 + r.int(1, 12)));
      latar = wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') menyetor angsuran PPh Pasal 25 Masa ' + namaBulan(masa - 1) + ' ' + ty + ' pada ' + tanggal(bayar) + ', padahal batas setornya ' + tanggal(mulai) + '.';
    } else if (kondisi === '19-1') {
      mulai = isoTanggal(buatTanggal(ty, r.int(1, 6), r.int(5, 25)));
      const [y, m, d] = mulai.split('-').map(Number);
      bayar = isoTanggal(buatTanggal(y, m + r.int(1, 4), d + r.int(-3, 6)));
      latar = 'SKPKB PPh Badan ' + wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') jatuh tempo pelunasannya ' + tanggal(mulai) + '. ' + wp + ' baru melunasinya pada ' + tanggal(bayar) + '.';
    } else {
      const tp = kondisi === 'maks-24' ? ty - 4 : ty - 1;
      mulai = tp + 1 + '-04-30';
      const lama = kondisi === 'maks-24' ? r.int(26, 32) : r.int(2, 8);
      bayar = isoTanggal(buatTanggal(tp + 1, 4 + lama, r.int(3, 26)));
      latar = wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') atas kemauan sendiri membetulkan SPT Tahunan PPh Badan Tahun Pajak ' + tp + ' dan melunasi kurang bayarnya pada ' + tanggal(bayar) + '. Batas pelunasan PPh Pasal 29 tahun pajak itu ' + tanggal(mulai) + '.';
    }
    const pokok = kelipatan(r, 10_000_000, 400_000_000, 1_000_000);
    const params = { kondisi, pokok, mulai, bayar, acuan };
    const h = hitungBunga(params, ctx);
    const t = (k: string) => tarifBulan(acuan, up[k]);
    const fmtT = (x: number) => persen(x);
    const soal = latar + ' Pokok pajak yang dibayar terlambat ' + rupiah(pokok) + '. Misalkan tarif bunga per bulan menurut KMK yang berlaku untuk periode itu: Pasal 19 ayat (1) ' + fmtT(t('19')) + '; Pasal 8 ayat (2) dan Pasal 9 ayat (2a) ' + fmtT(t('8-2')) + '; Pasal 13 ayat (2) ' + fmtT(t('13-2')) + '. Sanksi bunga ' + PASAL_BUNGA[kondisi].label + ' yang ditagih adalah ...';
    const kandidat: Kandidat[] = [
      { nilai: Math.round(pokok * 0.02 * h.bulan), alasan: 'Memakai bunga 2% per bulan flat, aturan sebelum UU Cipta Kerja.', penyebab: 'salah_periode' },
      { nilai: Math.round(pokok * h.tarif * Math.max(1, h.bulan - 1)), alasan: 'Mengabaikan sisa hari; bagian bulan dihitung satu bulan penuh.', penyebab: 'salah_hitung' },
      { nilai: Math.round(pokok * h.tarif * (h.bulan + 1)), alasan: 'Menambah satu bulan; bulan dihitung dari tanggal jatuh tempo, bukan dari akhir masa pajak.', penyebab: 'salah_hitung' },
      ...['19', '8-2', '13-2'].filter((k) => t(k) !== h.tarif).map((k) => ({ nilai: Math.round(pokok * t(k) * h.bulan), alasan: 'Memakai tarif ' + (k === '19' ? 'Pasal 19 (tanpa uplift)' : k === '13-2' ? 'Pasal 13 ayat (2) (uplift 15%)' : 'Pasal 8 ayat (2)/9 ayat (2a) (uplift 5%)') + '; ' + PASAL_BUNGA[kondisi].label + ' memakai uplift ' + persen(up[PASAL_BUNGA[kondisi].kode]) + '.', penyebab: 'tertukar_aturan' })),
    ];
    if (h.bulanAsli > h.bulan) kandidat.push({ nilai: Math.round(pokok * h.tarif * h.bulanAsli), alasan: 'Menghitung ' + h.bulanAsli + ' bulan; sanksi bunga paling lama 24 bulan.', penyebab: 'lupa_syarat' });
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: sanksiBunga.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan',
      subtopik: 'Sanksi bunga ' + PASAL_BUNGA[kondisi].label + ' dengan tarif KMK' + (kondisi === 'maks-24' ? ' (batas 24 bulan)' : ''),
      soal, inti: 'Bunga ' + PASAL_BUNGA[kondisi].label + ' = ' + rupiah(pokok) + ' × ' + persen(h.tarif) + ' × ' + h.bulan + ' bulan = ' + rupiah(h.bunga) + '.',
      langkah: [
        PASAL_BUNGA[kondisi].label + ' memakai tarif KMK ' + persen(h.tarif) + ' per bulan (suku bunga acuan + uplift ' + persen(up[PASAL_BUNGA[kondisi].kode]) + ', dibagi 12).',
        'Jangka waktu ' + tanggal(String(params.mulai)) + ' s.d. ' + tanggal(bayar) + ' = ' + h.bulanAsli + ' bulan (bagian bulan dihitung penuh)' + (h.bulanAsli > h.bulan ? ', dibatasi paling lama 24 bulan' : '') + '.',
        rupiah(pokok) + ' × ' + persen(h.tarif) + ' × ' + h.bulan + ' = ' + rupiah(h.bunga) + '.',
      ],
      dasarHukum: [dasar(ctx, 'bunga.uplift'), dasar(ctx, 'bunga.maksBulan')], ruleIds: ['R-KUP-11', kondisi === '19-1' ? 'R-KUP-16' : 'R-KUP-12'],
      poinIngat: 'Bunga = pokok × tarif KMK pasal yang tepat × bulan; uplift 0% (Ps 19), 5% (Ps 8(2), 9(2a)), 15% (Ps 13(2)); bagian bulan = 1 bulan; maks 24 bulan.',
    }, r, h.bunga, kandidat);
  },
};

// ---------------------------------------------------------------- NPPN
interface Ptkp { diri: number; kawin: number; tanggungan: number; maksTanggungan: number }
const hitungNppn = (p: P, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const pt = obj<Ptkp>(ctx, 'ptkp', tgl);
  const ptkp = pt.diri + (p.kawin ? pt.kawin : 0) + Math.min(Number(p.anak), pt.maksTanggungan) * pt.tanggungan;
  const neto = Math.round(Number(p.bruto) * Number(p.norma));
  const pkp = bulatBawahRibu(Math.max(0, neto - ptkp));
  return { ptkp, neto, pkp, pajak: pph17(pkp, lapisan17(ctx, tgl)) };
};
export const nppn: ModelSoal = {
  id: 'nppn', nama: 'PPh OP dengan NPPN', kode: 'OP', subtema: 'NPPN & pembukuan', tingkat: 'B',
  ringkas: 'Neto = norma × peredaran bruto; dikurangi PTKP; PKP × tarif Pasal 17.',
  kondisi: ['satu-lapisan', 'multi-lapisan'],
  kesulitan: (k) => (k === 'satu-lapisan' ? 'sedang' : 'sulit'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungNppn(p, ctx).pajak.total),
  buat(r, ctx, kondisi = r.pick(['satu-lapisan', 'multi-lapisan'])) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx), tgl = tahun + '-12-31';
    const norma = r.pick([0.2, 0.25, 0.3, 0.35, 0.5]);
    const kawin = r.next() < 0.7, anak = kawin ? r.int(0, 3) : 0;
    const pt = obj<Ptkp>(ctx, 'ptkp', tgl);
    const ptkp = pt.diri + (kawin ? pt.kawin : 0) + anak * pt.tanggungan;
    const lap = lapisan17(ctx, tgl);
    const targetPkp = kondisi === 'satu-lapisan' ? r.int(10, 55) * 1_000_000 : r.int(80, 420) * 1_000_000;
    const bruto = Math.min(4_700_000_000, Math.max(200_000_000, Math.round((targetPkp + ptkp) / norma / 1_000_000) * 1_000_000));
    const params = { kondisi, bruto, norma, kawin, anak, tanggal: tgl };
    const h = hitungNppn(params, ctx);
    const orang = namaOrang(r, ctx);
    const status = kawin ? 'kawin dengan ' + anak + ' tanggungan; istrinya tidak berpenghasilan' : 'belum kawin tanpa tanggungan';
    const soal = orang + ' (' + status + ') menjalankan usaha ' + kt.usaha.jenis + ' di ' + kt.kota + '. Peredaran bruto Tahun Pajak ' + tahun + ' ' + rupiah(bruto) + '. Ia telah memberitahukan penggunaan NPPN dan memilih tidak dikenai PPh final 0,5%; persentase norma untuk usaha dan wilayahnya ' + persen(norma) + '. Tidak ada penghasilan lain. PPh terutang ' + orang + ' Tahun Pajak ' + tahun + ' adalah ...';
    const lama = lapisan17Lama(ctx);
    const kandidat: Kandidat[] = [
      { nilai: Math.round(bruto * param(ctx, 'umkm.tarif', tgl)), alasan: 'Menghitung PPh final 0,5% × bruto; WP sudah memilih tarif umum dengan NPPN.', penyebab: 'tertukar_aturan' },
      { nilai: pph17(bulatBawahRibu(h.neto), lap).total, alasan: 'Tidak mengurangkan PTKP dari penghasilan neto.', penyebab: 'lupa_syarat' },
      { nilai: pph17(bulatBawahRibu(Math.max(0, bruto - h.ptkp)), lap).total, alasan: 'Menerapkan tarif atas bruto; dengan NPPN, yang dikenai tarif adalah neto (norma × bruto) setelah PTKP.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(h.pkp * 0.05), alasan: 'Memakai tarif 5% untuk seluruh PKP; tarif Pasal 17 berlapis.', penyebab: 'salah_hitung' },
      { nilai: Math.round(h.neto * 0.05), alasan: 'Mengalikan neto dengan 5% tanpa mengurangkan PTKP.', penyebab: 'salah_hitung' },
      ...(lama ? [{ nilai: pph17(h.pkp, lama).total, alasan: 'Memakai lapisan tarif lama (Rp50 juta pertama).', penyebab: 'salah_periode' }] : []),
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: nppn.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'PPh terutang OP dengan NPPN ' + persen(norma),
      soal, inti: 'Neto ' + persen(norma) + ' × ' + rupiah(bruto) + ' = ' + rupiah(h.neto) + '; PKP ' + rupiah(h.pkp) + ' (setelah PTKP ' + rupiah(h.ptkp) + '); PPh terutang ' + rupiah(h.pajak.total) + '.',
      langkah: [
        'Neto = norma × peredaran bruto = ' + persen(norma) + ' × ' + rupiah(bruto) + ' = ' + rupiah(h.neto) + '.',
        'PKP = ' + rupiah(h.neto) + ' − PTKP ' + rupiah(h.ptkp) + ', dibulatkan ke bawah ribuan = ' + rupiah(h.pkp) + '.',
        'Tarif Pasal 17: ' + h.pajak.rinci.map((x) => persen(x.tarif) + ' × ' + rupiah(x.sampai - x.dari)).join(' + ') + ' = ' + rupiah(h.pajak.total) + '.',
      ],
      dasarHukum: ['UU PPh Pasal 14 ayat (1)–(5); PER-17/PJ/2015', dasar(ctx, 'ptkp', tgl), dasar(ctx, 'pph17.lapisan', tgl)], ruleIds: ['R-OP-13', 'R-OP-14', 'R-OP-08'],
      poinIngat: 'NPPN: neto = norma × bruto (bruto < Rp4,8 M, sudah diberitahukan); lalu − PTKP, × tarif Pasal 17.',
    }, r, h.pajak.total, kandidat);
  },
};

// ---------------------------------------------------------------- Penyusutan fiskal
const HARTA = { 1: ['laptop dan printer kantor', 'mebel kantor dari kayu'], 2: ['mobil operasional', 'mesin kemasan ringan'], 3: ['mesin produksi utama', 'kapal penumpang kecil'], 4: ['mesin pembangkit berat', 'alat berat konstruksi'] } as Record<string, string[]>;
const hitungSusut = (p: P, ctx: KonteksModel) => {
  const tab = obj<Record<string, [number, number, number | null]>>(ctx, 'penyusutan.kelompok', String(p.tanggal));
  const [, gl, sm] = tab[String(p.kelompok)];
  const bulan1 = 13 - Number(p.bulanPerolehan);
  const harga = Number(p.harga);
  if (p.kondisi === 'saldo-menurun-tahun-kedua') {
    const th1 = Math.round(harga * sm! * bulan1 / 12);
    return { tarif: sm!, th1, nilai: Math.round((harga - th1) * sm!) };
  }
  return { tarif: gl, th1: 0, nilai: Math.round(harga * gl * bulan1 / 12) };
};
export const penyusutan: ModelSoal = {
  id: 'penyusutan-fiskal', nama: 'Penyusutan fiskal', kode: 'BDN', subtema: 'Harga perolehan, penyusutan & amortisasi', tingkat: 'B',
  ringkas: 'Garis lurus = harga × tarif; saldo menurun = nilai sisa buku × tarif; mulai bulan perolehan (tahun pertama pro rata bulan); bangunan hanya garis lurus.',
  kondisi: ['garis-lurus-tahun-pertama', 'saldo-menurun-tahun-kedua', 'bangunan-permanen'],
  kesulitan: (k) => (k === 'saldo-menurun-tahun-kedua' ? 'sulit' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungSusut(p, ctx).nilai),
  buat(r, ctx, kondisi = r.pick(['garis-lurus-tahun-pertama', 'saldo-menurun-tahun-kedua', 'bangunan-permanen'])) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx) - (kondisi === 'saldo-menurun-tahun-kedua' ? 1 : 0);
    const tgl = tahun + '-12-31';
    const kelompok = kondisi === 'bangunan-permanen' ? 'bangunanPermanen' : String(r.int(1, 4));
    const bulanPerolehan = r.int(2, 11);
    const harga = kelipatan(r, kondisi === 'bangunan-permanen' ? 1_920_000_000 : 96_000_000, kondisi === 'bangunan-permanen' ? 9_600_000_000 : 1_920_000_000, 1_920_000);
    const params = { kondisi, kelompok, bulanPerolehan, harga, tanggal: tgl };
    const h = hitungSusut(params, ctx);
    const tab = obj<Record<string, [number, number, number | null]>>(ctx, 'penyusutan.kelompok', tgl);
    const wp = namaBadan(r, ctx, 'PT');
    const harta = kondisi === 'bangunan-permanen' ? 'gedung kantor permanen' : r.pick(HARTA[kelompok]);
    const metode = kondisi === 'saldo-menurun-tahun-kedua' ? 'saldo menurun' : 'garis lurus';
    const ditanya = kondisi === 'saldo-menurun-tahun-kedua' ? tahun + 1 : tahun;
    const soal = wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + '; tahun buku = tahun kalender) membeli dan langsung menggunakan ' + harta + (kondisi === 'bangunan-permanen' ? '' : ' yang termasuk kelompok ' + kelompok + ' (PMK 72/2023)') + ' pada ' + namaBulan(bulanPerolehan - 1) + ' ' + tahun + ' dengan harga perolehan ' + rupiah(harga) + '. Penyusutan fiskal memakai metode ' + metode + '. Penyusutan fiskal Tahun Pajak ' + ditanya + ' adalah ...';
    const bulan1 = 13 - bulanPerolehan;
    const lain = kelompok === 'bangunanPermanen' ? tab.bangunanTidakPermanen : tab[String(Math.min(4, Number(kelompok) + 1))];
    const kandidat: Kandidat[] = kondisi === 'saldo-menurun-tahun-kedua'
      ? [
          { nilai: Math.round(harga * h.tarif), alasan: 'Mengalikan harga perolehan; saldo menurun dihitung dari nilai sisa buku awal tahun kedua.', penyebab: 'salah_hitung' },
          { nilai: Math.round((harga - harga * h.tarif) * h.tarif), alasan: 'Menyusutkan tahun pertama setahun penuh; tahun pertama dihitung pro rata sejak bulan perolehan.', penyebab: 'salah_periode' },
          { nilai: h.th1, alasan: 'Itu penyusutan tahun pertama, bukan tahun kedua.', penyebab: 'salah_periode' },
          { nilai: Math.round(harga * tab[kelompok][1]), alasan: 'Memakai tarif garis lurus; metode yang dipilih saldo menurun.', penyebab: 'tertukar_aturan' },
          { nilai: Math.round((harga - h.th1) * tab[kelompok][1]), alasan: 'Mengalikan nilai sisa buku dengan tarif garis lurus.', penyebab: 'tertukar_aturan' },
        ]
      : [
          { nilai: Math.round(harga * h.tarif), alasan: 'Menyusutkan setahun penuh; tahun pertama dihitung sejak bulan perolehan (' + bulan1 + ' bulan).', penyebab: 'salah_periode' },
          { nilai: Math.round(harga * h.tarif * 6 / 12), alasan: 'Memakai konvensi setengah tahun; fiskal memakai jumlah bulan sejak bulan perolehan.', penyebab: 'salah_hitung' },
          { nilai: Math.round(harga * h.tarif * (bulan1 - 1) / 12), alasan: 'Mulai bulan berikutnya; penyusutan dimulai pada bulan pengeluaran.', penyebab: 'salah_hitung' },
          { nilai: Math.round(harga * lain[1] * bulan1 / 12), alasan: 'Memakai tarif ' + (kelompok === 'bangunanPermanen' ? 'bangunan tidak permanen' : 'kelompok lain') + ' ' + persen(lain[1]) + '.', penyebab: 'lupa_syarat' },
          ...(kelompok !== 'bangunanPermanen' ? [{ nilai: Math.round(harga * tab[kelompok][2]! * bulan1 / 12), alasan: 'Memakai tarif saldo menurun; metode yang dipilih garis lurus.', penyebab: 'tertukar_aturan' }] : []),
          { nilai: 0, alasan: 'Menunda penyusutan ke tahun berikutnya; penyusutan dimulai pada bulan pengeluaran.', penyebab: 'salah_periode' },
          { nilai: Math.round(harga * h.tarif * (bulan1 + 1) / 12), alasan: 'Menghitung ' + (bulan1 + 1) + ' bulan; dari ' + namaBulan(bulanPerolehan - 1) + ' sampai Desember hanya ' + bulan1 + ' bulan.', penyebab: 'salah_hitung' },
        ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: penyusutan.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'Penyusutan fiskal ' + metode + ' ' + (kondisi === 'bangunan-permanen' ? 'bangunan permanen' : 'kelompok ' + kelompok),
      soal, inti: kondisi === 'saldo-menurun-tahun-kedua' ? 'Tahun pertama ' + rupiah(h.th1) + ' (pro rata ' + bulan1 + ' bulan); tahun kedua = (' + rupiah(harga) + ' − ' + rupiah(h.th1) + ') × ' + persen(h.tarif) + ' = ' + rupiah(h.nilai) + '.' : rupiah(harga) + ' × ' + persen(h.tarif) + ' × ' + bulan1 + '/12 = ' + rupiah(h.nilai) + '.',
      langkah: kondisi === 'saldo-menurun-tahun-kedua'
        ? ['Kelompok ' + kelompok + ' saldo menurun ' + persen(h.tarif) + '; tahun pertama pro rata ' + bulan1 + ' bulan: ' + rupiah(harga) + ' × ' + persen(h.tarif) + ' × ' + bulan1 + '/12 = ' + rupiah(h.th1) + '.', 'Nilai sisa buku awal ' + (tahun + 1) + ' = ' + rupiah(harga - h.th1) + '.', 'Penyusutan ' + (tahun + 1) + ' = ' + rupiah(harga - h.th1) + ' × ' + persen(h.tarif) + ' = ' + rupiah(h.nilai) + '.']
        : [(kondisi === 'bangunan-permanen' ? 'Bangunan permanen: masa manfaat 20 tahun, hanya garis lurus ' : 'Kelompok ' + kelompok + ' garis lurus ') + persen(h.tarif) + ' per tahun.', 'Dimulai bulan perolehan (' + namaBulan(bulanPerolehan - 1) + '): ' + bulan1 + ' bulan pada ' + tahun + '.', rupiah(harga) + ' × ' + persen(h.tarif) + ' × ' + bulan1 + '/12 = ' + rupiah(h.nilai) + '.'],
      dasarHukum: [dasar(ctx, 'penyusutan.kelompok', tgl)], ruleIds: ['R-BDN-13'],
      poinIngat: 'Kelompok 1–4: 4/8/16/20 tahun (GL 25/12,5/6,25/5%, SM dua kalinya); bangunan permanen 5% GL; tahun pertama pro rata sejak bulan perolehan.',
    }, r, h.nilai, kandidat);
  },
};

// ---------------------------------------------------------------- Fasilitas Pasal 31E
const hitung31E = (p: P, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const tarif = param(ctx, 'pphBadan.tarif', tgl);
  const f = obj<{ pengurangan: number; batasPkp: number; batasBruto: number }>(ctx, 'pasal31E', tgl);
  const bruto = Number(p.bruto), pkp = Number(p.pkp);
  const fas = bruto > f.batasBruto ? 0 : bruto <= f.batasPkp ? pkp : Math.round((f.batasPkp / bruto) * pkp);
  return { tarif, fas, pph: Math.round(fas * tarif * (1 - f.pengurangan) + (pkp - fas) * tarif) };
};
export const pasal31E: ModelSoal = {
  id: 'pasal-31e', nama: 'PPh badan dengan fasilitas Pasal 31E', kode: 'BDN', subtema: 'Tarif, Pasal 31E & fasilitas', tingkat: 'B',
  ringkas: 'Bruto ≤ Rp50 M: PKP fasilitas = 4,8 M / bruto × PKP dikenai 50% × 22%; bruto ≤ Rp4,8 M seluruh PKP 11%; > Rp50 M tanpa fasilitas.',
  kondisi: ['proporsional', 'seluruh-pkp', 'tanpa-fasilitas'],
  kesulitan: (k) => (k === 'proporsional' ? 'sedang' : k === 'seluruh-pkp' ? 'mudah' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitung31E(p, ctx).pph),
  buat(r, ctx, kondisi = r.pick(['proporsional', 'seluruh-pkp', 'tanpa-fasilitas'])) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx), tgl = tahun + '-12-31';
    const bruto = kondisi === 'seluruh-pkp' ? kelipatan(r, 1_500_000_000, 4_800_000_000, 100_000_000) : kondisi === 'proporsional' ? r.pick([6, 8, 12, 15, 16, 20, 24, 30, 32, 40, 48]) * 1_000_000_000 : r.int(51, 90) * 1_000_000_000;
    const pkp = kelipatan(r, bruto * 0.05, bruto * 0.15, 10_000_000);
    const params = { kondisi, bruto, pkp, tanggal: tgl };
    const h = hitung31E(params, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const soal = wp + ', ' + kt.usaha.jenis + ' di ' + kt.kota + ' (Wajib Pajak badan dalam negeri, bukan perusahaan terbuka), pada Tahun Pajak ' + tahun + ' memperoleh peredaran bruto ' + rupiah(bruto) + ' dan Penghasilan Kena Pajak ' + rupiah(pkp) + '. Perusahaan tidak memakai PPh final 0,5%. PPh badan terutang Tahun Pajak ' + tahun + ' adalah ...';
    const kandidat: Kandidat[] = [
      { nilai: Math.round(pkp * h.tarif), alasan: kondisi === 'tanpa-fasilitas' ? 'Ini benar untuk bruto > Rp50 miliar, tetapi angkanya tertukar.' : 'Tidak menerapkan fasilitas Pasal 31E; peredaran bruto tidak lebih dari Rp50 miliar.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(pkp * h.tarif * 0.5), alasan: kondisi === 'proporsional' ? 'Memberi fasilitas 50% atas seluruh PKP; hanya bagian PKP dari bruto sampai Rp4,8 miliar yang mendapat fasilitas.' : 'Memberi fasilitas; peredaran bruto melebihi Rp50 miliar.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(bruto * 0.005), alasan: 'Menghitung PPh final 0,5% × bruto; perusahaan memakai tarif umum.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(pkp * 0.25), alasan: 'Memakai tarif 25% yang berlaku sampai 2019.', penyebab: 'salah_periode' },
      { nilai: Math.round(h.fas * h.tarif * 0.5), alasan: 'Hanya menghitung bagian PKP berfasilitas; bagian non-fasilitas tetap dikenai tarif penuh.', penyebab: 'salah_hitung' },
      { nilai: Math.round(pkp * 0.2), alasan: '20% bukan tarif PPh badan (itu tarif PPh 26/branch profit tax).', penyebab: 'tertukar_aturan' },
    ].filter((x) => x.nilai !== h.pph);
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pasal31E.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'PPh badan Pasal 31E (' + (kondisi === 'proporsional' ? 'bruto Rp4,8–50 miliar' : kondisi === 'seluruh-pkp' ? 'bruto ≤ Rp4,8 miliar' : 'bruto > Rp50 miliar') + ')',
      soal, inti: kondisi === 'tanpa-fasilitas' ? 'Bruto > Rp50 miliar: tanpa fasilitas, 22% × PKP = ' + rupiah(h.pph) + '.' : 'PKP berfasilitas ' + rupiah(h.fas) + ' × 11% + sisanya × 22% = ' + rupiah(h.pph) + '.',
      langkah: kondisi === 'tanpa-fasilitas'
        ? ['Peredaran bruto ' + rupiah(bruto) + ' > Rp50 miliar → tidak mendapat fasilitas Pasal 31E.', 'PPh = ' + persen(h.tarif) + ' × ' + rupiah(pkp) + ' = ' + rupiah(h.pph) + '.']
        : [kondisi === 'seluruh-pkp' ? 'Bruto ≤ Rp4,8 miliar → seluruh PKP mendapat pengurangan tarif 50%.' : 'PKP berfasilitas = 4,8 miliar / ' + angka(bruto / 1e9) + ' miliar × ' + rupiah(pkp) + ' = ' + rupiah(h.fas) + '.',
          '50% × ' + persen(h.tarif) + ' × ' + rupiah(h.fas) + ' = ' + rupiah(Math.round(h.fas * h.tarif * 0.5)) + (pkp - h.fas ? '; ' + persen(h.tarif) + ' × ' + rupiah(pkp - h.fas) + ' = ' + rupiah(Math.round((pkp - h.fas) * h.tarif)) : '') + '.', 'PPh terutang = ' + rupiah(h.pph) + '.'],
      dasarHukum: [dasar(ctx, 'pasal31E', tgl), dasar(ctx, 'pphBadan.tarif', tgl)], ruleIds: ['R-BDN-18', 'R-BTI-09'],
      poinIngat: 'Pasal 31E: bruto ≤ Rp50 M; PKP fasilitas = 4,8 M/bruto × PKP kena 11%, sisanya 22%; bruto ≤ 4,8 M seluruhnya 11%.',
    }, r, h.pph, kandidat);
  },
};

// ---------------------------------------------------------------- Angsuran PPh 25
const hitung25 = (p: P) => Math.round((Number(p.terutang) - Number(p.pph22) - Number(p.pph23) - Number(p.pph24)) / 12);
export const angsuran25: ModelSoal = {
  id: 'angsuran-pph25', nama: 'Angsuran PPh 25 badan', kode: 'BDN', subtema: 'Kredit pajak, PPh 25 & SPT Tahunan', tingkat: 'B',
  ringkas: '(PPh terutang tahun lalu − PPh 21/22/23 − PPh 24) ÷ 12; PPh 25 yang sudah dibayar dan PPh final tidak dikurangkan.',
  kondisi: ['umum'],
  kesulitan: () => 'sedang',
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p) => rupiah(hitung25(p)),
  buat(r, ctx, kondisi = 'umum') {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx);
    const pph22 = kelipatan(r, 12_000_000, 120_000_000, 120_000), pph23 = kelipatan(r, 6_000_000, 60_000_000, 120_000), pph24 = r.next() < 0.5 ? kelipatan(r, 6_000_000, 36_000_000, 120_000) : 0;
    const terutang = pph22 + pph23 + pph24 + kelipatan(r, 120_000_000, 1_800_000_000, 120_000);
    const pph25 = Math.round((terutang - pph22 - pph23 - pph24) * r.int(6, 9) / 10 / 1000) * 1000;
    const final = kelipatan(r, 5_000_000, 50_000_000, 100_000);
    const params = { kondisi, terutang, pph22, pph23, pph24, pph25, final };
    const n = hitung25(params);
    const wp = namaBadan(r, ctx, 'PT');
    const soal = 'SPT Tahunan PPh Badan ' + wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') Tahun Pajak ' + tahun + ': PPh terutang ' + rupiah(terutang) + '; kredit PPh Pasal 22 ' + rupiah(pph22) + '; PPh Pasal 23 ' + rupiah(pph23) + (pph24 ? '; PPh Pasal 24 yang dapat dikreditkan ' + rupiah(pph24) : '') + '; PPh Pasal 25 yang telah dibayar ' + rupiah(pph25) + '. Selain itu, bunga depositonya telah dipotong PPh final ' + rupiah(final) + '. Tidak ada keadaan khusus. Besarnya angsuran PPh Pasal 25 per bulan untuk Tahun Pajak ' + (tahun + 1) + ' adalah ...';
    const kandidat: Kandidat[] = [
      { nilai: Math.round((terutang - pph22 - pph23 - pph24 - pph25) / 12), alasan: 'Ikut mengurangkan PPh 25 yang sudah dibayar; dasar angsuran hanya dikurangi PPh 21/22/23 dan PPh 24.', penyebab: 'salah_hitung' },
      { nilai: Math.round(terutang / 12), alasan: 'Tidak mengurangkan kredit PPh 22, 23, dan 24.', penyebab: 'lupa_syarat' },
      { nilai: Math.round((terutang - pph22 - pph23 - pph24 - final) / 12), alasan: 'Mengurangkan PPh final bunga deposito; PPh final bukan kredit pajak.', penyebab: 'tertukar_aturan' },
      { nilai: terutang - pph22 - pph23 - pph24, alasan: 'Itu dasar setahun; angsuran dibagi 12.', penyebab: 'salah_hitung' },
      { nilai: Math.round((terutang - pph22 - pph23 - pph24) / 11), alasan: 'Membagi 11; untuk tahun pajak penuh dibagi 12.', penyebab: 'salah_hitung' },
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: 'sedang', bloom: 'apply', tipe: 'Hitungan', subtopik: 'Angsuran PPh 25 umum dari SPT tahun lalu',
      soal, inti: '(' + rupiah(terutang) + ' − ' + rupiah(pph22 + pph23 + pph24) + ') ÷ 12 = ' + rupiah(n) + ' per bulan.',
      langkah: ['Dasar = PPh terutang − (PPh 22 + PPh 23' + (pph24 ? ' + PPh 24' : '') + ') = ' + rupiah(terutang - pph22 - pph23 - pph24) + '.', 'PPh 25 yang sudah dibayar dan PPh final tidak dikurangkan.', 'Angsuran = ' + rupiah(terutang - pph22 - pph23 - pph24) + ' ÷ 12 = ' + rupiah(n) + '.'],
      dasarHukum: ['UU PPh Pasal 25 ayat (1)', 'PMK 81/2024 Pasal 226'], ruleIds: ['R-BDN-22', 'R-BTI-23'],
      poinIngat: 'PPh 25 = (PPh terutang tahun lalu − PPh 21/22/23 − PPh 24) ÷ 12; jangan kurangi PPh 25 yang sudah dibayar atau PPh final.',
    }, r, n, kandidat);
  },
};

// ---------------------------------------------------------------- Thin capitalization
const hitungThin = (p: P, ctx: KonteksModel) => {
  const der = Number(p.utang) / Number(p.modal);
  const batas = param(ctx, 'thincap.der');
  const boleh = der > batas ? Math.round((batas / der) * Number(p.biaya)) : Number(p.biaya);
  return { der, boleh, koreksi: Number(p.biaya) - boleh };
};
export const thinCap: ModelSoal = {
  id: 'thin-cap', nama: 'Thin capitalization (DER 4:1)', kode: 'BTI', subtema: 'Pembatasan biaya pinjaman (thin capitalization)', tingkat: 'C',
  ringkas: 'DER > 4:1 → biaya pinjaman boleh = 4/DER × biaya; sisanya koreksi positif.',
  kondisi: ['der-lebih', 'der-tidak-lebih'],
  kesulitan: (k) => (k === 'der-lebih' ? 'sulit' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungThin(p, ctx).koreksi),
  buat(r, ctx, kondisi = r.pick(['der-lebih', 'der-tidak-lebih'])) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx);
    const d = kondisi === 'der-lebih' ? r.pick([5, 6, 8, 10]) : r.pick([2, 3, 4]);
    const modal = r.int(5, 40) * 1_000_000_000;
    const utang = modal * d;
    const biaya = r.int(10, 60) * d * 10_000_000;
    const params = { kondisi, utang, modal, biaya };
    const h = hitungThin(params, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const soal = wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') pada Tahun Pajak ' + tahun + ' mempunyai rata-rata saldo utang berbunga ' + rupiah(utang) + ' dan rata-rata saldo modal ' + rupiah(modal) + ' (rata-rata saldo akhir bulan). Biaya pinjaman yang dibebankan dalam laporan komersial ' + rupiah(biaya) + ', seluruhnya wajar dan memenuhi Pasal 6 dan 9 UU PPh. Koreksi fiskal positif atas biaya pinjaman menurut ketentuan DER adalah ...';
    const kandidat: Kandidat[] = [
      { nilai: h.boleh === biaya ? Math.round(biaya * 4 / Math.max(5, d + 2)) : h.boleh, alasan: h.boleh === biaya ? 'Membatasi biaya pinjaman padahal DER ' + d + ':1 tidak melebihi 4:1.' : 'Itu biaya pinjaman yang boleh dibebankan, bukan koreksi positifnya.', penyebab: h.boleh === biaya ? 'lupa_syarat' : 'tertukar_aturan' },
      { nilai: biaya, alasan: 'Mengoreksi seluruh biaya pinjaman; hanya bagian yang melebihi batas DER yang dikoreksi.', penyebab: 'salah_hitung' },
      { nilai: Math.round(biaya * Math.max(0, d - 4) / 4), alasan: 'Memakai rasio (DER − 4)/4; yang benar biaya × (1 − 4/DER).', penyebab: 'salah_hitung' },
      { nilai: Math.round(biaya * 0.25), alasan: 'Mengoreksi 25% secara rata; besarnya mengikuti rasio 4/DER.', penyebab: 'salah_hitung' },
      { nilai: h.koreksi ? 0 : Math.round(biaya / d), alasan: h.koreksi ? 'DER ' + d + ':1 melebihi 4:1, jadi sebagian biaya pinjaman tidak boleh dibebankan.' : 'Tidak ada koreksi karena DER tidak melebihi 4:1.', penyebab: h.koreksi ? 'belum_tahu_aturan' : 'lupa_syarat' },
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: thinCap.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'Koreksi biaya pinjaman DER ' + d + ':1',
      soal, inti: h.koreksi ? 'DER ' + d + ':1 > 4:1 → boleh 4/' + d + ' × ' + rupiah(biaya) + ' = ' + rupiah(h.boleh) + '; koreksi positif ' + rupiah(h.koreksi) + '.' : 'DER ' + d + ':1 tidak melebihi 4:1 → seluruh biaya pinjaman boleh, koreksi Rp0.',
      langkah: ['DER = ' + rupiah(utang) + ' / ' + rupiah(modal) + ' = ' + d + ' : 1.', h.koreksi ? 'Biaya pinjaman yang boleh = 4/' + d + ' × ' + rupiah(biaya) + ' = ' + rupiah(h.boleh) + '.' : 'DER ≤ 4:1 → seluruh biaya pinjaman dapat dibebankan.', 'Koreksi positif = ' + rupiah(h.koreksi) + '.'],
      dasarHukum: [dasar(ctx, 'thincap.der')], ruleIds: ['R-BTI-14', 'R-BTI-15'],
      poinIngat: 'DER = rata-rata utang/rata-rata modal; > 4:1 → biaya boleh = 4/DER × biaya pinjaman, sisanya koreksi positif.',
    }, r, h.koreksi, kandidat);
  },
};

// ---------------------------------------------------------------- Branch profit tax
const hitungBpt = (p: P, ctx: KonteksModel) => {
  const tgl = String(p.tanggal);
  const pph = Math.round(Number(p.pkp) * param(ctx, 'pphBadan.tarif', tgl));
  const tarif = p.p3b ? Number(p.tarifP3b) : param(ctx, 'pph26.tarif', tgl);
  return { pph, tarif, bpt: Math.round((Number(p.pkp) - pph) * tarif) };
};
export const branchProfit: ModelSoal = {
  id: 'branch-profit-tax', nama: 'Branch profit tax BUT', kode: 'BTI', subtema: 'Tarif PPh badan (PMA/BUT), Pasal 31E & branch profit tax', tingkat: 'C',
  ringkas: '20% (atau tarif P3B) × (PKP − PPh terutang BUT), final.',
  kondisi: ['tanpa-p3b', 'p3b'],
  kesulitan: (k) => (k === 'p3b' ? 'sulit' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungBpt(p, ctx).bpt),
  buat(r, ctx, kondisi = r.pick(['tanpa-p3b', 'p3b'])) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx), tgl = tahun + '-12-31';
    const pkp = r.int(5, 80) * 100_000_000;
    const tarifP3b = r.pick([0.1, 0.15]);
    const params = { kondisi, pkp, p3b: kondisi === 'p3b', tarifP3b, tanggal: tgl };
    const h = hitungBpt(params, ctx);
    const kantor = r.pick(ctx.data.konteks.namaPt) + ' ' + r.pick(['Engineering Ltd', 'Construction GmbH', 'Services BV']);
    const pph25 = Math.round(h.pph * 0.7 / 1_000_000) * 1_000_000;
    const soal = 'BUT ' + kantor + ' di ' + kt.kota + ' pada Tahun Pajak ' + tahun + ' memperoleh PKP ' + rupiah(pkp) + ' dan telah membayar angsuran PPh Pasal 25 ' + rupiah(pph25) + '. Laba setelah pajak tidak ditanamkan kembali di Indonesia. '
      + (kondisi === 'p3b' ? 'Kantor pusatnya penduduk negara mitra P3B yang membatasi tarif branch profit tax paling tinggi ' + persen(tarifP3b) + ', dan Formulir DGT telah memenuhi syarat.' : 'Kantor pusatnya berkedudukan di negara yang tidak mempunyai P3B dengan Indonesia.') + ' PPh Pasal 26 atas penghasilan kena pajak setelah dikurangi pajak BUT tersebut adalah ...';
    const umum = param(ctx, 'pph26.tarif', tgl);
    const kandidat: Kandidat[] = [
      { nilai: Math.round(pkp * h.tarif), alasan: 'Mengalikan PKP; dasarnya PKP setelah dikurangi PPh terutang BUT.', penyebab: 'lupa_syarat' },
      { nilai: Math.round((pkp - (h.pph - pph25)) * h.tarif), alasan: 'Mengurangkan PPh kurang bayar (PPh 29); yang dikurangkan PPh terutang.', penyebab: 'salah_hitung' },
      { nilai: Math.round((pkp - h.pph) * param(ctx, 'pphBadan.tarif', tgl)), alasan: 'Memakai tarif PPh badan 22%; branch profit tax memakai tarif PPh 26.', penyebab: 'tertukar_aturan' },
      kondisi === 'p3b'
        ? { nilai: Math.round((pkp - h.pph) * umum), alasan: 'Memakai tarif UU 20%; DGT memenuhi syarat sehingga tarif P3B berlaku.', penyebab: 'lupa_syarat' }
        : { nilai: Math.round((pkp - h.pph) * 0.1), alasan: 'Memakai tarif P3B; kantor pusat tidak berkedudukan di negara mitra P3B.', penyebab: 'tertukar_aturan' },
      { nilai: 0, alasan: 'Branch profit tax hanya dikecualikan bila laba ditanamkan kembali di Indonesia.', penyebab: 'belum_tahu_aturan' },
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: branchProfit.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'Branch profit tax BUT ' + (kondisi === 'p3b' ? 'dengan P3B' : 'tanpa P3B'),
      soal, inti: persen(h.tarif) + ' × (' + rupiah(pkp) + ' − ' + rupiah(h.pph) + ') = ' + rupiah(h.bpt) + '.',
      langkah: ['PPh terutang BUT = 22% × ' + rupiah(pkp) + ' = ' + rupiah(h.pph) + '.', 'Dasar = PKP − PPh terutang = ' + rupiah(pkp - h.pph) + '.', 'Tarif ' + (kondisi === 'p3b' ? 'P3B ' : 'UU ') + persen(h.tarif) + ' → ' + rupiah(h.bpt) + '.'],
      dasarHukum: ['UU PPh Pasal 26 ayat (4) dan (5)', 'PMK 14/PMK.03/2011', dasar(ctx, 'pphBadan.tarif', tgl)], ruleIds: ['R-PP-32', 'R-INT-35'],
      poinIngat: 'BPT = 20% (atau P3B) × (PKP − PPh terutang BUT), bukan × PKP; dikecualikan bila ditanamkan kembali.',
    }, r, h.bpt, kandidat);
  },
};

// ---------------------------------------------------------------- PBB-P5L
type Pbb = { tarif: number; njoptkp: number; njkpTinggi: number; njkpRendah: number; batasNjop: number };
const hitungPbb = (p: P, ctx: KonteksModel) => {
  const b = obj<Pbb>(ctx, 'pbb.p5l');
  const njop = Number(p.njop);
  const njkp = p.sektor === 'perkebunan' || njop >= b.batasNjop ? b.njkpTinggi : b.njkpRendah;
  return { njkp, pbb: Math.round(b.tarif * njkp * (njop - b.njoptkp)), b };
};
export const pbbP5L: ModelSoal = {
  id: 'pbb-p5l', nama: 'PBB-P5L terutang', kode: 'PBB', subtema: 'Pengenaan PBB: NJOP, NJOPTKP, NJKP, tarif', tingkat: 'B',
  ringkas: 'PBB = 0,5% × NJKP × (NJOP − NJOPTKP Rp12 juta); NJKP 40% (perkebunan/kehutanan/pertambangan, atau NJOP ≥ Rp1 M), 20% lainnya.',
  kondisi: ['perkebunan', 'lainnya-tinggi', 'lainnya-rendah'],
  kesulitan: (k) => (k === 'lainnya-rendah' ? 'sulit' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungPbb(p, ctx).pbb),
  buat(r, ctx, kondisi = r.pick(['perkebunan', 'lainnya-tinggi', 'lainnya-rendah'])) {
    const kt = konteksUsaha(r, ctx);
    const njop = kondisi === 'lainnya-rendah' ? kelipatan(r, 200_000_000, 990_000_000, 1_000_000) : kelipatan(r, 1_000_000_000, 60_000_000_000, 10_000_000);
    const sektor = kondisi === 'perkebunan' ? 'perkebunan' : 'lainnya';
    const params = { kondisi, njop, sektor };
    const h = hitungPbb(params, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const objek = kondisi === 'perkebunan' ? 'areal perkebunan kelapa sawit' : r.pick(['area budi daya perikanan di perairan', 'jaringan pipa di perairan lepas pantai', 'jalan tol dan bangunan pendukungnya']);
    const tahun = Number(ctx.tanggalAcuan.slice(0, 4));
    const soal = wp + ' adalah Wajib Pajak PBB-P5L sektor ' + (sektor === 'perkebunan' ? 'perkebunan' : 'lainnya') + ' atas ' + objek + ' di wilayah ' + kt.kota + '. NJOP objek tersebut Tahun ' + tahun + ' ' + rupiah(njop) + '; ini satu-satunya objek PBB-P5L milik ' + wp + '. PBB-P5L terutang Tahun ' + tahun + ' adalah ...';
    const lain = h.njkp === h.b.njkpTinggi ? h.b.njkpRendah : h.b.njkpTinggi;
    const kandidat: Kandidat[] = [
      { nilai: Math.round(h.b.tarif * lain * (njop - h.b.njoptkp)), alasan: 'Memakai NJKP ' + persen(lain) + '; untuk objek ini NJKP ' + persen(h.njkp) + '.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(h.b.tarif * h.njkp * njop), alasan: 'Tidak mengurangkan NJOPTKP Rp12 juta.', penyebab: 'lupa_syarat' },
      { nilai: Math.round(h.b.tarif * (njop - h.b.njoptkp)), alasan: 'Tidak memakai NJKP; tarif 0,5% dikalikan NJKP (persentase NJOP).', penyebab: 'lupa_syarat' },
      { nilai: Math.round(h.b.tarif * (h.njkp * njop - h.b.njoptkp)), alasan: 'Mengurangkan NJOPTKP setelah NJKP; urutannya NJOP − NJOPTKP lebih dulu.', penyebab: 'salah_hitung' },
      { nilai: Math.round(0.003 * h.njkp * (njop - h.b.njoptkp)), alasan: 'Memakai tarif 0,3%; tarif PBB-P5L tunggal 0,5%.', penyebab: 'tertukar_aturan' },
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pbbP5L.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'PBB-P5L sektor ' + sektor + ' (NJKP ' + persen(h.njkp) + ')',
      soal, inti: '0,5% × ' + persen(h.njkp) + ' × (' + rupiah(njop) + ' − ' + rupiah(h.b.njoptkp) + ') = ' + rupiah(h.pbb) + '.',
      langkah: ['NJOP − NJOPTKP = ' + rupiah(njop) + ' − ' + rupiah(h.b.njoptkp) + ' = ' + rupiah(njop - h.b.njoptkp) + '.', 'NJKP ' + persen(h.njkp) + (sektor === 'perkebunan' ? ' (perkebunan selalu 40%)' : njop >= h.b.batasNjop ? ' (NJOP ≥ Rp1 miliar)' : ' (NJOP < Rp1 miliar)') + '.', 'PBB = 0,5% × ' + persen(h.njkp) + ' × ' + rupiah(njop - h.b.njoptkp) + ' = ' + rupiah(h.pbb) + '.'],
      dasarHukum: [dasar(ctx, 'pbb.p5l')], ruleIds: ['R-PBB-08', 'R-PBB-09', 'R-PBB-10'],
      poinIngat: 'PBB-P5L = 0,5% × NJKP × (NJOP − NJOPTKP 12 jt); NJKP 40% (perkebunan/hutan/tambang atau NJOP ≥ 1 M), selainnya 20%.',
    }, r, h.pbb, kandidat);
  },
};

// ---------------------------------------------------------------- PPh final jasa konstruksi
const KONSTRUKSI: Record<string, { kunci: string; teks: string }> = {
  kecil: { kunci: 'kecil', teks: 'pelaksana konstruksi bersertifikat badan usaha (SBU) kualifikasi kecil' },
  'menengah-besar': { kunci: 'menengahBesar', teks: 'pelaksana konstruksi ber-SBU kualifikasi menengah' },
  'tanpa-sertifikat': { kunci: 'tanpaSertifikat', teks: 'pelaksana konstruksi yang tidak memiliki SBU' },
  'konsultansi-sertifikat': { kunci: 'konsultansiSertifikat', teks: 'konsultan pengawas konstruksi ber-SBU' },
  'konsultansi-tanpa': { kunci: 'konsultansiTanpa', teks: 'konsultan perencana konstruksi yang tidak memiliki SBU' },
};
const hitungKons = (p: P, ctx: KonteksModel) => {
  const t = obj<Record<string, number>>(ctx, 'konstruksi.tarif', String(p.tanggal));
  return { tarif: t[KONSTRUKSI[String(p.kondisi)].kunci], t, pph: Math.round(Number(p.nilai) * t[KONSTRUKSI[String(p.kondisi)].kunci]) };
};
export const jasaKonstruksi: ModelSoal = {
  id: 'jasa-konstruksi', nama: 'PPh final jasa konstruksi', kode: 'PP', subtema: 'PPh final Pasal 4 ayat (2)', tingkat: 'C',
  ringkas: 'PP 9/2022: pelaksana 1,75%/2,65%/4%; konsultansi 3,5%/6%; dari pembayaran tanpa PPN.',
  kondisi: Object.keys(KONSTRUKSI),
  kesulitan: (k) => (k === 'kecil' || k === 'menengah-besar' ? 'mudah' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungKons(p, ctx).pph),
  buat(r, ctx, kondisi = r.pick(Object.keys(KONSTRUKSI))) {
    const kt = konteksUsaha(r, ctx);
    const t0 = bulanTransaksiKons(r, ctx);
    const nilai = kelipatan(r, 100_000_000, 5_000_000_000, 10_000_000);
    const params = { kondisi, nilai, tanggal: t0 };
    const h = hitungKons(params, ctx);
    const pengguna = namaBadan(r, ctx, 'PT'), penyedia = namaBadan(r, ctx, 'CV', [pengguna]);
    const pekerjaan = kondisi.startsWith('konsultansi') ? (kondisi === 'konsultansi-tanpa' ? 'perencanaan' : 'pengawasan') + ' pembangunan gedung' : 'pembangunan gudang';
    const soal = pengguna + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') pada ' + tanggal(t0) + ' membayar jasa ' + pekerjaan + ' sebesar ' + rupiah(nilai) + ' (belum termasuk PPN) kepada ' + penyedia + ', ' + KONSTRUKSI[kondisi].teks + '. PPh yang wajib dipotong ' + pengguna + ' adalah ...';
    const kandidat: Kandidat[] = [
      ...Object.entries(h.t).filter(([k]) => k !== KONSTRUKSI[kondisi].kunci).map(([k, v]) => ({ nilai: Math.round(nilai * v), alasan: 'Memakai tarif ' + persen(v) + ' (' + ({ kecil: 'pelaksana kualifikasi kecil', menengahBesar: 'pelaksana kualifikasi menengah/besar', tanpaSertifikat: 'pelaksana tanpa sertifikat', konsultansiSertifikat: 'konsultansi bersertifikat', konsultansiTanpa: 'konsultansi tanpa sertifikat' } as Record<string, string>)[k] + ').', penyebab: 'tertukar_aturan' })),
      { nilai: Math.round(nilai * 0.02), alasan: 'Memakai PPh 23 2%; jasa konstruksi dikenai PPh final Pasal 4 ayat (2).', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(nilai * 1.11 * h.tarif), alasan: 'Menghitung dari nilai termasuk PPN; dasarnya pembayaran tanpa PPN.', penyebab: 'salah_tarif_dpp' },
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: jasaKonstruksi.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'PPh final jasa konstruksi: ' + KONSTRUKSI[kondisi].teks,
      soal, inti: persen(h.tarif) + ' × ' + rupiah(nilai) + ' = ' + rupiah(h.pph) + ' (PPh final, dipotong pengguna jasa).',
      langkah: ['Penyedia: ' + KONSTRUKSI[kondisi].teks + ' → tarif ' + persen(h.tarif) + ' (PP 9/2022 Pasal 3 ayat (1)).', 'PPh = ' + persen(h.tarif) + ' × ' + rupiah(nilai) + ' = ' + rupiah(h.pph) + '.'],
      dasarHukum: [dasar(ctx, 'konstruksi.tarif', t0)], ruleIds: ['R-PP-27', 'R-AKT-17'],
      poinIngat: 'Konstruksi: pelaksana 1,75% (kecil) / 2,65% (menengah-besar) / 4% (tanpa SBU); konsultansi 3,5% / 6%; dari nilai tanpa PPN.',
    }, r, h.pph, kandidat);
  },
};
function bulanTransaksiKons(r: { int: (a: number, b: number) => number }, ctx: KonteksModel) {
  const [y, m] = ctx.tanggalAcuan.split('-').map(Number);
  return isoTanggal(buatTanggal(y, m - r.int(1, 5), r.int(3, 26)));
}

// ---------------------------------------------------------------- Kredit PPh 24
const hitung24 = (p: P, ctx: KonteksModel) => {
  const tarif = param(ctx, 'pphBadan.tarif', String(p.tanggal));
  const pkp = Number(p.dn) + Number(p.ln);
  const terutang = Math.round(pkp * tarif);
  const batas = Math.round((Number(p.ln) / pkp) * terutang);
  return { tarif, pkp, terutang, batas, kredit: Math.min(batas, Number(p.pajakLn)) };
};
export const kredit24: ModelSoal = {
  id: 'kredit-pph24', nama: 'Kredit PPh Pasal 24', kode: 'BTI', subtema: 'Penghasilan luar negeri & kredit PPh Pasal 24', tingkat: 'C',
  ringkas: 'Kredit = terendah dari pajak LN dan (penghasilan LN / PKP) × PPh terutang.',
  kondisi: ['batas-berlaku', 'pajak-ln-lebih-kecil'],
  kesulitan: () => 'sulit',
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitung24(p, ctx).kredit),
  buat(r, ctx, kondisi = r.pick(['batas-berlaku', 'pajak-ln-lebih-kecil'])) {
    const kt = konteksUsaha(r, ctx);
    const tahun = tahunLalu(ctx), tgl = tahun + '-12-31';
    const dn = r.int(20, 200) * 100_000_000, ln = r.int(5, 60) * 100_000_000;
    const tarifLn = kondisi === 'batas-berlaku' ? r.pick([0.25, 0.28, 0.3]) : r.pick([0.1, 0.15, 0.17]);
    const pajakLn = Math.round(ln * tarifLn);
    const params = { kondisi, dn, ln, pajakLn, tanggal: tgl };
    const h = hitung24(params, ctx);
    const wp = namaBadan(r, ctx, 'PT');
    const soal = wp + ' (' + kt.usaha.jenis + ', ' + kt.kota + '; peredaran bruto di atas Rp50 miliar) pada Tahun Pajak ' + tahun + ' memperoleh penghasilan neto dalam negeri ' + rupiah(dn) + ' dan laba usaha dari satu negara (bukan mitra P3B) ' + rupiah(ln) + ' yang telah dikenai pajak di negara itu ' + rupiah(pajakLn) + '. Tidak ada penghasilan final atau kompensasi kerugian. PPh Pasal 24 yang dapat dikreditkan adalah ...';
    const kandidat: Kandidat[] = [
      kondisi === 'batas-berlaku'
        ? { nilai: pajakLn, alasan: 'Mengkreditkan seluruh pajak luar negeri; kredit dibatasi (penghasilan LN / PKP) × PPh terutang.', penyebab: 'lupa_syarat' }
        : { nilai: h.batas, alasan: 'Itu batas maksimum; pajak luar negeri yang dibayar lebih kecil, jadi kredit sebesar pajak luar negeri.', penyebab: 'salah_hitung' },
      { nilai: h.terutang, alasan: 'Itu seluruh PPh terutang atas PKP gabungan, bukan kredit PPh 24.', penyebab: 'salah_hitung' },
      { nilai: 0, alasan: 'Pajak atas penghasilan luar negeri dapat dikreditkan walaupun negara itu bukan mitra P3B.', penyebab: 'belum_tahu_aturan' },
      { nilai: Math.round(ln * 0.2), alasan: 'Memakai 20%; batasnya proporsi penghasilan luar negeri terhadap PKP × PPh terutang (tarif 22%).', penyebab: 'salah_tarif_dpp' },
      { nilai: Math.round((ln / dn) * h.terutang), alasan: 'Membagi dengan penghasilan dalam negeri; penyebutnya PKP gabungan.', penyebab: 'salah_hitung' },
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: 'sulit', bloom: 'analyze', tipe: 'Hitungan', subtopik: 'Kredit PPh 24 (' + (kondisi === 'batas-berlaku' ? 'dibatasi' : 'sebesar pajak luar negeri') + ')',
      soal, inti: 'Terendah dari pajak luar negeri ' + rupiah(pajakLn) + ' dan batas ' + rupiah(h.batas) + ' = ' + rupiah(h.kredit) + '.',
      langkah: ['PKP = ' + rupiah(dn) + ' + ' + rupiah(ln) + ' = ' + rupiah(h.pkp) + '; PPh terutang 22% = ' + rupiah(h.terutang) + '.', 'Batas = ' + rupiah(ln) + ' / ' + rupiah(h.pkp) + ' × ' + rupiah(h.terutang) + ' = ' + rupiah(h.batas) + '.', 'Kredit = terendah dari ' + rupiah(pajakLn) + ' dan ' + rupiah(h.batas) + ' = ' + rupiah(h.kredit) + '.'],
      dasarHukum: ['UU PPh Pasal 24 ayat (1) dan (2)', 'PMK 192/PMK.03/2018 Pasal 6', dasar(ctx, 'pphBadan.tarif', tgl)], ruleIds: ['R-BTI-20'],
      poinIngat: 'Kredit PPh 24 = terendah dari pajak LN nyata dan (penghasilan LN/PKP) × PPh terutang, per negara per jenis penghasilan.',
    }, r, h.kredit, kandidat);
  },
};

// ---------------------------------------------------------------- PPh 21 final pesangon
const hitungPesangon = (p: P, ctx: KonteksModel) => pph17(Number(p.jumlah), obj<[number | null, number][]>(ctx, 'pesangon.lapisan', String(p.tanggal)));
export const pesangon: ModelSoal = {
  id: 'pesangon-final', nama: 'PPh 21 final pesangon', kode: 'PP', subtema: 'PPh 21 selain pegawai tetap & PPh 21 final', tingkat: 'A',
  ringkas: 'PP 68/2009: 0% s.d. Rp50 juta, 5% s.d. Rp100 juta, 15% s.d. Rp500 juta, 25% di atasnya; final.',
  kondisi: ['dua-lapisan', 'tiga-lapisan', 'empat-lapisan'],
  kesulitan: (k) => (k === 'dua-lapisan' ? 'mudah' : 'sedang'),
  jumlahKonteks: jumlahUsaha,
  hitungUlang: (p, ctx) => rupiah(hitungPesangon(p, ctx).total),
  buat(r, ctx, kondisi = r.pick(['dua-lapisan', 'tiga-lapisan', 'empat-lapisan'])) {
    const kt = konteksUsaha(r, ctx);
    const t0 = bulanTransaksiKons(r, ctx);
    const jumlah = kondisi === 'dua-lapisan' ? kelipatan(r, 55_000_000, 99_000_000, 1_000_000) : kondisi === 'tiga-lapisan' ? kelipatan(r, 110_000_000, 490_000_000, 1_000_000) : kelipatan(r, 520_000_000, 1_500_000_000, 1_000_000);
    const upmk = Math.round(jumlah * 0.25 / 1_000_000) * 1_000_000;
    const params = { kondisi, jumlah, tanggal: t0 };
    const h = hitungPesangon(params, ctx);
    const orang = namaOrang(r, ctx);
    const pemberi = namaBadan(r, ctx, 'PT');
    const soal = orang + ' diberhentikan oleh ' + pemberi + ' (' + kt.usaha.jenis + ', ' + kt.kota + ') dan pada ' + tanggal(t0) + ' menerima sekaligus uang pesangon ' + rupiah(jumlah - upmk) + ' dan uang penghargaan masa kerja ' + rupiah(upmk) + '. Tidak ada pembayaran pesangon lain. PPh Pasal 21 yang bersifat final atas pembayaran tersebut adalah ...';
    const lap = lapisan17(ctx, t0);
    const kandidat: Kandidat[] = [
      { nilai: pph17(jumlah, lap).total, alasan: 'Memakai tarif Pasal 17; pesangon dikenai tarif khusus PP 68/2009 yang final.', penyebab: 'tertukar_aturan' },
      { nilai: Math.round(jumlah * 0.05), alasan: 'Mengalikan seluruh jumlah dengan 5%; tarif pesangon berlapis dan Rp50 juta pertama 0%.', penyebab: 'salah_hitung' },
      { nilai: pph17(jumlah - upmk, obj<[number | null, number][]>(ctx, 'pesangon.lapisan', t0)).total, alasan: 'Tidak memasukkan uang penghargaan masa kerja; UPMK termasuk uang pesangon.', penyebab: 'lupa_syarat' },
      { nilai: pph17(jumlah, [[null, 0.05]] as [number | null, number][]).total - 2_500_000, alasan: 'Menerapkan 5% setelah Rp50 juta untuk seluruh sisa; lapisan berikutnya 15% dan 25%.', penyebab: 'salah_hitung' },
      { nilai: Math.round(Math.max(0, jumlah - 50_000_000) * 0.05), alasan: 'Hanya memakai lapisan 5%; bagian di atas Rp100 juta dikenai 15% (dan 25% di atas Rp500 juta).', penyebab: 'salah_hitung' },
      { nilai: Math.round(Math.max(0, jumlah - 50_000_000) * 0.15), alasan: 'Memakai 15% untuk seluruh bagian di atas Rp50 juta; bagian Rp50–100 juta dikenai 5%.', penyebab: 'salah_hitung' },
      { nilai: 0, alasan: 'Hanya Rp50 juta pertama yang dikenai tarif 0%; sisanya tetap dipotong.', penyebab: 'belum_tahu_aturan' },
      { nilai: Math.round(jumlah * 0.25), alasan: 'Memakai tarif tertinggi 25% untuk seluruh jumlah; tarif pesangon berlapis.', penyebab: 'salah_hitung' },
    ];
    return hasilAngka({
      kondisi, konteks: 'u' + kt.indeks, params, kesulitan: pesangon.kesulitan(kondisi), bloom: 'apply', tipe: 'Hitungan', subtopik: 'PPh 21 final pesangon ' + h.rinci.length + ' lapisan',
      soal, inti: 'Pesangon (termasuk UPMK) ' + rupiah(jumlah) + ' dikenai lapisan PP 68/2009 = ' + rupiah(h.total) + ', final.',
      langkah: ['Uang pesangon termasuk UPMK: ' + rupiah(jumlah - upmk) + ' + ' + rupiah(upmk) + ' = ' + rupiah(jumlah) + '.', 'Lapisan: ' + h.rinci.map((x) => persen(x.tarif) + ' × ' + rupiah(x.sampai - x.dari) + ' = ' + rupiah(x.pajak)).join('; ') + '.', 'PPh 21 final = ' + rupiah(h.total) + '.'],
      dasarHukum: [dasar(ctx, 'pesangon.lapisan', t0)], ruleIds: ['R-PP-13'],
      poinIngat: 'Pesangon (termasuk UPMK/UPH) final: 0% s.d. 50 jt, 5% s.d. 100 jt, 15% s.d. 500 jt, 25% di atasnya.',
    }, r, h.total, kandidat);
  },
};

export const MODEL_LANJUTAN: ModelSoal[] = [sanksiBunga, nppn, penyusutan, pasal31E, angsuran25, thinCap, branchProfit, pbbP5L, jasaKonstruksi, kredit24, pesangon];
