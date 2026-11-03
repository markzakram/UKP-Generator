export type Tingkat = 'A' | 'B' | 'C';
export type Kode = 'KUP' | 'OP' | 'PP' | 'PPN' | 'BM' | 'PBB' | 'AKT' | 'BDN' | 'BTI' | 'INT';
export type Huruf = 'A' | 'B' | 'C' | 'D';
export type Kesulitan = 'mudah' | 'sedang' | 'sulit';
export type Bloom = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate';
export type Asal = 'bank' | 'model' | 'adaptasi' | 'orisinal';
export type Opsi = Record<Huruf, string>;

/** Satu soal hasil impor (data/ukp-bank.json) atau bank orisinal (data/ukp-kasus/). */
export interface BankSoal {
  id: string;
  bank: 'easy' | 'hard' | 'orisinal';
  paketSumber: number | null;
  kode: Kode;
  materi: string;
  subtema: string;
  subtemaDasar: 'aturan' | 'kemiripan' | 'lainnya' | 'manual';
  subtopik: string;
  tingkat: Tingkat;
  tingkatBlok?: Tingkat;
  tipe: string;
  bloom: Bloom | null;
  kesulitan: Kesulitan;
  kesulitanSumber: string;
  kategori: string | null;
  kasusId: string | null;
  kasus: string | null;
  soal: string;
  opsi: Opsi;
  kunci: Huruf;
  inti: string;
  langkah: string[];
  kenapaSalah: Partial<Record<Huruf, string>>;
  penyebabSalah: Partial<Record<Huruf, string>>;
  dasarHukum: string[];
  ruleIds: string[];
  catatanAturan: string | null;
  poinIngat: string | null;
  keyakinan: string | null;
  posisiTetap: boolean;
  opsiAngka: boolean;
  sumber: { judul: string; url: string }[];
}

export interface Aturan {
  id: string;
  kode: Kode;
  materi: string;
  subtema: string;
  judul: string;
  tingkat: Tingkat;
  keyakinan: string | null;
  dasarHukum: string[];
  berlaku: { mulai: string | null; sampai: string | null; catatan: string };
  konsep: string;
  pokok: string;
  subjek: string;
  syarat: string[];
  tarifDpp: string;
  ambang: string;
  tenggat: string;
  pengecualian: string[];
  hakKewajiban: string;
  konsekuensi: string;
  contoh: string[];
  jebakan: string[];
  bedaDengan: string[];
  sumber: { judul: string; url: string }[];
}

export interface MateriMapping {
  kode: Kode;
  nama: string;
  subtema: string[];
  stok: Record<Tingkat, number>;
}
export interface Mapping {
  tingkat: { kode: Tingkat; nama: string; cakupan: Tingkat[] }[];
  materi: MateriMapping[];
  /** Tingkat tiap subtema ("KODE::Subtema"), cakupan materi hasil impor (PRD K3). */
  subtema: Record<string, Tingkat>;
  siadu: { category: string; lesson: string; chapter: string };
  override: Record<string, Tingkat>;
}

export interface Kartu {
  id: string;
  jenis: 'hafal' | 'rumus';
  kode: Kode;
  judul: string;
  isi: string[];
  rumus: string[];
  rumusKet: string;
  contoh: string[];
  jebakan: string;
  dasar: string;
  status: string | null;
  sejak: string | null;
  ruleIds: string[];
}
export interface Topik {
  id: string;
  judul: string;
  eyebrow: string | null;
  bagian: { judul: string; poin?: string[]; kisi?: string[]; tabel?: string[][]; link?: string[][] }[];
}
export interface MateriData {
  topik: Topik[];
  kartu: Kartu[];
  kuis: unknown[];
}

/** Aturan deteksi bahan lama (data/ukp-jebakan.json). */
export interface Jebakan {
  id: string;
  topik: string;
  pola: string;
  flags?: string;
  kode?: Kode[];
  /** Hanya diperiksa bila teks juga memuat salah satu konteks ini (regex, huruf kecil). */
  konteks?: string;
  /** Lewati bila teks soal memuat pola ini (ketentuan sah yang mirip, misalnya Pasal 15 untuk kenaikan 100%). */
  kecuali?: string;
  pesan: string;
  sejak: string;
}

/** Nilai aturan bertanggal (data/ukp-parameter.json). */
export interface NilaiParameter {
  nilai: number | string | number[] | Record<string, unknown> | unknown[];
  mulai: string;
  sampai: string | null;
  dasar: string;
}
export type ParameterData = Record<string, { nama: string; satuan?: string; riwayat: NilaiParameter[] }>;

export interface Konteks {
  kota: string[];
  usaha: { jenis: string; jasa?: string; barang?: string }[];
  namaPt: string[];
  namaOrang: string[];
}

/** Teks tulis ulang (R2) pengganti teks acuan LatihUKP, per id kartu aturan, kartu hafalan/rumus, dan kuis. */
export interface TulisUlang {
  materi?: Record<string, { penulis?: string; tanggal?: string; status?: string }>;
  aturan: Record<string, Partial<Pick<Aturan, 'judul' | 'konsep' | 'pokok' | 'subjek' | 'syarat' | 'pengecualian' | 'tarifDpp' | 'ambang' | 'tenggat' | 'hakKewajiban' | 'konsekuensi' | 'contoh' | 'jebakan'>>>;
  kartu: Record<string, Partial<Pick<Kartu, 'judul' | 'isi' | 'rumus' | 'rumusKet' | 'contoh'>>>;
  kuis: Record<string, { teks?: string; jelas?: string }>;
}

export interface DataUkp {
  bank: BankSoal[];
  orisinal: BankSoal[];
  aturan: Aturan[];
  mapping: Mapping;
  materi: MateriData;
  parameter: ParameterData;
  konteks: Konteks;
  jebakan: Jebakan[];
  tulis: TulisUlang;
}

/** Soal yang sudah masuk paket. Opsi bisa sudah diacak; `urutanAsal[i]` = huruf asli opsi pada posisi ke-i. */
export interface Soal {
  uid: string;
  asal: Asal;
  sumberId: string | null;
  modelId: string | null;
  /** Kunci logika model (kondisi + konteks); dua soal model dengan tanda sama dianggap kembar. */
  tanda: string;
  params: Record<string, string | number | boolean> | null;
  kode: Kode;
  materi: string;
  subtema: string;
  subtopik: string;
  tingkat: Tingkat;
  tipe: string;
  bloom: Bloom | null;
  kesulitan: Kesulitan;
  kasusId: string | null;
  kasus: string | null;
  soal: string;
  opsi: Opsi;
  kunci: Huruf;
  inti: string;
  langkah: string[];
  kenapaSalah: Partial<Record<Huruf, string>>;
  penyebabSalah: Partial<Record<Huruf, string>>;
  dasarHukum: string[];
  ruleIds: string[];
  catatanAturan: string | null;
  poinIngat: string | null;
  urutanAsal: Huruf[];
  posisiTetap: boolean;
  opsiAngka: boolean;
  revisi: number;
  disunting: boolean;
  /** Checksum isi saat dibuat; berubah bila disunting. */
  checksum: string;
  /** Untuk soal model: teks kunci hasil hitungan mesin (dipakai pemeriksa hitung ulang). */
  kunciModel?: string;
}

export type JenisPaket = 'tryout' | 'materi' | 'subtema' | 'jebakan';
export type SumberSoal = 'bank' | 'baru' | 'campuran';

export interface BarisKuota {
  kode: Kode;
  mudah: number;
  sedang: number;
  sulit: number;
  /** Jumlah soal yang diambil dari blok kasus (bagian dari total baris). */
  kasus: number;
}

export interface Pengaturan {
  judul: string;
  tingkat: Tingkat;
  jenis: JenisPaket;
  jumlahSoal: number;
  durasi: number;
  jumlahPaket: number;
  seed: string;
  tanggalAcuan: string;
  larangKembar: boolean;
  sumber: SumberSoal;
  komposisi: Record<Kesulitan, number>;
  materi: Kode[];
  subtema: string[];
  urutan: 'materi' | 'acak';
  /** Kuota tangan. Kosong = dihitung otomatis dari stok. */
  kuota: BarisKuota[] | null;
}

export interface Paket {
  id: string;
  nomor: number;
  seed: string;
  soal: Soal[];
}

export interface Snapshot {
  id: string;
  waktu: string;
  keterangan: string;
  paket: Paket[];
}

export interface Workspace {
  versi: 1;
  id: string;
  judul: string;
  dibuat: string;
  diperbarui: string;
  pengaturan: Pengaturan;
  paket: Paket[];
  riwayat: Snapshot[];
}

export type LevelMutu = 'gagal' | 'peringatan' | 'info' | 'lolos';
export interface CekMutu {
  id: string;
  level: LevelMutu;
  judul: string;
  ket: string;
  aksi?: 'urutkan' | 'adaptasi';
}
