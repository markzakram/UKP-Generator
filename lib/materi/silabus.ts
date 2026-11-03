// Silabus per tingkat (R7): deck gabungan per materi untuk tingkat itu, durasi dihitung dari slide hasil tata letak
// (termasuk slide lanjutan), lalu subtema dibagi ke pertemuan berdurasi tetap. Dipakai tab Materi dan CLI.
import { CAKUPAN_TINGKAT, diujiDi, labelTingkat, URUTAN_KODE } from '../config';
import { dalamCakupan, tingkatSoal } from '../data';
import { slug } from '../export/common';
import { xlsx } from '../export/siadu';
import { MODELS } from '../models';
import type { DataUkp, Kode, Tingkat } from '../types';
import { NAMA_POLA, type Naskah, type Pola } from './naskah';
import { daftarSubtema, susunNaskahMateri, type PengaturanMateri } from './susun';
import { tataLetak } from './tata-letak';

/**
 * Perkiraan menit penyampaian per slide jadi. Slide isi 2 menit; rumus, contoh soal, dan pembahasan 3 menit
 * karena peserta menghitung atau berdiskusi; sampul, penutup, pembatas, dan angka besar lebih singkat.
 */
export const MENIT_POLA: Record<Pola, number> = {
  P1: 1, P2: 2, P3: 2, P4: 2, P5: 2, P6: 2, P7: 2, P8: 3, P9: 1.5, P10: 2, P11: 2, P12: 3, P13: 3, P14: 2, P15: 1, P16: 0.5,
};
/** Jam pelajaran (JP) diklat: 45 menit. */
export const MENIT_JP = 45;
export const PILIHAN_MENIT_PERTEMUAN = [60, 90, 120, 180] as const;

export interface PengaturanSilabus {
  tingkat: Tingkat;
  /** Hanya subtema yang mulai di tingkat ini (B 14, C 21); tingkat A selalu semua. */
  hanyaBaru: boolean;
  menitPertemuan: number;
  /** Pengaturan deck (kepadatan, contoh soal, kuis, sumber soal, tanggal acuan, seed). */
  deck: Omit<PengaturanMateri, 'kode' | 'subtema' | 'tingkat' | 'gabung'>;
}

export interface UnitSilabus {
  kode: Kode;
  materi: string;
  subtema: string;
  /** Tingkat subtema (mulai diuji). */
  tingkat: Tingkat;
  /** Nomor slide di deck gabungan, 1-based. */
  slideAwal: number;
  slideAkhir: number;
  slide: number;
  menit: number;
  kuis: number;
  contohSoal: number;
  soalBank: number;
  soalOrisinal: number;
  model: number;
  /** Menit tiap slide, untuk memecah subtema yang lebih panjang dari satu pertemuan. */
  menitSlide: number[];
}

export interface IsiPertemuan extends Omit<UnitSilabus, 'menitSlide'> {
  /** "1/2", "2/2" bila subtema dipecah ke beberapa pertemuan. */
  bagian?: string;
}
export interface Pertemuan { nomor: number; menit: number; isi: IsiPertemuan[] }

export interface MateriSilabus {
  kode: Kode;
  nama: string;
  judulDeck: string;
  /** Nama berkas sama dengan unduhan deck gabungan di tab Materi dan CLI --gabung. */
  berkas: string;
  slide: number;
  menit: number;
  /** Deck gabungan yang sudah disunting di browser dipakai apa adanya. */
  disunting: boolean;
  unit: UnitSilabus[];
}

export interface Silabus {
  tingkat: Tingkat;
  hanyaBaru: boolean;
  label: string;
  menitPertemuan: number;
  tanggalAcuan: string;
  kepadatan: string;
  materi: MateriSilabus[];
  pertemuan: Pertemuan[];
  total: { materi: number; subtema: number; slide: number; menit: number; jp: number; pertemuan: number };
}

export const namaDeckGabungan = (kode: string, tingkat: Tingkat, tambahan: boolean) => `materi-${slug(kode)}-tingkat-${tingkat.toLowerCase()}${tambahan ? '-tambahan' : ''}.pptx`;
const bulat = (n: number) => Math.round(n * 10) / 10;

/**
 * Unit per subtema dari deck gabungan: sampul dan daftar isi ikut subtema pertama, penutup ikut subtema terakhir.
 * `subtema` urut seperti pembatas di deck; judul pembatas dipakai hanya bila jumlahnya tidak cocok (deck disunting).
 */
function unitDariDeck(data: DataUkp, naskah: Naskah, kode: Kode, tingkat: Tingkat, subtema: string[]): UnitSilabus[] {
  const materi = data.mapping.materi.find((m) => m.kode === kode)?.nama ?? kode;
  const jadi = tataLetak(naskah);
  const pembatas = naskah.slides.filter((s) => !s.sembunyi && s.pola === 'P16');
  const cakupan = daftarSubtema(data, tingkat, naskah.tanggalAcuan).filter((s) => s.kode === kode);
  const unit: UnitSilabus[] = [];
  let bagian = -1;
  jadi.forEach((j, i) => {
    const nomor = pembatas.findIndex((p) => p.id === j.asal);
    if (nomor >= 0 && j.lanjutan === 0) bagian = nomor;
    const u = Math.max(0, bagian);
    if (!unit[u]) {
      const sub = pembatas.length === subtema.length ? subtema[u] : pembatas[u]?.judul ?? subtema[0] ?? naskah.judul;
      const asli = cakupan.find((s) => s.subtema === sub);
      const soal = data.bank.filter((b) => b.kode === kode && b.subtema === sub && dalamCakupan(tingkatSoal(b, data.mapping), tingkat)).length;
      const ori = data.orisinal.filter((b) => b.kode === kode && b.subtema === sub && dalamCakupan(tingkatSoal(b, data.mapping), tingkat)).length;
      unit[u] = {
        kode, materi, subtema: sub, tingkat: asli?.tingkat ?? tingkat, slideAwal: i + 1, slideAkhir: i + 1, slide: 0, menit: 0, kuis: 0, contohSoal: 0,
        soalBank: soal, soalOrisinal: ori, model: MODELS.filter((m) => m.kode === kode && m.subtema === sub && dalamCakupan(tingkatSoal(m, data.mapping), tingkat)).length, menitSlide: [],
      };
    }
    const x = unit[u];
    x.slideAkhir = i + 1;
    x.slide++;
    x.menitSlide.push(MENIT_POLA[j.pola]);
    if (j.lanjutan === 0 && j.pola === 'P11') x.kuis++;
    if (j.lanjutan === 0 && j.pola === 'P12') x.contohSoal++;
  });
  for (const x of unit) x.menit = bulat(x.menitSlide.reduce((a, b) => a + b, 0));
  return unit.filter(Boolean);
}

/**
 * Bagi unit ke pertemuan secara berurutan. Subtema yang tidak muat dimulai di pertemuan berjalan bila sisa waktunya
 * masih cukup (paling sedikit 30 menit atau sepertiga pertemuan) lalu dilanjutkan di pertemuan berikutnya; bila
 * sisa lebih pendek, subtema dimulai di pertemuan baru. Pemecahan selalu di batas slide.
 */
export function bagiPertemuan(unit: UnitSilabus[], menitPertemuan: number): Pertemuan[] {
  const hasil: Pertemuan[] = [];
  const buka = () => { const p: Pertemuan = { nomor: hasil.length + 1, menit: 0, isi: [] }; hasil.push(p); return p; };
  const isi = (p: Pertemuan, u: UnitSilabus, dari: number, sampai: number, bagian?: string) => {
    const menit = bulat(u.menitSlide.slice(dari, sampai).reduce((a, b) => a + b, 0));
    const { menitSlide: _, ...dasar } = u;
    p.isi.push({ ...dasar, slideAwal: u.slideAwal + dari, slideAkhir: u.slideAwal + sampai - 1, slide: sampai - dari, menit, ...(bagian ? { bagian } : {}) });
    p.menit = bulat(p.menit + menit);
  };
  const minSisa = Math.min(30, menitPertemuan / 3);
  for (const u of unit) {
    let p = hasil[hasil.length - 1] ?? buka();
    if (p.isi.length && u.menit > menitPertemuan - p.menit && menitPertemuan - p.menit < minSisa) p = buka();
    const potong: [Pertemuan, number, number][] = [];
    let dari = 0, terpakai = p.menit;
    for (let i = 0; i < u.slide; i++) {
      if (terpakai + u.menitSlide[i] > menitPertemuan && (i > dari || p.isi.length)) {
        if (i > dari) potong.push([p, dari, i]);
        p = buka(); dari = i; terpakai = 0;
      }
      terpakai += u.menitSlide[i];
    }
    potong.push([p, dari, u.slide]);
    potong.forEach(([q, a, b], k) => isi(q, u, a, b, potong.length > 1 ? `${k + 1}/${potong.length}` : undefined));
  }
  return hasil;
}

/**
 * Susun silabus tingkat: satu deck gabungan per materi dalam cakupan (urut materi), lalu pertemuan.
 * `deckAda` mengembalikan naskah deck gabungan yang sudah ada di browser (boleh tidak ada).
 */
export function susunSilabus(data: DataUkp, p: PengaturanSilabus, deckAda?: (kode: Kode) => Naskah | undefined): Silabus {
  const tambahan = p.hanyaBaru && p.tingkat !== 'A';
  const cakupan = daftarSubtema(data, p.tingkat, p.deck.tanggalAcuan).filter((s) => !tambahan || s.tingkat === p.tingkat);
  const materi: MateriSilabus[] = [];
  for (const kode of URUTAN_KODE) {
    const urut = data.mapping.materi.find((m) => m.kode === kode)?.subtema ?? [];
    const sub = cakupan.filter((s) => s.kode === kode).map((s) => s.subtema).sort((a, b) => urut.indexOf(a) - urut.indexOf(b));
    if (!sub.length) continue;
    // Deck gabungan di browser dipakai hanya bila berisi semua subtema cakupan (pembatas sama banyak).
    const simpanan = deckAda?.(kode);
    const ada = simpanan && simpanan.slides.filter((s) => !s.sembunyi && s.pola === 'P16').length === sub.length ? simpanan : undefined;
    const naskah = ada ?? susunNaskahMateri(data, { ...p.deck, kode, subtema: '', tingkat: p.tingkat, gabung: sub }, sub);
    const unit = unitDariDeck(data, naskah, kode, p.tingkat, sub);
    materi.push({
      kode, nama: data.mapping.materi.find((m) => m.kode === kode)?.nama ?? kode, judulDeck: naskah.judul, berkas: namaDeckGabungan(kode, p.tingkat, tambahan),
      slide: unit.reduce((a, u) => a + u.slide, 0), menit: bulat(unit.reduce((a, u) => a + u.menit, 0)), disunting: !!ada, unit,
    });
  }
  const pertemuan = bagiPertemuan(materi.flatMap((m) => m.unit), p.menitPertemuan);
  const menit = bulat(materi.reduce((a, m) => a + m.menit, 0));
  return {
    tingkat: p.tingkat, hanyaBaru: tambahan, label: labelTingkat(p.tingkat) + (tambahan ? ' (hanya subtema baru)' : ''), menitPertemuan: p.menitPertemuan,
    tanggalAcuan: p.deck.tanggalAcuan, kepadatan: p.deck.kepadatan, materi, pertemuan,
    total: { materi: materi.length, subtema: materi.reduce((a, m) => a + m.unit.length, 0), slide: materi.reduce((a, m) => a + m.slide, 0), menit, jp: Math.ceil(menit / MENIT_JP), pertemuan: pertemuan.length },
  };
}

export const ringkasSilabus = (s: Silabus) => `${s.label}: ${s.total.materi} materi, ${s.total.subtema} subtema, ${s.total.slide} slide, ±${Math.round(s.total.menit)} menit (${s.total.jp} JP), ${s.total.pertemuan} pertemuan × ${s.menitPertemuan} menit`;
const latihan = (u: Pick<UnitSilabus, 'soalBank' | 'soalOrisinal' | 'model'>) => [u.soalBank ? u.soalBank + ' bank' : '', u.soalOrisinal ? u.soalOrisinal + ' orisinal' : '', u.model ? u.model + ' model' : ''].filter(Boolean).join(' · ') || 'belum ada';
export const namaBerkasSilabus = (s: Silabus) => `silabus-tingkat-${s.tingkat.toLowerCase()}${s.hanyaBaru ? '-tambahan' : ''}-${s.menitPertemuan}-menit.xlsx`;

/** Lembar silabus .xlsx: Silabus (per pertemuan), Per materi, dan Ringkasan beserta asumsi durasi. */
export function lembarSilabus(s: Silabus): Uint8Array {
  const pertemuanMateri = (kode: Kode) => {
    const no = s.pertemuan.filter((p) => p.isi.some((x) => x.kode === kode)).map((p) => p.nomor);
    return no.length ? (no[0] === no[no.length - 1] ? String(no[0]) : no[0] + '–' + no[no.length - 1]) : '';
  };
  const baris = s.pertemuan.flatMap((p) => p.isi.map((x, i) => [
    i ? '' : p.nomor, i ? '' : Math.round(p.menit), x.kode + ' · ' + x.materi, x.subtema + (x.bagian ? ` (bagian ${x.bagian})` : ''), diujiDi(x.tingkat),
    s.materi.find((m) => m.kode === x.kode)?.berkas ?? '', x.slideAwal + '–' + x.slideAkhir, x.slide, Math.round(x.menit), x.kuis, x.contohSoal, latihan(x),
  ]));
  const perMateri = s.materi.map((m) => [m.kode, m.nama, m.berkas + (m.disunting ? ' (disunting)' : ''), m.unit.length, m.slide, Math.round(m.menit), Math.ceil(m.menit / MENIT_JP), pertemuanMateri(m.kode)]);
  const ringkas: (string | number)[][] = [
    ['Butir', 'Nilai'],
    ['Tingkat', s.label],
    ['Cakupan', s.hanyaBaru ? 'Hanya subtema yang mulai di Tingkat ' + s.tingkat : 'Subtema ' + CAKUPAN_TINGKAT[s.tingkat] + ' (kumulatif)'],
    ['Materi', s.total.materi],
    ['Subtema', s.total.subtema],
    ['Slide', s.total.slide],
    ['Perkiraan durasi', `${Math.round(s.total.menit)} menit (±${(s.total.menit / 60).toFixed(1).replace('.', ',')} jam)`],
    ['JP (' + MENIT_JP + ' menit)', s.total.jp],
    ['Pertemuan', `${s.total.pertemuan} × ${s.menitPertemuan} menit`],
    ['Aturan per', s.tanggalAcuan],
    ['Kepadatan deck', s.kepadatan],
    ['', ''],
    ['Asumsi menit per slide', ''],
    ...(Object.entries(MENIT_POLA) as [Pola, number][]).map(([pola, m]) => [pola + ' · ' + NAMA_POLA[pola], m]),
    ['', ''],
    ['Catatan', 'Durasi adalah perkiraan penyampaian materi. Tambahkan waktu tanya jawab, latihan, dan jeda sesuai kelas. Slide lanjutan dihitung sebagai slide tersendiri.'],
    ['Catatan', 'Sampul dan daftar isi ikut subtema pertama tiap materi; penutup ikut subtema terakhir. Subtema yang lebih panjang dari satu pertemuan dipecah di batas slide.'],
    ...(s.materi.some((m) => m.disunting) ? [['Catatan', 'Deck bertanda (disunting) memakai naskah yang sudah diubah di browser.']] : []),
  ];
  return xlsx([
    { nama: 'Silabus', baris: [['Pertemuan', 'Menit pertemuan', 'Materi', 'Subtema', 'Diuji di', 'Deck', 'Slide', 'Jumlah slide', 'Menit', 'Kuis', 'Contoh soal', 'Soal latihan tersedia'], ...baris], lebar: [10, 10, 28, 46, 13, 34, 9, 8, 8, 6, 8, 26] },
    { nama: 'Per materi', baris: [['Kode', 'Materi', 'Deck', 'Subtema', 'Slide', 'Menit', 'JP', 'Pertemuan'], ...perMateri], lebar: [7, 34, 40, 9, 8, 8, 6, 11] },
    { nama: 'Ringkasan', baris: ringkas, lebar: [30, 90] },
  ]);
}
