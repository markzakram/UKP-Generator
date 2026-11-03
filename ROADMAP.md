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
- [ ] Telaah penelaah materi (K8) atas parameter, 21 model, dan 10 soal orisinal; ubah `keyakinan` ke "Tinggi" setelah disahkan
- [ ] Sahkan pemetaan tingkat terhadap Cakupan Materi UKP BPPK (K3) di `data/ukp-mapping.json` bagian `override`
- [ ] Model PPh 21 TER (butuh tabel lampiran PP 58/2023 sebagai data), pemajakan keluarga PH/MT, rekonsiliasi fiskal & pajak tangguhan, PPh 21 harian, CFC, PPN besaran tertentu
- [ ] Tambah bank orisinal per materi sampai target stok tanpa soal acuan
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
- [ ] `susunNaskah`, pola P8, P9, P11–P14, tanggal acuan, jebakan, catatan pembicara, status asal
- [ ] QC M2 (69 subtema × 3 kepadatan)

## M3 · UI tab Materi
- [ ] Cakupan, penyunting naskah, pratinjau, unduh, riwayat, konfirmasi hak pakai
- [ ] QC M3

## M4 · Produksi
- [ ] CLI `npm run materi`, `agent-office.json`, unduhan massal .zip, README
- [ ] QC akhir
