# UKP Studio (UKP Generator)

Ruang kerja tim konten untuk menyusun, memeriksa, dan mengekspor paket soal **Uji Kompetensi Perpajakan (UKP) Tingkat A, B, dan C**. Spesifikasinya ada di [PRD.md](PRD.md), statusnya di [ROADMAP.md](ROADMAP.md), dan hasil QC per tahap di [QC.md](QC.md).

- Berjalan di browser: tanpa API key, tanpa server AI, tanpa basis data eksternal. Paket disimpan di IndexedDB browser.
- Desain B+ "Lembar Kerja lengkap" (PRD bagian 18): IBM Plex Sans/Mono dengan aksen amber.
- Bahan acuan diambil dari snapshot LatihUKP di `../Scrape UKP/output/latihukp/`: 2.387 soal, 334 kartu aturan, dan 92 kartu hafalan/rumus. Bank ini **acuan internal**. Isinya salinan situs pihak ketiga yang belum diverifikasi independen dan bukan soal resmi BPPK/DJP (PRD K2).

## Menjalankan

Butuh Node.js ≥ 20.9 (disarankan 22 atau 24).

```powershell
npm install
npm run dev
```

Buka http://localhost:3000. Untuk produksi lokal:

```powershell
npm run build
npm start
```

`npm run build` membutuhkan internet karena font IBM Plex diunduh oleh `next/font`.

**Deploy ke Vercel:**
- Framework: Next.js; Install: `npm install`; Build: `npm run build`.
- Tidak perlu environment variable.
- `public/data/` ikut di-deploy dan bisa dibaca siapa pun yang membuka situs, termasuk bank acuan LatihUKP. Batasi akses situs bila perlu.

## Alur penggunaan

1. **Atur paket.**
   - Pilih tingkat: *Tingkat A*, *Tingkat B · A+B*, atau *Tingkat C · A+B+C* (kumulatif). Di semua layar, subtema dan soal diberi label tingkat ujian yang mengujinya: *diuji di A, B, C*, *diuji di B, C*, atau *diuji di C*. Cakupan per subtema ada di `data/ukp-mapping.json` bagian `subtema` (A 33, B 23, C 13 subtema; tabel lengkap di `docs/Cakupan-Materi-UKP.xlsx`). Soal yang labelnya lebih tinggi dari subtemanya hanya masuk paket tingkat labelnya.
   - Sebaran kesulitan bawaan ikut tingkat: A 40/45/15, B 30/50/20, C 20/50/30 (mudah/sedang/sulit), dan bisa diubah.
   - Pilih jenis paket: tryout penuh, per materi, per subtema, atau drill jebakan aturan.
   - Pilih sumber soal:
     - *Bank acuan*: soal LatihUKP.
     - *Soal baru*: 21 model berparameter ditambah bank orisinal.
     - *Campuran*: materi yang punya model memakai soal baru lebih dulu.
   - Atur jumlah, durasi, paket, seed, dan tanggal acuan aturan.
   - Tabel kuota materi × kesulitan bisa disunting. Panel ringkasan menjalankan cek persediaan sebelum perakitan; bila stok kurang, ditampilkan angka kekurangannya tanpa mengganti materi diam-diam.
2. **Hasil paket.**
   - Strip angka mutu dan peta soal 1–100.
   - Tabel soal dan panel detail berisi soal, kunci, mutu otomatis, dan pembahasan.
   - Pintasan J/K dan mode Tampilan peserta.
   - Aksi: Sunting (membuat revisi baru), Ganti nomor ini/terpilih (soal kasus diganti satu blok), Urutkan opsi, Adaptasi identitas, Salin soal, dan Unduh.
3. **Unduh.**
   - PDF dan Word (naskah, kunci, soal + jawaban, atau lengkap).
   - Word SiAdu dan Excel SiAdu.
   - CSV, JSON, dan berkas uji HTML.
   - Ekspor SiAdu yang memuat soal acuan meminta konfirmasi: soal acuan dikeluarkan, atau tetap disertakan untuk penggunaan internal.
4. **Uji peserta.**
   - Unduh berkas uji HTML (tanpa kunci) dan bagikan ke peserta.
   - Impor hasil JSON dari peserta.
   - Lihat statistik butir: p benar, sebaran jawaban A–D, rata-rata detik, pengecoh yang jarang dipilih, serta daya beda dan label empiris setelah ≥ 30 sesi.
5. **Pustaka dan Riwayat.**
   - Pustaka: bank acuan, kartu aturan, hafalan dan rumus, pratinjau model, info ujian.
   - Riwayat: paket tersimpan, 20 versi sebelumnya yang bisa dipulihkan, cadangan/impor JSON.

## Generator materi (tab Materi)

Deck PowerPoint materi per subtema dengan gaya template tim ("Template Desain Materi"). Spesifikasinya ada di [PRD-Materi.md](PRD-Materi.md).

1. **Cakupan deck.** Pilih tingkat (A 33 subtema, A+B 56, A+B+C 69), lalu lingkup:
   - *Subtema*: pilih materi, lalu centang subtema satu per satu.
   - *Materi (kode)*: semua subtema satu materi langsung tercentang.
   - *Tingkat*: semua subtema tingkat itu, dikelompokkan per materi. Bisa dibatasi ke subtema yang baru mulai di tingkat itu (B 23, C 13).

   Setiap subtema menampilkan tingkatnya dan statusnya: *Belum disusun*, *Draf internal*, atau *Ditelaah*. Pilih kepadatan (Ringkas, Standar, atau Lengkap), jumlah contoh soal dan kuis, lalu tekan **Susun naskah**. Satu deck dibuat per subtema.
2. **Naskah.** Slide tampil sebagai tabel berisi pola, judul, sumber, asal (*Teks acuan*, *Ditulis ulang*, *Model*, *Orisinal*), dan status tata letak.
   - Panel kanan berisi pratinjau (sama dengan isi .pptx), isian slide, pemeriksaan, dan catatan pembicara.
   - **Perbesar pratinjau** (pintasan P) menampilkan deretan slide. J/K memindah slide.
   - Slide yang disunting berstatus *Ditulis ulang*. Tersedia juga Urungkan dan Kembalikan teks acuan.
3. **Unduh** .pptx satu deck, .zip beberapa deck (satu folder per kode bila lebih dari satu materi; sekitar 2,4 MB per deck), atau naskah .json. Naskah .json juga bisa diimpor untuk topik lain.
   - Deck yang masih memuat teks acuan LatihUKP dan belum ditelaah meminta konfirmasi, lalu diberi tanda **Draf internal** di properti berkas dan catatan pembicara (PRD-Materi KM2).

Teknisnya:
- Paket dasar `assets/materi/dasar.pptx` dibuat dengan `npm run materi:dasar` dari `assets/materi/template-sumber.pptx`. Isinya tema, font Poppins tertanam, dan media.
- Ukuran teks dihitung dengan tabel lebar huruf Poppins hasil ukur PowerPoint, jadi teks tidak meluap.
- Teks isi tidak pernah dipotong. Bila tidak muat, isi dipecah ke slide "(lanjutan)".
- Isi deck berasal dari kartu aturan LatihUKP. Sebelum dibagikan, isi perlu ditulis ulang atau ditelaah.

## Soal baru tanpa AI

Model di `lib/models/` menyusun konteks fiktif, angka, kunci yang dihitung, tiga pengecoh dari kesalahan khas, pembahasan langkah demi langkah, dan dasar hukum. Kesalahan khas yang dipakai: `tertukar_aturan`, `salah_tarif_dpp`, `salah_periode`, `lupa_syarat`, `salah_hitung`, dan `belum_tahu_aturan`.

| Kelompok | Model |
| --- | --- |
| MVP (Tahap 3) | PPh 23; PPh 4(2) sewa; PPh 21 bukan pegawai; PPh 26 + P3B; tarif & DPP PPN; PPN terutang/kompensasi; PPh OP terutang; PPh final UMKM; bea meterai; tenggat setor/lapor |
| Lanjutan (Tahap 5) | Sanksi bunga KMK; NPPN; penyusutan fiskal; Pasal 31E; angsuran PPh 25; thin capitalization; branch profit tax; PBB-P5L; jasa konstruksi; kredit PPh 24; pesangon final |

Aturan yang dipakai model:

- **Tarif dan ambang hanya ada di `data/ukp-parameter.json`.** Setiap nilai punya masa berlaku dan dasar hukum. Model memakai nilai yang berlaku pada tanggal acuan paket, dan menolak membuat soal bila nilainya belum berlaku (misalnya DPP 11/12 untuk 2024). Kuotanya lalu diisi bank.
- **Data resmi yang tidak tersedia tidak ditebak.** Tarif bunga KMK bulanan disebut sebagai fakta di soal. Tabel TER PPh 21 belum dimodelkan.
- **Pemeriksa hitung ulang** memastikan kunci sama dengan hasil mesin. Bila soal disunting, bukti hitungnya batal.
- **Kebenaran isi belum disahkan.** Parameter dan model diambil dari kartu LatihUKP per Oktober 2026 dan menunggu telaah penelaah materi (PRD K8).

## Pemeriksaan mutu

- **Per soal:**
  - struktur (4 opsi berbeda, 1 kunci);
  - hitung ulang soal model;
  - rujukan kartu aturan dan dasar hukum;
  - masa berlaku aturan pada tanggal acuan;
  - deteksi ketentuan lama di kunci/inti dari 13 pola di `data/ukp-jebakan.json`, dengan pengecualian sah agar tidak terjadi positif palsu;
  - panjang opsi, urutan opsi angka, dan asal soal.
- **Per paket:**
  - posisi kunci merata (n/4 ± 2);
  - tidak ada soal kembar di dalam paket maupun antarpaket;
  - kemiripan teks;
  - blok kasus utuh dan berurutan;
  - keragaman kota.
- Soal yang gagal struktur atau hitung ulang **menahan ekspor**. Catatan lain bersifat informasi untuk penelaah. Generator tidak pernah memberi status "disetujui".

## CLI dan Agent Office

```powershell
npm run generate -- --help
npm run generate -- --tingkat C --soal 100 --paket 3 --seed UKP-C-01 --format json,pdf,siadu-docx --tanpa-acuan --out output\uji
npm run generate -- --jenis materi --materi PPN,KUP --soal 40 --sumber baru --format pdf,uji-html
```

- CLI mencetak baris `RINGKASAN -> …` dan `BERKAS -> …` serta menulis `validasi.json` (mutu per paket dan per soal).

Deck materi lewat CLI, satu deck per subtema:

```powershell
npm run materi -- --help
npm run materi -- --tingkat B --hanya-baru --daftar
npm run materi -- --tingkat A --setuju-acuan
npm run materi -- --tingkat A --kode PPN,KUP --kepadatan ringkas --setuju-acuan --zip
npm run materi -- --subtema "PPN::DPP & tarif PPN;KUP::Sanksi administrasi" --format pptx,json --setuju-acuan
```

- Lingkupnya ditentukan dari opsi yang diisi:
  - `--subtema`: per subtema.
  - `--kode`: per materi (semua subtema kode itu).
  - Tanpa keduanya: per tingkat. Tambahkan `--hanya-baru` untuk subtema yang mulai di tingkat itu saja.
- Cakupan mengikuti `--tingkat`: A 33 subtema, A+B 56, A+B+C 69. Subtema atau kode di luar cakupan ditolak.
- `--setuju-acuan` wajib untuk .pptx selama isi deck masih teks acuan LatihUKP. Berkasnya diberi tanda Draf internal (PRD-Materi KM2), sama dengan dialog di tab Materi. `--format json` (naskah saja) tidak memerlukannya.
- Hasil ditulis ke `output/materi-<lingkup>/`: `laporan.json` (slide, teks meluap, catatan penyusun per deck), lalu .pptx/.json per subtema dengan folder per kode, atau satu .zip dengan `--zip`.
- Satu tingkat penuh (33 deck) selesai sekitar 9 detik. Untuk uji render: `powershell -ExecutionPolicy Bypass -File scripts/materi-render.ps1 output/materi-tingkat-a` (membaca subfolder).

`agent-office.json` berisi pekerjaan Buka UKP Studio, Buat paket UKP, Buat deck materi UKP, Verifikasi, dan Impor data. Perbarui berkas ini setiap kali opsi CLI atau script berubah; `npm run verify` dan `npm run verify:materi` memeriksa kesesuaiannya.

## Data

| Berkas | Isi | Diubah dengan |
| --- | --- | --- |
| `data/ukp-bank.json`, `ukp-rules.json`, `ukp-materi.json`, `import-report.json` | Hasil normalisasi LatihUKP | `npm run import:data` (jangan disunting tangan) |
| `data/ukp-mapping.json` | Tingkat, materi, subtema, tingkat per subtema (`subtema`), peta SiAdu, `override` tingkat | `override` disunting tangan; sisanya ditulis impor |
| `data/ukp-parameter.json` | Tarif, ambang, tenggat bertanggal | Disunting tangan, lalu `npm run verify:models` |
| `data/ukp-jebakan.json` | Pola ketentuan lama | Disunting tangan, lalu `npm run verify:quality` |
| `data/ukp-konteks.json` | Kota, usaha, nama fiktif | Disunting tangan |
| `data/ukp-kasus/*.json` | Bank orisinal (lihat README di folder itu) | Disunting tangan |

Setelah menyunting berkas data, jalankan `npm run import:data -- --salin-saja` untuk menyalinnya ke `public/data/`.

Catatan impor:
- 656 soal tidak punya rujukan aturan yang valid, sehingga subtemanya ditebak lewat kemiripan teks. Akurasinya 84,4% pada soal yang subtemanya diketahui. Soal-soal ini ditandai `subtemaDasar: "kemiripan"`.
- Tingkat soal mengikuti label sumber dengan cakupan kumulatif, sampai disahkan terhadap dokumen Cakupan Materi UKP BPPK (PRD K3).

## Verifikasi

```powershell
npm run typecheck
npm run verify           # data, perakit, ganti nomor, cadangan, adaptasi, bank orisinal, CLI, agent-office.json
npm run verify:quality   # 90 paket banyak seed, pemetaan opsi seluruh bank, pemeriksa mutu, deteksi aturan lama
npm run verify:models    # uji emas dari kartu rumus/kunci bank + 21 model × ≥240 seed
npm run verify:export    # PDF, Word, Word/Excel SiAdu, K2, CSV, JSON, HTML uji, statistik peserta
npm run verify:materi    # mesin deck materi: metrik Poppins, paket dasar, 69 subtema × 3 kepadatan, cakupan tingkat, kasus tepi, deck tab Materi, CLI materi
```

Uji render PowerPoint (Windows dengan PowerPoint terpasang): membuka setiap deck, membandingkan tinggi teks hasil render dengan kotaknya, dan mengekspor PNG.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/materi-render.ps1 output/materi-uji -Gambar
```

## Batas

- 50 paket per proses, 200 soal per paket, 4.000 soal per proses.
- Tanpa soal kembar, bank acuan cukup untuk 12 paket tryout 100 soal Tingkat C, 7 Tingkat B, atau 6 Tingkat A.
- Pada soal angka dari bank, setelah opsi diurutkan, kunci sering jatuh di B/C. Perakit menyeimbangkan posisi kunci per paket, tetapi pola per soal tetap bisa ditebak peserta. Model soal baru dirancang dengan posisi kunci yang lebih bervariasi.
- Penyimpanan terikat pada browser dan alamat situs. Unduh cadangan sebelum membersihkan data browser atau pindah perangkat.
