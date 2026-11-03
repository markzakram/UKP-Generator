# Roadmap UKP Generator

<!-- Tiap "## Tahap" = milestone dari PRD bagian 14. "- [x]" = selesai dan lulus QC (lihat QC.md). -->

## Tahap 0 · Keputusan
- [x] PRD draf 0.2 dan desain B+ disetujui (2 Nov 2026)
- [x] K1–K9 memakai usulan bawaan (PRD bagian 15)
- [x] Kerangka project: Next.js 16.4.3, TypeScript, dependensi tanpa kerentanan
- [x] QC Tahap 0

## Tahap 1 · Fondasi data
- [x] `scripts/import-latihukp.mjs`: normalisasi bank, aturan, kartu, kasus, topik
- [x] `data/ukp-mapping.json`: tingkat, materi, subtema, override
- [x] Tipe data dan validator dasar
- [x] QC Tahap 1

## Tahap 2 · Generator dari bank
- [x] Blueprint, perakit paket (kuota, blok kasus, seed, tanpa kembar)
- [x] UI B+ Atur paket dan Hasil paket, IndexedDB, riwayat, cadangan
- [x] Ganti nomor ini / terpilih
- [x] Ekspor PDF, Word, CSV, JSON
- [x] CLI `npm run generate` + `agent-office.json`
- [x] QC Tahap 2

## Tahap 3 · Soal baru
- [x] `data/ukp-parameter.json` bertanggal
- [x] 10 model MVP + pemeriksa hitung ulang
- [x] Deteksi aturan lama (`data/ukp-jebakan.json`)
- [x] Pratinjau model di Pustaka
- [x] QC Tahap 3

## Tahap 4 · SiAdu dan produksi
- [x] Word SiAdu dan Excel SiAdu (template SOAL)
- [x] Konfirmasi ekspor soal acuan sumber
- [x] Ambil soal satuan / terpilih
- [x] QC Tahap 4

## Tahap 5 · Perluasan
- [x] Model lanjutan (P1): 11 model (sanksi bunga, NPPN, penyusutan, 31E, PPh 25, thin cap, BPT, PBB-P5L, jasa konstruksi, PPh 24, pesangon)
- [x] Adaptasi identitas kasus
- [x] Drill jebakan aturan
- [x] Bank orisinal (`data/ukp-kasus/`): 10 soal awal
- [x] Uji peserta: berkas HTML, impor hasil, statistik
- [x] QC Tahap 5

## Berikutnya (di luar Tahap 0–5)
- [ ] Telaah penelaah materi (K8) atas parameter, 25 model, dan 56 soal orisinal; ubah `keyakinan` ke "Tinggi" setelah disahkan
- [x] Sahkan pemetaan tingkat terhadap Cakupan Materi UKP BPPK (K3): `data/bppk-cakupan.json`, 9 override (3 Nov 2026)
- [x] 4 model tambahan: pengkreditan PM, rekonsiliasi fiskal, pajak tangguhan PSAK 212, denda keberatan (R4, 3 Nov 2026)
- [ ] Model PPh 21 TER (butuh tabel lampiran PP 58/2023 sebagai data), pemajakan keluarga PH/MT, PPh 21 harian, CFC, PPN besaran tertentu
- [x] Alur telaah per slide dan lembar telaah .xlsx (R1, 3 Nov 2026)
- [x] Lapisan tulis ulang `data/ukp-tulis.json`; Bea Meterai selesai (R2, 3 Nov 2026)
- [x] Silabus per tingkat .xlsx di tab Materi dan CLI `--silabus` (R7, 3 Nov 2026)
- [x] Materi ↔ latihan: tombol Buat latihan di deck, saran remedial di Uji peserta (R8, 3 Nov 2026)
- [x] Handout peserta (.pptx tanpa catatan pembicara) dan PDF lewat PowerPoint dari CLI (R9, 3 Nov 2026)
- [x] CI GitHub: typecheck, 5 pemeriksa, build pada setiap push (R11, 3 Nov 2026); berjalan setelah di-push
- [x] Catatan akses dan keamanan di README; tanpa kata sandi situs (R10, 3 Nov 2026)
- [ ] Jadikan repositori private dan putuskan pembatasan akses situs bila di-deploy publik (dikerjakan pemilik repo)
- [x] QC akhir R1–R12: 554 cek, build, audit 0, render 138 deck 0 meluap (3 Nov 2026)
- [ ] Tulis ulang materi lain (KUP, OP, PP, PPN, PBB, AKT, BDN, BTI, INT) di `data/ukp-tulis.json`
- [x] Bank orisinal 56 soal di 10 materi; tryout tanpa soal acuan memenuhi target K4 (A 7, B 8, C 10 paket) (R5, 3 Nov 2026)
- [ ] Soal orisinal untuk 4 subtema yang masih kosong: OP NPWP & pendaftaran, PP Tata cara penyetoran & pelaporan, PBB Pendaftaran/SPOP/SPPT, AKT Bank & lembaga pembiayaan
- [ ] Uji importir SiAdu di akun SiAdu sungguhan ("Isi 1 Soal Tanpa Simpan")
- [ ] Keputusan merek dan nama aplikasi (K1)

# Generator Materi (PRD-Materi.md)

## M0 · Keputusan dan desain
- [x] Bedah template dan uji kelayakan 8 slide (`docs/materi/`)
- [x] PRD-Materi draf 0.1
- [x] PRD-Materi disetujui, KM1–KM10 memakai usulan bawaan (3 Nov 2026)
- [x] 3 opsi tampilan tab Materi; dipilih B · Lembar Naskah (3 Nov 2026)
- [x] Gabungan B+ Materi disetujui (3 Nov 2026)

## M1 · Mesin PPTX
- [x] Paket dasar `assets/materi/dasar.pptx`, metrik Poppins, pola P1–P7, P10, P15, P16, pemecah slide lanjutan
- [x] `verify:materi` (74 cek) dan uji render PowerPoint `scripts/materi-render.ps1`
- [x] QC M1 (3 Nov 2026)

## M2 · Penyusun naskah
- [x] `susunNaskah`, pola P8, P9, P11–P14, tanggal acuan, jebakan, catatan pembicara, status asal
- [x] QC M2 (69 subtema × 3 kepadatan, 3 Nov 2026)

## M3 · UI tab Materi
- [x] Cakupan, penyunting naskah, pratinjau, unduh, riwayat, konfirmasi hak pakai, impor/ekspor naskah
- [x] QC M3 (3 Nov 2026)
- [x] Cakupan tingkat per subtema (A 33, B 23, C 13) untuk paket soal dan deck; komposisi kesulitan bawaan per tingkat; lingkup susun Subtema / Materi (kode) / Tingkat dan unduhan .zip per folder kode (3 Nov 2026)

## M4 · Produksi
- [x] Unduhan massal .zip di tab Materi (lingkup materi/tingkat)
- [x] CLI `npm run materi` (per tingkat, kode, atau subtema), job `buatmateri` di `agent-office.json`, README (3 Nov 2026)
- [x] QC akhir (3 Nov 2026)

## Materi per tingkat
- [x] Deck gabungan satu per materi per tingkat (sampul, daftar isi, pembatas per subtema), contoh soal ikut tingkat, `--gabung` di CLI dan agent-office (3 Nov 2026)
