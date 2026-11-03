import { BATAS, HURUF, KESULITAN, PORSI_BARU_CAMPURAN, URUTAN_KODE } from './config';
import { cekPersediaan, hitungKuota, poolBank, totalBaris, type HasilCek, type Pool, type Sel } from './blueprint';
import { dalamCakupan, tingkatSoal } from './data';
import { kondisiTersedia, modelUntuk } from './models';
import type { HasilModel, KonteksModel, ModelSoal } from './models/types';
import { checksumSoal, dariBank, hitungKunciKosong, pilihUrutan, terapkanUrutan, urutanAngka } from './soal';
import type { BankSoal, BarisKuota, DataUkp, Huruf, Kesulitan, Paket, Pengaturan, Soal } from './types';
import { hash, normalTeks, rng, type Rng } from './util';

export class GalatPersediaan extends Error {
  constructor(public detail: string[]) {
    super('Persediaan tidak cukup: ' + detail.join(' '));
  }
}

export const tandaTeks = (s: Pick<Soal, 'soal' | 'opsi'>) => hash(normalTeks(s.soal) + '|' + Object.values(s.opsi).map(normalTeks).sort().join('|'));

/** Soal yang sudah dipakai: id bank, tanda model, dan tanda teks. */
export interface Terpakai { bank: Set<string>; tanda: Set<string>; teks: Set<string> }
export const terpakaiKosong = (): Terpakai => ({ bank: new Set(), tanda: new Set(), teks: new Set() });
export function catatTerpakai(t: Terpakai, s: Soal) {
  if (s.sumberId) t.bank.add(s.sumberId);
  t.tanda.add(s.tanda);
  t.teks.add(tandaTeks(s));
}
export function terpakaiDari(paket: Paket[]): Terpakai {
  const t = terpakaiKosong();
  for (const p of paket) for (const s of p.soal) catatTerpakai(t, s);
  return t;
}

export function dariModel(h: HasilModel, m: ModelSoal, data: DataUkp): Soal {
  const aturan = new Map(data.aturan.map((a) => [a.id, a]));
  const s: Soal = {
    uid: 'model:' + m.id + ':' + hash(JSON.stringify(h.params) + h.kondisi + h.konteks),
    asal: 'model',
    sumberId: null,
    modelId: m.id,
    tanda: m.id + '|' + h.kondisi + '|' + h.konteks,
    params: h.params,
    kode: m.kode,
    materi: data.mapping.materi.find((x) => x.kode === m.kode)?.nama ?? m.kode,
    subtema: m.subtema,
    subtopik: h.subtopik,
    tingkat: tingkatSoal(m, data.mapping),
    tipe: h.tipe,
    bloom: h.bloom,
    kesulitan: h.kesulitan,
    kasusId: null,
    kasus: null,
    soal: h.soal,
    opsi: { ...h.opsi },
    kunci: h.kunci,
    inti: h.inti,
    langkah: [...h.langkah],
    kenapaSalah: { ...h.kenapaSalah },
    penyebabSalah: { ...h.penyebabSalah },
    dasarHukum: [...h.dasarHukum],
    ruleIds: h.ruleIds.filter((id) => aturan.has(id)),
    catatanAturan: h.catatanAturan ?? null,
    poinIngat: h.poinIngat,
    urutanAsal: ['A', 'B', 'C', 'D'],
    posisiTetap: false,
    opsiAngka: h.opsiAngka,
    revisi: 1,
    disunting: false,
    checksum: '',
    kunciModel: h.kunciModel,
  };
  s.checksum = checksumSoal(s);
  return s;
}

export interface OpsiCoba {
  data: DataUkp;
  peng: Pengaturan;
  ctx: KonteksModel;
  r: Rng;
  kode: BankSoal['kode'];
  kesulitan: Kesulitan;
  subtema?: string;
  modelId?: string;
  global: Terpakai;
  lokal: Terpakai;
  kondisiPaket: Set<string>;
}

/** Coba buat satu soal model untuk sel (materi, kesulitan) yang belum kembar dengan soal lain. */
export function cobaModel(o: OpsiCoba): Soal | null {
  const kandidat = modelUntuk(o.kode).filter((m) => dalamCakupan(tingkatSoal(m, o.data.mapping), o.peng.tingkat)
    && (!o.modelId || m.id === o.modelId)
    && (!o.subtema || m.subtema === o.subtema)
    && (o.peng.jenis !== 'subtema' || o.peng.subtema.includes(m.kode + '::' + m.subtema))
    && kondisiTersedia(m, o.ctx).some((k) => m.kesulitan(k) === o.kesulitan));
  if (!kandidat.length) return null;
  for (let coba = 0; coba < 40; coba++) {
    const m = o.r.pick(kandidat);
    const kondisiCocok = kondisiTersedia(m, o.ctx).filter((k) => m.kesulitan(k) === o.kesulitan);
    const segar = kondisiCocok.filter((k) => !o.kondisiPaket.has(m.id + '|' + k));
    const kondisi = o.r.pick(segar.length && coba < 30 ? segar : kondisiCocok);
    let s: Soal;
    try { s = dariModel(m.buat(o.r, o.ctx, kondisi), m, o.data); } catch { continue; }
    if (o.lokal.tanda.has(s.tanda) || o.lokal.teks.has(tandaTeks(s))) continue;
    if (o.peng.larangKembar && o.global.tanda.has(s.tanda)) continue;
    o.kondisiPaket.add(m.id + '|' + kondisi);
    return s;
  }
  return null;
}

function bebas(b: BankSoal, global: Terpakai, lokal: Terpakai, larang: boolean) {
  if (lokal.bank.has(b.id)) return false;
  if (larang && global.bank.has(b.id)) return false;
  const t = tandaTeks(b);
  return !lokal.teks.has(t) && !(larang && global.teks.has(t));
}

/** Huruf kunci soal yang urutannya tetap (opsi angka diurutkan naik / posisi dikunci); null bila opsinya bebas diacak. */
export function kunciTetap(s: Soal): Huruf | null {
  if (s.opsiAngka) return HURUF[urutanAngka(s).indexOf(s.kunci)];
  return s.posisiTetap ? s.kunci : null;
}

/** Kesulitan pengganti terdekat bila stok satu kesulitan habis (R6). */
const TETANGGA: Record<Kesulitan, Kesulitan[]> = { mudah: ['sedang', 'sulit'], sedang: ['mudah', 'sulit'], sulit: ['sedang', 'mudah'] };

function rakitBaris(data: DataUkp, peng: Pengaturan, baris: BarisKuota, pool: Pool, ctx: KonteksModel, r: Rng, global: Terpakai, lokal: Terpakai, kondisiPaket: Set<string>, kurang: string[], label: string, tetap: Record<Huruf, number>, geser: string[], sisaPaket = 1): Soal[][] {
  const unit: Soal[][] = [];
  const butuh: Sel = { mudah: baris.mudah, sedang: baris.sedang, sulit: baris.sulit };
  const ambil = (soal: Soal[]) => { unit.push(soal); for (const s of soal) { catatTerpakai(lokal, s); butuh[s.kesulitan]--; const h = kunciTetap(s); if (h) tetap[h]++; } };
  // Sumber "baru" hanya memakai bank orisinal (bukan salinan LatihUKP) selain model.
  const boleh = (b: BankSoal) => peng.sumber !== 'baru' || b.bank === 'orisinal';
  // 1. Blok kasus utuh sampai target soal kasus tercapai. Ukuran blok 2–4 soal dan sebaran kesulitannya
  // tidak selalu pas dengan sisa sel, jadi dicoba beberapa urutan dan diambil yang paling dekat ke target.
  if (baris.kasus > 0) {
    const calon = pool.blok.filter((b) => b.kode === baris.kode && b.anggota.every((x) => boleh(x) && bebas(x, global, lokal, peng.larangKembar)));
    let terbaik: BankSoal[][] = [], kasusTerbaik = -1;
    for (let coba = 0; coba < 12 && kasusTerbaik < baris.kasus; coba++) {
      const sisa: Sel = { ...butuh };
      const pilih: BankSoal[][] = [];
      let kasus = 0;
      for (const bl of r.shuffle(calon)) {
        if (kasus + bl.anggota.length > baris.kasus) continue;
        const perSel: Sel = { mudah: 0, sedang: 0, sulit: 0 };
        for (const b of bl.anggota) perSel[b.kesulitan]++;
        if (KESULITAN.some((d) => perSel[d] > sisa[d])) continue;
        for (const d of KESULITAN) sisa[d] -= perSel[d];
        pilih.push(bl.anggota);
        kasus += bl.anggota.length;
      }
      if (kasus > kasusTerbaik) { kasusTerbaik = kasus; terbaik = pilih; }
    }
    for (const anggota of terbaik) ambil(anggota.map((b) => dariBank(b, data)));
  }
  // 2. Soal baru dari model.
  const adaModel = modelUntuk(baris.kode).length > 0;
  const sisa = () => KESULITAN.reduce((a, d) => a + butuh[d], 0);
  let targetModel = 0;
  if (peng.sumber === 'baru') targetModel = sisa();
  else if (peng.sumber === 'campuran' && adaModel && peng.jenis !== 'jebakan') targetModel = Math.min(sisa(), Math.round((totalBaris(baris) - baris.kasus) * PORSI_BARU_CAMPURAN));
  const isiModel = (jumlah: number) => {
    for (let i = 0; i < jumlah; i++) {
      const sel = r.shuffle(KESULITAN.filter((d) => butuh[d] > 0)).sort((a, b) => butuh[b] - butuh[a]);
      let dapat = false;
      for (const d of sel) {
        // Beberapa calon; pilih yang posisi kuncinya (setelah opsi angka diurutkan) paling jarang di paket ini,
        // supaya soal berurutan tetap tidak menumpuk di satu huruf yang tidak bisa diimbangi soal lain.
        let terbaik: Soal | null = null, skor = Infinity, kondisiTerbaik: Set<string> | null = null;
        for (let c = 0; c < 4; c++) {
          const salinan = new Set(kondisiPaket);
          const s = cobaModel({ data, peng, ctx, r, kode: baris.kode, kesulitan: d, global, lokal, kondisiPaket: salinan });
          if (!s) break;
          const h = kunciTetap(s);
          const nilai = h ? tetap[h] : -1;
          if (nilai < skor) { terbaik = s; skor = nilai; kondisiTerbaik = salinan; }
          if (nilai <= Math.min(...HURUF.map((x) => tetap[x]))) break;
        }
        if (terbaik) { for (const k of kondisiTerbaik!) kondisiPaket.add(k); ambil([terbaik]); dapat = true; break; }
      }
      if (!dapat) break;
    }
  };
  const isiBank = (jatah: (d: Kesulitan, calon: number) => number = () => Infinity) => {
    for (const d of KESULITAN) {
      if (butuh[d] <= 0) continue;
      const calon = r.shuffle(pool.tunggal.filter((b) => b.kode === baris.kode && b.kesulitan === d && boleh(b)));
      let sisaJatah = jatah(d, calon.filter((b) => bebas(b, global, lokal, peng.larangKembar)).length);
      for (const b of calon) {
        if (butuh[d] <= 0 || sisaJatah <= 0) break;
        if (bebas(b, global, lokal, peng.larangKembar)) { ambil([dariBank(b, data)]); sisaJatah--; }
      }
    }
  };
  // Sumber "baru": soal orisinal lebih dulu (menjangkau subtema konsep yang tidak punya model), dibagi rata
  // antarpaket bila soal kembar dilarang (sisa stok ÷ sisa paket); sisanya diisi model.
  // Paket awal tidak mengambil lebih dari bagian adilnya (dibulatkan ke bawah); sisa pembulatan jatuh ke paket akhir,
  // saat stok model paling tipis.
  if (peng.sumber === 'baru') isiBank((_, n) => (peng.larangKembar ? Math.floor(n / sisaPaket) : Infinity));
  if (targetModel > 0) isiModel(peng.sumber === 'baru' ? sisa() : targetModel);
  // 3. Soal tunggal dari bank (sumber "baru": bank orisinal saja).
  isiBank();
  // 4. Sisa sel pada campuran boleh diisi model dengan materi dan kesulitan yang sama.
  if (peng.sumber === 'campuran' && adaModel && sisa() > 0) isiModel(sisa());
  // 5. Soal tunggal habis: blok kasus tambahan yang muat di sisa sel (soal kasus bisa sedikit di atas target).
  if (sisa() > 0) {
    for (const bl of r.shuffle(pool.blok.filter((b) => b.kode === baris.kode))) {
      if (sisa() <= 0) break;
      if (!bl.anggota.every((x) => boleh(x) && bebas(x, global, lokal, peng.larangKembar))) continue;
      const perSel: Sel = { mudah: 0, sedang: 0, sulit: 0 };
      for (const b of bl.anggota) perSel[b.kesulitan]++;
      if (KESULITAN.some((d) => perSel[d] > butuh[d])) continue;
      ambil(bl.anggota.map((b) => dariBank(b, data)));
    }
  }
  // 6. Stok satu kesulitan habis (biasanya pada banyak paket tanpa soal kembar): isi dari kesulitan terdekat
  // pada materi yang sama, lalu catat pergeserannya. Materi dan jumlah soal per materi tidak berubah.
  for (const d of KESULITAN) {
    for (const alt of TETANGGA[d]) {
      let n = 0;
      const ambilGanti = (s: Soal) => { unit.push([s]); catatTerpakai(lokal, s); butuh[d]--; n++; const h = kunciTetap(s); if (h) tetap[h]++; };
      for (const b of r.shuffle(pool.tunggal.filter((x) => x.kode === baris.kode && x.kesulitan === alt && boleh(x)))) {
        if (butuh[d] <= 0) break;
        if (bebas(b, global, lokal, peng.larangKembar)) ambilGanti(dariBank(b, data));
      }
      while (butuh[d] > 0 && adaModel && peng.sumber !== 'bank' && peng.jenis !== 'jebakan') {
        const s = cobaModel({ data, peng, ctx, r, kode: baris.kode, kesulitan: alt, global, lokal, kondisiPaket });
        if (!s) break;
        ambilGanti(s);
      }
      if (n) geser.push(`${label} · ${baris.kode}: ${n} soal ${d} diganti ${alt} (stok ${d} habis)`);
      if (butuh[d] <= 0) break;
    }
  }
  for (const d of KESULITAN) if (butuh[d] > 0) kurang.push(label + ' · ' + baris.kode + ' · ' + d + ': kurang ' + butuh[d] + ' soal.');
  return unit;
}

/**
 * Urutkan opsi tiap soal sambil menyeimbangkan posisi kunci dalam satu paket. Soal yang urutannya tetap
 * (opsi angka diurutkan naik, rujukan huruf dalam kurung) dihitung lebih dulu, karena kunci opsi angka
 * cenderung jatuh di B; soal lain lalu mengisi huruf yang paling jarang.
 */
export function seimbangkanKunci(soal: Soal[], r: Rng): Soal[] {
  const hitung = hitungKunciKosong();
  const hasil: Soal[] = soal.map((s) => {
    if (!s.opsiAngka && !s.posisiTetap) return s;
    const t = terapkanUrutan(s, pilihUrutan(s, r, hitung));
    hitung[t.kunci]++;
    return t;
  });
  return hasil.map((s, i) => {
    if (soal[i].opsiAngka || soal[i].posisiTetap) return s;
    const t = terapkanUrutan(s, pilihUrutan(s, r, hitung));
    hitung[t.kunci]++;
    return t;
  });
}

export interface HasilGenerate {
  paket: Paket[];
  baris: BarisKuota[];
  cek: HasilCek;
  /** Sel yang diisi dari kesulitan lain karena stok habis (R6); kosong pada kondisi biasa. */
  geser: string[];
}

export function cekBatas(peng: Pengaturan): string[] {
  const g: string[] = [];
  if (peng.jumlahPaket < 1 || peng.jumlahPaket > BATAS.paket) g.push('Jumlah paket harus 1–' + BATAS.paket + '.');
  if (peng.jumlahSoal < 1 || peng.jumlahSoal > BATAS.soalPerPaket) g.push('Jumlah soal per paket harus 1–' + BATAS.soalPerPaket + '.');
  if (peng.jumlahSoal * peng.jumlahPaket > BATAS.soalPerProses) g.push('Satu proses paling banyak ' + BATAS.soalPerProses + ' soal.');
  if (!peng.materi.length) g.push('Pilih minimal satu materi.');
  if (peng.jenis === 'subtema' && !peng.subtema.length) g.push('Pilih minimal satu subtema.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(peng.tanggalAcuan)) g.push('Tanggal acuan harus berformat YYYY-MM-DD.');
  return g;
}

/** Rakit paket menurut pengaturan. Melempar GalatPersediaan bila stok tidak cukup. */
export function buatPaket(data: DataUkp, peng: Pengaturan, sudahAda: Paket[] = []): HasilGenerate {
  const batas = cekBatas(peng);
  if (batas.length) throw new GalatPersediaan(batas);
  const ctx: KonteksModel = { data, tanggalAcuan: peng.tanggalAcuan };
  const baris = peng.kuota ?? hitungKuota(data, peng, ctx);
  const cek = cekPersediaan(data, peng, baris, ctx);
  if (!cek.ok) throw new GalatPersediaan(cek.pesan);
  const pool = poolBank(data, peng);
  const global = terpakaiDari(sudahAda);
  const kurang: string[] = [];
  const geser: string[] = [];
  const paket: Paket[] = [];
  for (let nomor = 1; nomor <= peng.jumlahPaket; nomor++) {
    const lokal = terpakaiKosong();
    const kondisiPaket = new Set<string>();
    const tetap = hitungKunciKosong();
    const label = 'Paket ' + nomor;
    const perKode: Soal[][][] = [];
    for (const b of baris) {
      if (!totalBaris(b)) continue;
      const r = rng(peng.seed + '|paket-' + nomor + '|' + b.kode);
      perKode.push(rakitBaris(data, peng, b, pool, ctx, r, global, lokal, kondisiPaket, kurang, label, tetap, geser, peng.jumlahPaket - nomor + 1));
    }
    const r = rng(peng.seed + '|paket-' + nomor + '|urutan');
    const unit = peng.urutan === 'acak'
      ? r.shuffle(perKode.flat())
      : URUTAN_KODE.flatMap((k) => perKode.filter((u) => u[0]?.[0]?.kode === k).flatMap((u) => r.shuffle(u)));
    const soal = seimbangkanKunci(unit.flat(), r);
    for (const s of soal) catatTerpakai(global, s);
    paket.push({ id: 'P' + nomor, nomor, seed: peng.seed + '|paket-' + nomor, soal });
  }
  if (kurang.length) throw new GalatPersediaan(kurang);
  return { paket, baris, cek, geser };
}

export const posisiKunci = (soal: Soal[]): Record<Huruf, number> => {
  const h = hitungKunciKosong();
  for (const s of soal) h[s.kunci]++;
  return h;
};
