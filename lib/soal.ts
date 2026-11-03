import { HURUF } from './config';
import { tingkatSoal } from './data';
import type { BankSoal, DataUkp, Huruf, Soal } from './types';
import { hash, nilaiOpsi, type Rng } from './util';

/** Checksum isi soal: berubah bila stimulus, opsi, kunci, atau pembahasan berubah. */
export function checksumSoal(s: Pick<Soal, 'kasus' | 'soal' | 'opsi' | 'kunci' | 'inti' | 'langkah' | 'kenapaSalah' | 'dasarHukum' | 'poinIngat'>): string {
  return hash(JSON.stringify([s.kasus, s.soal, HURUF.map((h) => s.opsi[h]), s.kunci, s.inti, s.langkah, HURUF.map((h) => s.kenapaSalah[h] ?? ''), s.dasarHukum, s.poinIngat]));
}

export function dariBank(b: BankSoal, data: DataUkp, asal: Soal['asal'] = b.bank === 'orisinal' ? 'orisinal' : 'bank'): Soal {
  const s: Soal = {
    uid: asal + ':' + b.id,
    asal,
    sumberId: b.id,
    modelId: null,
    tanda: 'bank|' + b.id,
    params: null,
    kode: b.kode,
    materi: b.materi,
    subtema: b.subtema,
    subtopik: b.subtopik,
    tingkat: tingkatSoal(b, data.mapping),
    tipe: b.tipe,
    bloom: b.bloom,
    kesulitan: b.kesulitan,
    kasusId: b.kasusId,
    kasus: b.kasus,
    soal: b.soal,
    opsi: { ...b.opsi },
    kunci: b.kunci,
    inti: b.inti,
    langkah: [...b.langkah],
    kenapaSalah: { ...b.kenapaSalah },
    penyebabSalah: { ...b.penyebabSalah },
    dasarHukum: [...b.dasarHukum],
    ruleIds: [...b.ruleIds],
    catatanAturan: b.catatanAturan,
    poinIngat: b.poinIngat,
    urutanAsal: [...HURUF],
    posisiTetap: b.posisiTetap,
    opsiAngka: b.opsiAngka,
    revisi: 1,
    disunting: false,
    checksum: '',
  };
  s.checksum = checksumSoal(s);
  return s;
}

// "Opsi A", "opsi B", "pilihan C", "jawaban D" dipetakan ulang saat opsi diacak.
const RE_RUJUKAN = /\b([Oo]psi|[Pp]ilihan|[Jj]awaban)(\s+)([A-D])\b/g;

/**
 * Terapkan permutasi: `urutan[i]` = huruf saat ini yang dipindah ke posisi ke-i.
 * Kunci, alasan per opsi, penyebab salah, dan rujukan huruf di teks ikut dipetakan.
 */
export function terapkanUrutan(s: Soal, urutan: Huruf[]): Soal {
  const ke = Object.fromEntries(urutan.map((lama, i) => [lama, HURUF[i]])) as Record<Huruf, Huruf>;
  const ganti = (t: string) => t.replace(RE_RUJUKAN, (_, kata, spasi, h: Huruf) => kata + spasi + ke[h]);
  const petakan = <T,>(o: Partial<Record<Huruf, T>>) => Object.fromEntries(Object.entries(o).map(([h, v]) => [ke[h as Huruf], typeof v === 'string' ? ganti(v) : v])) as Partial<Record<Huruf, T>>;
  const hasil: Soal = {
    ...s,
    opsi: Object.fromEntries(HURUF.map((h, i) => [h, s.opsi[urutan[i]]])) as Soal['opsi'],
    kunci: ke[s.kunci],
    kenapaSalah: petakan(s.kenapaSalah),
    penyebabSalah: petakan(s.penyebabSalah),
    inti: ganti(s.inti),
    langkah: s.langkah.map(ganti),
    catatanAturan: s.catatanAturan ? ganti(s.catatanAturan) : null,
    poinIngat: s.poinIngat ? ganti(s.poinIngat) : null,
    urutanAsal: urutan.map((h) => s.urutanAsal[HURUF.indexOf(h)]),
  };
  hasil.checksum = checksumSoal(hasil);
  return hasil;
}

/** Urutan naik untuk opsi angka murni (PRD bagian 10 butir 7). */
export function urutanAngka(s: Pick<Soal, 'opsi'>): Huruf[] {
  return [...HURUF].sort((a, b) => nilaiOpsi(s.opsi[a]) - nilaiOpsi(s.opsi[b]) || HURUF.indexOf(a) - HURUF.indexOf(b));
}
export const opsiAngkaUrut = (s: Pick<Soal, 'opsi'>) => urutanAngka(s).every((h, i) => h === HURUF[i]);

/**
 * Pilih urutan opsi untuk satu soal. Opsi angka diurutkan naik, soal berposisi tetap tidak diubah,
 * selebihnya kunci ditaruh pada huruf yang paling jarang dipakai (`hitungKunci`), atau pada `kunciTujuan` bila diberikan.
 */
export function pilihUrutan(s: Soal, r: Rng, hitungKunci: Record<Huruf, number>, kunciTujuan?: Huruf): Huruf[] {
  if (s.opsiAngka) return urutanAngka(s);
  if (s.posisiTetap) return [...HURUF];
  let tujuan = kunciTujuan;
  if (!tujuan) {
    const min = Math.min(...HURUF.map((h) => hitungKunci[h]));
    tujuan = r.pick(HURUF.filter((h) => hitungKunci[h] === min));
  }
  const pengecoh = r.shuffle(HURUF.filter((h) => h !== s.kunci));
  const urutan: Huruf[] = [];
  for (const h of HURUF) urutan.push(h === tujuan ? s.kunci : pengecoh.shift()!);
  return urutan;
}

export function hitungKunciKosong(): Record<Huruf, number> {
  return { A: 0, B: 0, C: 0, D: 0 };
}
