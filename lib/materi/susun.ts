// Penyusun naskah materi dari data UKP (PRD-Materi bagian 7–8): aturan, kartu hafalan/rumus, kuis,
// dan contoh soal (model/orisinal; bank acuan hanya bila diminta). Deterministik untuk data dan pengaturan yang sama.
import { diujiDi, labelTingkat, ujianUntuk } from '../config';
import { dalamCakupan, tingkatAturan, tingkatSoal } from '../data';
import { dariModel } from '../generate';
import { kondisiTersedia, MODELS } from '../models';
import { cariJebakan } from '../quality';
import { dariBank, hitungKunciKosong, pilihUrutan, terapkanUrutan } from '../soal';
import type { Aturan, DataUkp, Kartu, Kode, Soal, Tingkat } from '../types';
import { rng, tanggal, type Rng } from '../util';
import { kalimat } from './metrik';
import type { AsalBlok, ButirKuis, Gambar, Ikon, Naskah, SlideNaskah } from './naskah';

export type Kepadatan = 'ringkas' | 'standar' | 'lengkap';
export type SumberSoalMateri = 'baru' | 'bank' | 'tanpa';

export interface PengaturanMateri {
  kode: Kode;
  subtema: string;
  /** Cakupan kumulatif: aturan di atas tingkat ini tidak dipakai. */
  tingkat: Tingkat;
  kepadatan: Kepadatan;
  tanggalAcuan: string;
  /** baru = model berparameter + bank orisinal (bawaan, KM3); bank = boleh memakai bank acuan LatihUKP. */
  sumberSoal: SumberSoalMateri;
  jumlahSoal: number;
  jumlahKuis: number;
  seed: string;
  dibuat: string;
  /** Deck gabungan per materi: subtema yang digabung (`subtema` kosong). */
  gabung?: string[];
}

export const PENGATURAN_MATERI_AWAL: Omit<PengaturanMateri, 'kode' | 'subtema' | 'tanggalAcuan' | 'dibuat'> = {
  tingkat: 'C', kepadatan: 'standar', sumberSoal: 'baru', jumlahSoal: 1, jumlahKuis: 3, seed: 'MATERI-01'
};

const KATA_SAMBUNG = /\s+(dan|atau|yang|serta|untuk|di|ke|dari|pada|dengan|&|,)$/i;

/** Label pendek dari judul aturan: bagian sebelum ":" atau ";", tanpa kurung bila perlu, dipotong di batas kata. */
export function labelPendek(judul: string, maks: number): { teks: string; dipotong: boolean } {
  let t = judul.split(/[:;]/)[0].trim();
  if (t.length > maks) t = t.replace(/\s*\([^)]*\)/g, '').trim();
  if (t.length <= maks) return { teks: t, dipotong: false };
  // Utamakan memotong tepat sebelum kata sambung ("Pemotong PPh 21/26 | dan pihak ...") agar frasa tetap utuh.
  // Kata sambung setara (dan/serta/atau) didahulukan: memotong sebelum "yang" pada "X dan Y yang Z" menyisakan "X dan Y" yang menggantung.
  for (const pola of [/\s+(?:dan|serta|atau)\s/gi, /\s+(?:yang|untuk|dengan|dalam|pada|bagi|sebagai)\s/gi]) {
    const calon = [...t.matchAll(pola)].map((m) => t.slice(0, m.index)).filter((x) => x.length >= 8 && x.length <= maks);
    if (calon.length) return { teks: calon[calon.length - 1], dipotong: true };
  }
  // Tanda baca di ujung potongan ("tanggal 15,") ikut dibuang.
  let potong = t.slice(0, maks + 1).replace(/\s+\S*$/, '').replace(/[,;.]+$/, '');
  while (KATA_SAMBUNG.test(potong)) potong = potong.replace(KATA_SAMBUNG, '').replace(/[,;.]+$/, '');
  return { teks: potong || t.slice(0, maks), dipotong: true };
}

export const berlakuPada = (a: Pick<Aturan, 'berlaku'>, tgl: string) => (!a.berlaku?.mulai || a.berlaku.mulai <= tgl) && (!a.berlaku?.sampai || a.berlaku.sampai >= tgl);

// ---------- pemetaan kartu hafalan/rumus dan kuis ke subtema ----------

const STOP = new Set('yang dan atau untuk dari pada dengan dalam atas oleh tidak bukan juga sebagai adalah ini itu wajib pajak dapat harus akan telah sudah lebih paling setiap bagi para serta karena tersebut'.split(' '));
const token = (t: string) => new Set(t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)));
const petaCache = new WeakMap<DataUkp, Map<string, string>>();

/** Kartu → "KODE|subtema": lewat ruleIds bila ada, selain itu kemiripan kata dengan aturan sekode. */
export function petaKartu(data: DataUkp): Map<string, string> {
  const ada = petaCache.get(data);
  if (ada) return ada;
  const aturan = new Map(data.aturan.map((a) => [a.id, a]));
  const tokenAturan = data.aturan.map((a) => ({ a, t: token(a.judul + ' ' + a.konsep + ' ' + a.pokok) }));
  const peta = new Map<string, string>();
  for (const k of data.materi.kartu) {
    const lewatId = k.ruleIds.map((id) => aturan.get(id)).find(Boolean);
    if (lewatId) { peta.set(k.id, lewatId.kode + '|' + lewatId.subtema); continue; }
    const tk = token(k.judul + ' ' + k.isi.join(' ') + ' ' + k.rumus.join(' '));
    let terbaik: Aturan | null = null, skor = 0;
    for (const { a, t } of tokenAturan) {
      if (a.kode !== k.kode || !t.size || !tk.size) continue;
      let sama = 0;
      for (const w of tk) if (t.has(w)) sama++;
      const s = sama / Math.sqrt(t.size * tk.size);
      if (s > skor) { skor = s; terbaik = a; }
    }
    if (terbaik && skor >= 0.12) peta.set(k.id, terbaik.kode + '|' + terbaik.subtema);
  }
  petaCache.set(data, peta);
  return peta;
}

interface KuisMentah { id: string; ref: string[]; tipe: string; teks: string; jawab?: boolean; jelas?: string }

export function kartuSubtema(data: DataUkp, kode: Kode, subtema: string): Kartu[] {
  const peta = petaKartu(data);
  return data.materi.kartu.filter((k) => peta.get(k.id) === kode + '|' + subtema).map((k) => (data.tulis.kartu[k.id] ? { ...k, ...data.tulis.kartu[k.id] } : k));
}

export function kuisSubtema(data: DataUkp, kode: Kode, subtema: string): ButirKuis[] {
  const kartu = new Set(kartuSubtema(data, kode, subtema).map((k) => k.id));
  return (data.materi.kuis as KuisMentah[])
    .filter((q) => q.tipe === 'bs' && typeof q.jawab === 'boolean' && q.ref.some((r) => kartu.has(r)))
    .map((q) => ({ id: q.id, teks: data.tulis.kuis[q.id]?.teks ?? q.teks, jawab: q.jawab!, jelas: data.tulis.kuis[q.id]?.jelas ?? q.jelas }));
}

// ---------- contoh soal ----------

interface ContohSoal { soal: Soal; asal: AsalBlok; label: string }

function urutkanOpsi(s: Soal, r: Rng): Soal {
  return terapkanUrutan(s, pilihUrutan(s, r, hitungKunciKosong()));
}

export function contohSoal(data: DataUkp, p: PengaturanMateri, r: Rng): { daftar: ContohSoal[]; catatan: string[] } {
  const catatan: string[] = [];
  const daftar: ContohSoal[] = [];
  if (p.sumberSoal === 'tanpa' || p.jumlahSoal <= 0) return { daftar, catatan };
  const ctx = { data, tanggalAcuan: p.tanggalAcuan };
  const cocok = (b: { kode: Kode; subtema: string; tingkat: Tingkat }) => b.kode === p.kode && b.subtema === p.subtema && dalamCakupan(tingkatSoal(b, data.mapping), p.tingkat);
  // Putaran pertama hanya soal berlabel tingkat deck (soal pendalaman di B/C), putaran kedua sisanya.
  // Di dalam satu putaran urutan sumber tetap: model, orisinal, lalu bank acuan bila diizinkan.
  for (const putaran of [true, false]) {
    const tingkatIni = (b: { kode: Kode; subtema: string; tingkat: Tingkat }) => (tingkatSoal(b, data.mapping) === p.tingkat) === putaran;
    const model = MODELS.filter((m) => cocok(m) && tingkatIni(m));
    for (let i = 0; i < p.jumlahSoal * 3 && daftar.length < p.jumlahSoal && model.length; i++) {
      const m = model[i % model.length];
      const kondisi = kondisiTersedia(m, ctx);
      if (!kondisi.length) continue;
      try {
        const s = urutkanOpsi(dariModel(m.buat(r, ctx, r.pick(kondisi)), m, data), r);
        if (!daftar.some((d) => d.soal.soal === s.soal)) daftar.push({ soal: s, asal: 'model', label: 'model ' + m.id });
      } catch { /* kondisi tidak berlaku pada tanggal acuan */ }
    }
    for (const b of data.orisinal.filter((x) => cocok(x) && tingkatIni(x))) {
      if (daftar.length >= p.jumlahSoal) break;
      daftar.push({ soal: urutkanOpsi(dariBank(b, data, 'orisinal'), r), asal: 'orisinal', label: 'orisinal ' + b.id });
    }
    if (daftar.length < p.jumlahSoal && p.sumberSoal === 'bank') {
      const bank = r.shuffle(data.bank.filter((b) => cocok(b) && !b.kasusId && tingkatIni(b)));
      for (const b of bank.slice(0, p.jumlahSoal - daftar.length)) daftar.push({ soal: urutkanOpsi(dariBank(b, data, 'bank'), r), asal: 'acuan', label: 'bank acuan ' + b.id });
    }
  }
  if (daftar.length < p.jumlahSoal) {
    catatan.push(p.sumberSoal === 'bank'
      ? `Contoh soal hanya ${daftar.length} dari ${p.jumlahSoal}: stok subtema ini habis.`
      : `Contoh soal hanya ${daftar.length} dari ${p.jumlahSoal}: belum ada model atau soal orisinal untuk subtema ini. Pilih sumber "bank acuan" (perlu konfirmasi) bila perlu.`);
  }
  return { daftar, catatan };
}

// ---------- penyusun ----------

const GAMBAR: Gambar[] = ['dokumen', 'bertanya'];

export function susunNaskah(data: DataUkp, p: PengaturanMateri): Naskah {
  const r = rng(`${p.seed}|${p.kode}|${p.subtema}|${p.tanggalAcuan}|${p.kepadatan}`);
  const catatan: string[] = [];
  const semua = data.aturan.filter((a) => a.kode === p.kode && a.subtema === p.subtema);
  if (!semua.length) throw new Error(`Subtema tidak ditemukan: ${p.kode} · ${p.subtema}`);
  // Teks tulis ulang (R2) menggantikan teks acuan per kartu aturan; slide dari teks itu berasal "ditulis ulang".
  const ditulis = (id: string) => !!data.tulis.aturan[id];
  const asalAturan = (xs: Aturan[]) => (xs.length && xs.every((a) => ditulis(a.id)) ? 'tulis' as const : 'acuan' as const);
  const aturan = semua.map((a) => (ditulis(a.id) ? { ...a, ...data.tulis.aturan[a.id] } : a)).filter((a) => {
    const t = tingkatAturan(a, data.mapping);
    if (!dalamCakupan(t, p.tingkat)) { catatan.push(`${a.id} tidak dipakai: tingkat ${t} di luar cakupan ${p.tingkat}.`); return false; }
    if (!berlakuPada(a, p.tanggalAcuan)) { catatan.push(`${a.id} tidak dipakai: tidak berlaku pada ${p.tanggalAcuan} (${a.berlaku.mulai ?? '…'} s.d. ${a.berlaku.sampai ?? 'sekarang'}).`); return false; }
    return true;
  });
  if (!aturan.length) throw new Error(`Tidak ada aturan ${p.kode} · ${p.subtema} yang berlaku pada ${p.tanggalAcuan} untuk tingkat ${p.tingkat}.`);
  const materi = data.mapping.materi.find((m) => m.kode === p.kode)?.nama ?? aturan[0].materi;
  const lengkap = p.kepadatan === 'lengkap', standar = p.kepadatan !== 'ringkas';

  // Label pendek per aturan (chip, navigasi, kartu ikhtisar, rangkuman).
  const label = aturan.map((a) => {
    const nav = labelPendek(a.judul, 26), chip = labelPendek(a.judul, 40);
    if (chip.dipotong) catatan.push(`${a.id}: judul dipendekkan menjadi "${chip.teks}"; periksa label.`);
    return { nav: nav.teks, chip: chip.teks, judul: labelPendek(a.judul, 90).teks };
  });
  const kuis = p.jumlahKuis > 0 ? r.shuffle(kuisSubtema(data, p.kode, p.subtema)).slice(0, p.jumlahKuis) : [];
  if (p.jumlahKuis > 0 && !kuis.length) catatan.push('Belum ada kuis Benar/Salah yang terpetakan ke subtema ini; slide kuis dilewati.');
  const soal = contohSoal(data, p, r);
  catatan.push(...soal.catatan);
  const adaLatihan = kuis.length > 0 || soal.daftar.length > 0;
  const perAturan = aturan.length <= 5;
  const nav = perAturan ? [...label.map((l) => l.nav), adaLatihan ? 'Latihan' : 'Rangkuman'] : ['Konsep', 'Ketentuan', 'Angka', 'Contoh', adaLatihan ? 'Latihan' : 'Rangkuman'];
  const bagian = (i: number, jenis: 'Konsep' | 'Ketentuan' | 'Angka' | 'Contoh') => (perAturan ? label[i].nav : jenis);
  const bagianAkhir = adaLatihan ? 'Latihan' : 'Rangkuman';

  const tingkatAda = [...new Set(aturan.map((a) => tingkatAturan(a, data.mapping)))].sort();
  const tingkatLabel = tingkatAda.length === 1 ? `Tingkat ${tingkatAda[0]}` : `Tingkat ${tingkatAda[0]}–${tingkatAda[tingkatAda.length - 1]}`;
  const slides: SlideNaskah[] = [];
  slides.push({ id: 'sampul', pola: 'P1', judul: p.subtema, pil: [materi, `${tingkatLabel} · UKP ${p.tanggalAcuan.slice(0, 4)}`], asal: 'otomatis', catatanPembicara: `Deck subtema ${p.kode} · ${p.subtema}. ${aturan.length} aturan, kepadatan ${p.kepadatan}, aturan per ${tanggal(p.tanggalAcuan)}.` });
  slides.push({
    id: 'ikhtisar', pola: 'P2', judul: materi, subjudul: p.subtema, asal: asalAturan(aturan), sumber: aturan.map((a) => a.id),
    kartu: [...aturan.map((a, i) => ({ judul: label[i].chip, isi: a.konsep, ikon: ((i % 5) + 1) as Ikon })), ...(adaLatihan ? [{ judul: 'Latihan', isi: 'Kuis cepat dan contoh soal berbasis kasus beserta pembahasan.' }] : [])]
  });

  aturan.forEach((a, i) => {
    const dasar = {
      chip: label[i].chip, ikon: ((i % 5) + 1) as Ikon, asal: asalAturan([a]), sumber: [a.id],
      catatanPembicara: `${a.id}${ditulis(a.id) ? " · teks ditulis ulang (belum ditelaah)" : ""} · keyakinan ${a.keyakinan ?? '-'} · berlaku sejak ${a.berlaku.mulai ? tanggal(a.berlaku.mulai) : '-'}${a.berlaku.sampai ? ' s.d. ' + tanggal(a.berlaku.sampai) : ''}\nDasar hukum: ${a.dasarHukum.join('; ')}${a.sumber.length ? '\nSumber: ' + a.sumber.map((x) => x.url).join(' ; ') : ''}`
    };
    slides.push({ ...dasar, id: a.id + '-konsep', bagian: bagian(i, 'Konsep'), pola: 'P3', judul: label[i].judul, pembuka: a.konsep, isi: a.pokok, sorotan: a.dasarHukum.length ? { label: 'Dasar hukum', teks: a.dasarHukum.join('; ') } : undefined, gambar: GAMBAR[i % 2] });
    if (!standar) return;
    const termasuk = a.syarat.length ? a.syarat : a.subjek ? a.subjek.split(/;\s*/).filter(Boolean) : [];
    if (termasuk.length && a.pengecualian.length) slides.push({ ...dasar, id: a.id + '-kontras', bagian: bagian(i, 'Ketentuan'), pola: 'P5', judul: 'Termasuk atau dikecualikan?', kiri: { judul: a.syarat.length ? 'Syarat' : 'Termasuk', poin: termasuk }, kanan: { judul: 'Dikecualikan', poin: a.pengecualian } });
    const angka = ([['Tarif dan DPP', a.tarifDpp], ['Ambang', a.ambang], ['Tenggat', a.tenggat]] as [string, string][]).filter(([, v]) => v && !/^lihat\s/i.test(v));
    if (angka.length) slides.push({ ...dasar, id: a.id + '-angka', bagian: bagian(i, 'Angka'), pola: 'P6', judul: 'Angka yang perlu diingat', kolom: ['Unsur', 'Ketentuan'], baris: angka, lebar: [1, 3.4] });
    if (lengkap) {
      const def = ([['Hak dan kewajiban', a.hakKewajiban], ['Konsekuensi', a.konsekuensi]] as [string, string][]).filter(([, v]) => v).map(([l, v]) => ({ label: l, isi: v }));
      if (def.length) slides.push({ ...dasar, id: a.id + '-definisi', bagian: bagian(i, 'Ketentuan'), pola: 'P4', judul: 'Hak, kewajiban, dan konsekuensi', item: def });
      const langkah = a.contoh[0] ? kalimat(a.contoh[0]).flatMap((k) => k.split(/\s*;\s*/)).filter(Boolean) : [];
      if (langkah.length >= 2) slides.push({ ...dasar, id: a.id + '-contoh', bagian: bagian(i, 'Contoh'), pola: 'P7', judul: 'Contoh penerapan', langkah, gambar: GAMBAR[(i + 1) % 2] });
      else if (a.contoh[0]) slides.push({ ...dasar, id: a.id + '-contoh', bagian: bagian(i, 'Contoh'), pola: 'P3', judul: 'Contoh penerapan', isi: a.contoh[0], gambar: GAMBAR[(i + 1) % 2] });
    }
    // Lengkap: satu slide kesalahan umum per aturan; Standar: dirangkum dalam satu tabel setelah semua aturan.
    if (lengkap && a.jebakan[0]) slides.push({ ...dasar, id: a.id + '-jebakan', bagian: bagian(i, 'Contoh'), pola: 'P10', judul: 'Kesalahan umum', keliru: { judul: 'Yang sering keliru', isi: a.jebakan[0] }, benar: { judul: 'Yang benar', isi: a.konsep } });
  });
  const jebakan = aturan.map((a, i) => [label[i].chip, a.jebakan[0] ?? ''] as [string, string]).filter(([, j]) => j);
  if (standar && !lengkap && jebakan.length) slides.push({ id: 'kesalahan-umum', pola: 'P6', judul: 'Kesalahan umum', pembuka: 'Pola jawaban keliru yang sering muncul pada subtema ini.', kolom: ['Topik', 'Yang sering keliru'], baris: jebakan, lebar: [1, 2.6], bagian: perAturan ? undefined : 'Contoh', chip: p.subtema, ikon: 2, asal: asalAturan(aturan.filter((a) => a.jebakan[0])), sumber: aturan.filter((a) => a.jebakan[0]).map((a) => a.id) });

  // Kartu rumus (standar) dan hafalan (lengkap) yang terpetakan ke subtema.
  if (standar) {
    for (const k of kartuSubtema(data, p.kode, p.subtema)) {
      if (k.status && k.status !== 'berlaku') continue;
      const kartuTulis = !!data.tulis.kartu[k.id];
      const dasar = { asal: kartuTulis ? 'tulis' as const : 'acuan' as const, sumber: [k.id], chip: labelPendek(k.judul, 40).teks, ikon: 3 as Ikon, bagian: perAturan ? undefined : 'Angka', catatanPembicara: `Kartu ${k.id} (${k.jenis})${kartuTulis ? ' · ditulis ulang' : ''}${k.dasar ? '\nDasar: ' + k.dasar : ''}${k.jebakan && !kartuTulis ? '\nJebakan: ' + k.jebakan : ''}` };
      if (k.jenis === 'rumus' && k.rumus.length) slides.push({ ...dasar, id: 'kartu-' + k.id, pola: 'P8', judul: labelPendek(k.judul, 90).teks, rumus: k.rumus, keterangan: k.rumusKet || undefined, contoh: k.contoh.length ? k.contoh : undefined });
      else if (lengkap && k.isi.length) slides.push({ ...dasar, id: 'kartu-' + k.id, pola: 'P6', judul: labelPendek(k.judul, 90).teks, kolom: ['Yang perlu dihafal'], baris: k.isi.map((t) => [t]) });
    }
  }

  if (kuis.length) slides.push({ id: 'kuis', pola: 'P11', judul: 'Kuis cepat', butir: kuis, bagian: bagianAkhir, chip: 'Latihan', ikon: 4, asal: kuis.every((q) => q.id && data.tulis.kuis[q.id]) ? 'tulis' : 'acuan', catatanPembicara: 'Kunci: ' + kuis.map((k, i) => `${i + 1} ${k.jawab ? 'Benar' : 'Salah'}`).join(' · ') });
  soal.daftar.forEach(({ soal: s, asal, label: asalLabel }, i) => {
    const no = soal.daftar.length > 1 ? ' ' + (i + 1) : '';
    const dasar = { bagian: bagianAkhir, chip: 'Latihan', ikon: 4 as Ikon, asal, sumber: s.sumberId ? [s.sumberId] : s.modelId ? ['model ' + s.modelId] : [] };
    // Soal tanpa kasus terpisah: kalimat terakhir menjadi pertanyaan (tebal), sisanya kasus.
    const k = s.kasus ? null : kalimat(s.soal);
    const kasus = s.kasus ?? (k && k.length > 1 ? k.slice(0, -1).join(' ') : undefined);
    const tanya = k && k.length > 1 ? k[k.length - 1] : s.soal;
    slides.push({ ...dasar, id: 'soal-' + (i + 1), pola: 'P12', judul: 'Contoh soal' + no, kasus, soal: tanya, opsi: { A: s.opsi.A, B: s.opsi.B, C: s.opsi.C, D: s.opsi.D }, catatanPembicara: `Soal ${asalLabel} · kunci ${s.kunci} · ${s.kesulitan}` });
    slides.push({ ...dasar, id: 'bahas-' + (i + 1), pola: 'P13', judul: 'Pembahasan' + no, kunci: s.kunci, teksKunci: s.opsi[s.kunci], inti: s.inti, langkah: s.langkah, dasar: s.dasarHukum.join('; ') || undefined, catatanPembicara: `Soal ${asalLabel} · kunci ${s.kunci}` });
  });
  if (standar) slides.push({ id: 'rangkuman', pola: 'P14', judul: 'Rangkuman', poin: aturan.map((a, i) => ({ judul: label[i].chip, isi: a.konsep })), bagian: perAturan ? undefined : 'Konsep', chip: p.subtema, ikon: 5, asal: asalAturan(aturan), sumber: aturan.map((a) => a.id) });
  slides.push({ id: 'penutup', pola: 'P15', judul: 'Terima kasih', asal: 'otomatis' });

  // Ketentuan lama di teks naskah (kecuali sisi "keliru" slide kesalahan umum yang memang membahasnya).
  for (const s of slides) {
    const teks = teksSlide(s);
    for (const j of cariJebakan(teks, { kode: p.kode, soal: '', kasus: null }, data.jebakan)) catatan.push(`${s.id}: kemungkinan ketentuan lama (${j.topik}) — ${j.pesan}`);
  }
  return { versi: 1, judul: p.subtema, subjudul: materi, kode: p.kode, materi, subtema: p.subtema, tingkat: p.tingkat, tanggalAcuan: p.tanggalAcuan, dibuat: p.dibuat, nav, slides, catatan };
}

/**
 * Deck gabungan satu materi untuk satu tingkat ujian: sampul materi, daftar isi subtema (tingkat mulai dan tanda
 * "baru"), lalu tiap subtema sebagai bagian berpembatas, dan satu penutup. Isi tiap bagian sama dengan deck
 * subtemanya pada tingkat itu; navigasi bawah mengikuti subtema masing-masing. `subtema` kosong = semua dalam cakupan.
 */
export function susunNaskahMateri(data: DataUkp, p: PengaturanMateri, subtema?: string[]): Naskah {
  const urut = data.mapping.materi.find((m) => m.kode === p.kode)?.subtema ?? [];
  const daftar = daftarSubtema(data, p.tingkat, p.tanggalAcuan).filter((s) => s.kode === p.kode && (!subtema || subtema.includes(s.subtema)))
    .sort((a, b) => urut.indexOf(a.subtema) - urut.indexOf(b.subtema));
  if (!daftar.length) throw new Error(`Materi ${p.kode} tidak punya subtema dalam cakupan ${labelTingkat(p.tingkat)} pada ${p.tanggalAcuan}.`);
  const materi = data.mapping.materi.find((m) => m.kode === p.kode)?.nama ?? p.kode;
  const baru = (t: Tingkat) => p.tingkat !== 'A' && t === p.tingkat;
  const nBaru = daftar.filter((s) => baru(s.tingkat)).length;
  const bagian = daftar.map((s) => ({ s, naskah: susunNaskah(data, { ...p, subtema: s.subtema }) }));
  const slides: SlideNaskah[] = [
    // Spasi di sekitar "/" supaya judul besar terputus di antara kata, bukan di tengah "PEMOTONGAN/PEMUNGUTAN".
    { id: 'sampul', pola: 'P1', judul: materi.replace(/\s*\/\s*/g, ' / '), pil: [labelTingkat(p.tingkat), `${daftar.length} subtema · UKP ${p.tanggalAcuan.slice(0, 4)}`], asal: 'otomatis',
      catatanPembicara: `Deck materi ${p.kode} untuk ${labelTingkat(p.tingkat)}: ${daftar.length} subtema, kepadatan ${p.kepadatan}, aturan per ${tanggal(p.tanggalAcuan)}.` },
    { id: 'daftar-isi', pola: 'P6', judul: 'Daftar isi', chip: materi, ikon: 1, bagian: 'Daftar isi', asal: 'otomatis',
      pembuka: `Subtema ${materi} yang diuji di ${labelTingkat(p.tingkat)}.` + (nBaru ? ` ${nBaru} subtema baru di Tingkat ${p.tingkat}.` : ''),
      kolom: ['No', 'Subtema', 'Diuji di', 'Mulai'], lebar: [0.6, 4, 1.4, 1.6], rapat: true,
      baris: daftar.map((s, i) => [String(i + 1), s.subtema, ujianUntuk(s.tingkat), 'Tingkat ' + s.tingkat + (baru(s.tingkat) ? ' (baru)' : '')]) },
  ];
  bagian.forEach(({ s, naskah }, i) => {
    const no = i + 1;
    slides.push({ id: `${no}-pembatas`, pola: 'P16', judul: s.subtema, subjudul: `Bagian ${no} dari ${daftar.length} · ${baru(s.tingkat) ? 'baru di Tingkat ' + p.tingkat : diujiDi(s.tingkat)}`, asal: 'otomatis' });
    for (const x of naskah.slides) {
      if (x.pola === 'P1' || x.pola === 'P15') continue;
      slides.push({ ...x, id: `${no}-${x.id}`, nav: naskah.nav, chip: x.chip ?? s.subtema });
    }
  });
  slides.push({ id: 'penutup', pola: 'P15', judul: 'Terima kasih', asal: 'otomatis' });
  const catatan = bagian.flatMap(({ s, naskah }, i) => (naskah.catatan ?? []).map((c) => `Bagian ${i + 1} (${s.subtema}): ${c}`));
  return { versi: 1, judul: `${materi} · ${labelTingkat(p.tingkat)}`, subjudul: labelTingkat(p.tingkat), kode: p.kode, materi, tingkat: p.tingkat, tanggalAcuan: p.tanggalAcuan, dibuat: p.dibuat, nav: ['Daftar isi'], slides, catatan };
}

/** Semua teks yang tampil di slide (untuk pemindaian ketentuan lama dan pencarian). */
export function teksSlide(s: SlideNaskah): string {
  const t: string[] = [s.judul];
  switch (s.pola) {
    case 'P1': t.push(...s.pil); break;
    case 'P2': t.push(s.subjudul ?? '', ...s.kartu.flatMap((k) => [k.judul, k.isi])); break;
    case 'P3': t.push(s.pembuka ?? '', s.isi, s.sorotan?.teks ?? ''); break;
    case 'P4': t.push(s.pembuka ?? '', ...s.item.flatMap((d) => [d.label, d.isi])); break;
    case 'P5': t.push(s.pembuka ?? '', s.kiri.judul, ...s.kiri.poin, s.kanan.judul, ...s.kanan.poin); break;
    case 'P6': t.push(s.pembuka ?? '', ...s.kolom, ...s.baris.flat()); break;
    case 'P7': t.push(s.pembuka ?? '', ...s.langkah); break;
    case 'P8': t.push(...s.rumus, s.keterangan ?? '', ...(s.contoh ?? [])); break;
    case 'P9': t.push(s.pembuka ?? '', ...s.angka.flatMap((a) => [a.nilai, a.label])); break;
    case 'P10': t.push(s.pembuka ?? '', s.benar.judul, s.benar.isi); break;
    case 'P11': t.push(...s.butir.map((b) => b.teks)); break;
    case 'P12': t.push(s.kasus ?? '', s.soal, ...Object.values(s.opsi)); break;
    case 'P13': t.push(s.teksKunci, s.inti, ...s.langkah, s.dasar ?? ''); break;
    case 'P14': t.push(...s.poin.flatMap((x) => [x.judul, x.isi])); break;
    case 'P15': case 'P16': break;
  }
  return t.filter(Boolean).join('\n');
}

/** Daftar subtema per materi untuk panel cakupan (jumlah aturan dan ketersediaan latihan). */
export function daftarSubtema(data: DataUkp, tingkat: Tingkat, tanggalAcuan: string) {
  const peta = new Map<string, { kode: Kode; subtema: string; tingkat: Tingkat; aturan: number; model: number; orisinal: number; kuis: number }>();
  for (const a of data.aturan) {
    const t = tingkatAturan(a, data.mapping);
    if (!dalamCakupan(t, tingkat) || !berlakuPada(a, tanggalAcuan)) continue;
    const k = a.kode + '|' + a.subtema;
    const e = peta.get(k) ?? { kode: a.kode, subtema: a.subtema, tingkat: t, aturan: 0, model: 0, orisinal: 0, kuis: 0 };
    e.aturan++;
    peta.set(k, e);
  }
  for (const e of peta.values()) {
    e.model = MODELS.filter((m) => m.kode === e.kode && m.subtema === e.subtema && dalamCakupan(tingkatSoal(m, data.mapping), tingkat)).length;
    e.orisinal = data.orisinal.filter((o) => o.kode === e.kode && o.subtema === e.subtema).length;
    e.kuis = kuisSubtema(data, e.kode, e.subtema).length;
  }
  return [...peta.values()];
}
