// Impor snapshot LatihUKP (../Scrape UKP/output/latihukp) menjadi data UKP Studio.
// Pemakaian: node scripts/import-latihukp.mjs [--sumber <folder latihukp>]
// Menulis data/ukp-bank.json, data/ukp-rules.json, data/ukp-materi.json, data/ukp-mapping.json
// (bagian override dipertahankan), data/import-report.json, lalu menyalin berkas data ke public/data/.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SUMBER = path.resolve(arg('--sumber', path.join(ROOT, '..', 'Scrape UKP', 'output', 'latihukp')));
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(ROOT, 'public', 'data');

const MATERI = [
  ['KUP', 'KUP, PPSP & Pengadilan Pajak'],
  ['OP', 'PPh Orang Pribadi & SPT PPh OP'],
  ['PP', 'PPh Pemotongan/Pemungutan'],
  ['PPN', 'PPN & SPT PPN'],
  ['BM', 'Bea Meterai'],
  ['PBB', 'PBB-P5L'],
  ['AKT', 'Akuntansi Perpajakan'],
  ['BDN', 'PPh Badan (dalam negeri)'],
  ['BTI', 'PPh Badan (transaksi internasional)'],
  ['INT', 'Pajak Internasional'],
];
const NAMA = Object.fromEntries(MATERI);
const HURUF = ['A', 'B', 'C', 'D'];
const TINGKAT = ['A', 'B', 'C'];

function baca(nama) {
  const file = path.join(SUMBER, nama);
  if (!existsSync(file)) throw new Error('Berkas sumber tidak ada: ' + file);
  const teks = readFileSync(file, 'utf8');
  return { data: JSON.parse(teks), sha256: createHash('sha256').update(teks).digest('hex') };
}
const bersih = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const tanpaNomor = (s) => bersih(s).replace(/^\d+[.)]\s*/, '');

// Kesulitan: bank EASY memakai easy/medium; bank HARD memakai tingkat_ujian dibanding ujian asli.
function kesulitan(x) {
  if (x.level === 'easy') return { kesulitan: x.kesulitan === 'medium' ? 'sedang' : 'mudah', kesulitanSumber: x.kesulitan || 'easy' };
  const t = x.tingkat_ujian || 'setara';
  return { kesulitan: t === 'setara' ? 'sedang' : 'sulit', kesulitanSumber: t };
}

// Opsi angka murni (Rupiah, angka, persen) diurutkan naik oleh generator (PRD bagian 10 butir 7).
const RE_ANGKA = /^\s*-?\s*(Rp\s?)?-?[\d.]+(,\d+)?\s*(%|persen)?\s*$/i;
const nilaiAngka = (s) => Number(s.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.'));

// Rujukan huruf opsi di teks pembahasan. Generator memetakannya ulang saat opsi diacak.
// "(A)" dalam kurung tidak bisa dibedakan dari butir peraturan, jadi soal semacam itu dikunci urutannya.
const RE_RUJUKAN_KURUNG = /(?<![\w(])\(([A-D])\)(?![\w])/;

const STOP = new Set('yang dan atau atas dari untuk dengan pada di ke dalam adalah sebagai oleh ini itu tidak wajib serta bagi jika maka akan telah sudah belum harus dapat tersebut setelah sebelum paling lambat tahun bulan hari secara antara karena berapa besarnya berikut kecuali termasuk masing hal tetapi juga lain sama bila apabila tanpa per tiap setiap the of pt cv rp'.split(' '));
const token = (s) => bersih(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 2 && !STOP.has(w));

function main() {
  const q = baca('questions.json');
  const r = baca('rules.json');
  const c = baca('cards.json');
  const z = baca('quizzes.json');
  const t = baca('topics.json');
  const src = baca('sources.json');
  const laporanSumber = baca('report.json');

  const aturan = r.data.map((x) => ({
    id: x.id, kode: x.g, materi: NAMA[x.g] ?? x.tema, subtema: bersih(x.subtema), judul: bersih(x.judul),
    tingkat: x.tingkat_kisi, keyakinan: x.keyakinan ?? null,
    dasarHukum: (x.dasar_hukum ?? []).map(bersih),
    berlaku: { mulai: x.berlaku?.mulai ?? null, sampai: x.berlaku?.sampai ?? null, catatan: bersih(x.berlaku?.catatan) },
    konsep: bersih(x.konsep), pokok: bersih(x.pokok), subjek: bersih(x.subjek),
    syarat: (x.syarat ?? []).map(bersih), tarifDpp: bersih(x.tarif_dpp), ambang: bersih(x.ambang), tenggat: bersih(x.tenggat),
    pengecualian: (x.pengecualian ?? []).map(bersih), hakKewajiban: bersih(x.hak_kewajiban), konsekuensi: bersih(x.konsekuensi),
    contoh: Array.isArray(x.contoh) ? x.contoh.map((e) => (typeof e === 'string' ? bersih(e) : bersih(JSON.stringify(e)))) : (x.contoh ? [bersih(typeof x.contoh === 'string' ? x.contoh : JSON.stringify(x.contoh))] : []),
    jebakan: Array.isArray(x.jebakan) ? x.jebakan.map(bersih) : (x.jebakan ? [bersih(x.jebakan)] : []),
    bedaDengan: Array.isArray(x.beda_dengan) ? x.beda_dengan.map((e) => (typeof e === 'string' ? bersih(e) : bersih(JSON.stringify(e)))) : [],
    sumber: (x.sumber ?? []).map((s) => ({ judul: bersih(s.judul), url: s.url })),
  }));
  const aturanById = new Map(aturan.map((a) => [a.id, a]));

  // Urutan subtema per materi mengikuti urutan kemunculan di kartu aturan.
  const subtemaPerKode = {};
  for (const a of aturan) {
    const daftar = (subtemaPerKode[a.kode] ??= []);
    if (!daftar.includes(a.subtema)) daftar.push(a.subtema);
  }
  // Profil token per subtema untuk soal yang rujukan aturannya kosong atau rusak.
  const profil = {};
  for (const a of aturan) {
    const p = ((profil[a.kode] ??= {})[a.subtema] ??= new Map());
    for (const w of [...token(a.subtema), ...token(a.subtema), ...token(a.judul), ...token(a.konsep), ...token(a.pokok)]) p.set(w, (p.get(w) ?? 0) + 1);
  }
  // Skor dinormalkan dengan ukuran kosakata subtema (pangkat 0,45) supaya subtema yang kartunya banyak tidak
  // selalu menang; kata subtopik yang sama dengan nama subtema mendapat bonus kecil. Setelan ini dipilih dari uji
  // pada soal yang subtemanya diketahui lewat rujukan aturan (akurasinya dicatat di import-report.json).
  function tebakSubtema(kode, subtopik, teks) {
    const kandidat = profil[kode] ?? {};
    const kata = new Set(token(teks));
    const kataSubtopik = new Set(token(subtopik));
    let terbaik = null, skor = 0;
    for (const [sub, p] of Object.entries(kandidat)) {
      let s = 0;
      for (const w of kata) if (p.has(w)) s += 1 + Math.log(p.get(w));
      s /= Math.pow(p.size, 0.45);
      for (const w of token(sub)) if (kataSubtopik.has(w)) s += 0.2;
      if (s > skor) { skor = s; terbaik = sub; }
    }
    return terbaik;
  }
  const teksTebak = (x) => [x.subtopik, x.subtopik, x.soal, x.inti].join(' ');

  const hitung = { subtemaAturan: 0, subtemaKemiripan: 0, subtemaLainnya: 0, posisiTetap: 0, opsiAngka: 0 };
  const rujukanHilang = [];
  const peringatan = [];
  const soal = q.data.map((x) => {
    const opsi = Object.fromEntries(HURUF.map((h) => [h, bersih(x.opsi?.[h])]));
    const ruleIds = (x.rule_ids ?? []).filter((id) => aturanById.has(id));
    const hilang = (x.rule_ids ?? []).filter((id) => !aturanById.has(id));
    if (hilang.length) rujukanHilang.push({ id: x.id, hilang });
    const sendiri = ruleIds.map((id) => aturanById.get(id)).find((a) => a.kode === x.g);
    let subtema, subtemaDasar;
    if (sendiri) { subtema = sendiri.subtema; subtemaDasar = 'aturan'; hitung.subtemaAturan++; }
    else {
      const tebak = tebakSubtema(x.g, x.subtopik, teksTebak(x));
      if (tebak) { subtema = tebak; subtemaDasar = 'kemiripan'; hitung.subtemaKemiripan++; }
      else { subtema = 'Lainnya'; subtemaDasar = 'lainnya'; hitung.subtemaLainnya++; }
    }
    const teksBahas = [x.inti, ...(x.langkah ?? []), ...Object.values(x.kenapa_salah ?? {}), x.catatan_aturan ?? '', x.poin_ingat ?? ''].join(' ');
    const posisiTetap = RE_RUJUKAN_KURUNG.test(teksBahas);
    if (posisiTetap) hitung.posisiTetap++;
    const opsiAngka = HURUF.every((h) => RE_ANGKA.test(opsi[h]) && Number.isFinite(nilaiAngka(opsi[h])));
    if (opsiAngka) hitung.opsiAngka++;
    if (!HURUF.includes(x.kunci)) peringatan.push(x.id + ': kunci tidak valid ' + x.kunci);
    return {
      id: x.id,
      bank: x.level === 'easy' ? 'easy' : 'hard',
      paketSumber: x.paket ?? null,
      kode: x.g,
      materi: NAMA[x.g],
      subtema, subtemaDasar,
      subtopik: bersih(x.subtopik),
      tingkat: x.tingkat_kisi,
      tipe: bersih(x.tipe),
      bloom: x.bloom ?? null,
      ...kesulitan(x),
      kategori: x.kategori ?? null,
      kasusId: x.kasus_id || null,
      kasus: bersih(x.kasus) || null,
      soal: bersih(x.soal),
      opsi,
      kunci: x.kunci,
      inti: bersih(x.inti),
      langkah: (x.langkah ?? []).map(tanpaNomor).filter(Boolean),
      kenapaSalah: Object.fromEntries(Object.entries(x.kenapa_salah ?? {}).map(([k, v]) => [k, bersih(v)])),
      penyebabSalah: x.penyebab_salah ?? {},
      dasarHukum: (x.dasar_hukum ?? []).map(bersih),
      ruleIds,
      catatanAturan: bersih(x.catatan_aturan) || null,
      poinIngat: bersih(x.poin_ingat) || null,
      keyakinan: x.keyakinan ?? null,
      posisiTetap,
      opsiAngka,
      sumber: (x.sumber ?? []).map((s) => ({ judul: bersih(s.judul), url: s.url })),
    };
  });

  // Akurasi tebakan subtema diukur pada soal yang subtemanya diketahui dari rujukan aturan.
  const berlabel = soal.filter((s) => s.subtemaDasar === 'aturan');
  const asal = new Map(q.data.map((x) => [x.id, x]));
  const tepat = berlabel.filter((s) => tebakSubtema(s.kode, s.subtopik, teksTebak(asal.get(s.id))) === s.subtema).length;
  hitung.akurasiTebakSubtema = Math.round((tepat / berlabel.length) * 1000) / 10;

  // Blok kasus: tingkat blok = tingkat tertinggi soal di dalamnya, supaya blok utuh hanya masuk paket yang mencakup semuanya.
  const blok = {};
  for (const s of soal.filter((s) => s.kasusId)) (blok[s.kasusId] ??= []).push(s);
  let blokCampurTingkat = 0;
  for (const anggota of Object.values(blok)) {
    const maks = anggota.map((s) => s.tingkat).sort().at(-1);
    if (new Set(anggota.map((s) => s.tingkat)).size > 1) blokCampurTingkat++;
    for (const s of anggota) s.tingkatBlok = maks;
  }

  const materiData = {
    topik: t.data.map((x) => ({ id: x.id, judul: x.judul, eyebrow: x.eyebrow ?? null, bagian: x.bagian ?? [] })),
    kartu: c.data.map((x) => ({
      id: x.id, jenis: x.t, kode: x.g, judul: bersih(x.judul), isi: (x.isi ?? []).map(bersih),
      rumus: (x.rumus ?? []).map(bersih), rumusKet: bersih(typeof x.rumus_ket === 'string' ? x.rumus_ket : Array.isArray(x.rumus_ket) ? x.rumus_ket.join(' ') : ''),
      contoh: (Array.isArray(x.contoh) ? x.contoh : x.contoh ? [x.contoh] : []).map((e) => bersih(typeof e === 'string' ? e : JSON.stringify(e))),
      jebakan: bersih(x.jebakan), dasar: bersih(x.dasar), status: x.status ?? null, sejak: x.sejak ?? null, ruleIds: x.rule_ids ?? [],
    })),
    kuis: z.data.map((x) => { const { _archive, ...rest } = x; return rest; }),
  };

  // Mapping: hitungan otomatis + bagian override yang disunting tangan dipertahankan.
  const fileMapping = path.join(DATA, 'ukp-mapping.json');
  const lama = existsSync(fileMapping) ? JSON.parse(readFileSync(fileMapping, 'utf8')) : {};
  const stok = {};
  const stokSubtema = {};
  for (const s of soal) {
    const m = ((stok[s.kode] ??= { A: 0, B: 0, C: 0 }));
    m[s.tingkat]++;
    ((stokSubtema[s.kode + '::' + s.subtema] ??= { A: 0, B: 0, C: 0 }))[s.tingkat]++;
  }
  // Tingkat subtema (cakupan materi, PRD K3): tingkat terendah yang punya minimal 5 soal dan minimal 15%
  // dari soal subtema itu; bila tidak ada, tingkat dengan soal terbanyak; tanpa soal, tingkat kartu aturan terendah.
  const tingkatSubtema = {};
  for (const [kode] of MATERI) {
    for (const st of subtemaPerKode[kode] ?? []) {
      const c = stokSubtema[kode + '::' + st] ?? { A: 0, B: 0, C: 0 };
      const total = c.A + c.B + c.C;
      const berarti = TINGKAT.find((t) => c[t] >= 5 && c[t] >= 0.15 * total);
      const terbanyak = TINGKAT.reduce((a, t) => (c[t] > c[a] ? t : a), 'A');
      const dariAturan = TINGKAT.find((t) => aturan.some((a) => a.kode === kode && a.subtema === st && a.tingkat === t)) ?? 'C';
      tingkatSubtema[kode + '::' + st] = berarti ?? (total ? terbanyak : dariAturan);
    }
  }
  const mapping = {
    _keterangan: 'Pemetaan tingkat UKP. "subtema" = tingkat tiap subtema (cakupan materi), dihitung dari label tingkat_kisi soal bank: tingkat terendah dengan minimal 5 soal dan minimal 15% soal subtema itu. Tingkat soal dan model = yang lebih tinggi antara tingkat subtema dan labelnya sendiri; kartu aturan ikut tingkat subtema. Cakupan kumulatif (A, A+B, A+B+C). Isi "override" untuk mengganti tingkat subtema per materi atau per materi::subtema, misalnya {"KUP::Sanksi administrasi": "C"}. Disahkan terhadap Cakupan Materi UKP BPPK (PRD K3). Bagian selain override ditulis ulang oleh npm run import:data.',
    tingkat: TINGKAT.map((k, i) => ({ kode: k, nama: 'Tingkat ' + k, cakupan: TINGKAT.slice(0, i + 1) })),
    materi: MATERI.map(([kode, nama]) => ({ kode, nama, subtema: subtemaPerKode[kode] ?? [], stok: stok[kode] ?? { A: 0, B: 0, C: 0 } })),
    subtema: tingkatSubtema,
    siadu: { category: 'UKP Tingkat {tingkat}', lesson: '{materi}', chapter: '{subtema}' },
    override: lama.override ?? {},
  };

  const bank = {
    versi: 1,
    sumber: { nama: 'LatihUKP', url: 'https://latihukp.vercel.app/', diambil: src.data.fetchedAt ?? laporanSumber.data.fetchedAt ?? null, status: 'acuan-internal', catatan: 'Salinan sumber, belum diverifikasi independen. Bukan soal ujian resmi BPPK/DJP.' },
    soal,
  };
  const laporan = {
    dibuat: new Date().toISOString(),
    folderSumber: SUMBER,
    hash: { questions: q.sha256, rules: r.sha256, cards: c.sha256, quizzes: z.sha256, topics: t.sha256 },
    jumlah: {
      soal: soal.length, easy: soal.filter((s) => s.bank === 'easy').length, hard: soal.filter((s) => s.bank === 'hard').length,
      aturan: aturan.length, kartu: materiData.kartu.length, kuis: materiData.kuis.length, topik: materiData.topik.length,
      kasus: Object.keys(blok).length, soalKasus: soal.filter((s) => s.kasusId).length, blokCampurTingkat,
      perTingkat: Object.fromEntries(TINGKAT.map((k) => [k, soal.filter((s) => s.tingkat === k).length])),
      perKesulitan: Object.fromEntries(['mudah', 'sedang', 'sulit'].map((k) => [k, soal.filter((s) => s.kesulitan === k).length])),
      ...hitung,
    },
    rujukanHilang,
    peringatan,
  };

  mkdirSync(DATA, { recursive: true });
  mkdirSync(PUBLIC, { recursive: true });
  const tulis = (nama, isi) => writeFileSync(path.join(DATA, nama), JSON.stringify(isi, null, nama === 'ukp-mapping.json' || nama === 'import-report.json' ? 2 : 0) + '\n');
  tulis('ukp-bank.json', bank);
  tulis('ukp-rules.json', { versi: 1, aturan });
  tulis('ukp-materi.json', { versi: 1, ...materiData });
  tulis('ukp-mapping.json', mapping);
  tulis('import-report.json', laporan);
  salinPublik();
  console.log('RINGKASAN -> impor ' + soal.length + ' soal, ' + aturan.length + ' aturan, ' + Object.keys(blok).length + ' kasus, ' + rujukanHilang.length + ' soal dengan rujukan aturan hilang.');
  console.log('BERKAS -> ' + path.join(DATA, 'import-report.json'));
}

// Semua berkas JSON data (termasuk yang disunting tangan seperti ukp-parameter.json) disalin ke public/data.
// Bank orisinal (data/ukp-kasus/*.json) digabung menjadi public/data/ukp-orisinal.json.
export function salinPublik() {
  mkdirSync(PUBLIC, { recursive: true });
  for (const nama of readdirSync(DATA)) if (nama.startsWith('ukp-') && nama.endsWith('.json')) copyFileSync(path.join(DATA, nama), path.join(PUBLIC, nama));
  const folderKasus = path.join(DATA, 'ukp-kasus');
  const orisinal = existsSync(folderKasus) ? readdirSync(folderKasus).filter((f) => f.endsWith('.json')).sort().flatMap((f) => JSON.parse(readFileSync(path.join(folderKasus, f), 'utf8'))) : [];
  writeFileSync(path.join(PUBLIC, 'ukp-orisinal.json'), JSON.stringify(orisinal) + '\n');
  console.log('RINGKASAN -> public/data disalin; bank orisinal ' + orisinal.length + ' soal.');
}

if (process.argv.includes('--salin-saja')) salinPublik();
else main();
