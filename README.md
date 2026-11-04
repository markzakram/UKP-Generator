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
   - Pilih tingkat: *Tingkat A*, *Tingkat B · A+B*, atau *Tingkat C · A+B+C* (kumulatif). Di semua layar, subtema dan soal diberi label tingkat ujian yang mengujinya: *diuji di A, B, C*, *diuji di B, C*, atau *diuji di C*. Cakupan per subtema mengikuti dokumen resmi *Cakupan Materi UKP* BPPK (14 Okt 2026): A 34, B 14, C 21 subtema. Pencocokan per butir ada di `data/bppk-cakupan.json`, hasilnya di `data/ukp-mapping.json` (bagian `subtema` dari impor, `override` dari pengesahan), dan tabel lengkapnya di `docs/Cakupan-Materi-UKP.xlsx`. Soal yang labelnya lebih tinggi dari subtemanya hanya masuk paket tingkat labelnya.
   - Sebaran kesulitan bawaan ikut tingkat: A 40/45/15, B 30/50/20, C 20/50/30 (mudah/sedang/sulit), dan bisa diubah.
   - Pilih jenis paket: tryout penuh, per materi, per subtema, atau drill jebakan aturan.
   - Pilih sumber soal:
     - *Bank acuan*: soal LatihUKP.
     - *Soal baru*: 25 model berparameter ditambah 56 soal orisinal di 10 materi (`data/ukp-kasus/`). Paket sumber ini mengikuti sebaran materi bank; soal orisinal dipakai lebih dulu (menjangkau subtema konsep yang tidak punya model) lalu sisanya diisi model.
     - *Campuran*: materi yang punya model memakai soal baru lebih dulu.
   - Atur jumlah, durasi, paket, seed, dan tanggal acuan aturan.
   - Tabel kuota materi × kesulitan bisa disunting. Panel ringkasan menjalankan cek persediaan sebelum perakitan; bila stok kurang, ditampilkan angka kekurangannya tanpa mengganti materi diam-diam.
   - Untuk banyak paket tanpa soal kembar (mulai sekitar paket ke-10), stok satu kesulitan bisa habis. Sel itu lalu diisi dari kesulitan terdekat pada materi yang sama, dan pergeserannya disebut di pesan, RINGKASAN CLI, dan `validasi.json`. Kapasitas tanpa kembar (tryout 100 soal, diukur 3 Nov 2026): bank A 10, B 15, C 19 paket; campuran A 17, B 16, C 20+; soal baru saja (tanpa soal acuan LatihUKP) A 7, B 8, C 10.
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
   - *Saran remedial*: subtema dengan proporsi benar di bawah 60% (minimal 5 respons), beserta nomor soalnya. Tiap baris punya *Buka materi* (tab Materi langsung ke deck subtema itu) dan *Latihan* (paket latihan subtema itu); ada juga *Latihan 5 subtema terlemah*.
5. **Pustaka dan Riwayat.**
   - Pustaka: bank acuan, kartu aturan, hafalan dan rumus, pratinjau model, info ujian.
   - Riwayat: paket tersimpan, 20 versi sebelumnya yang bisa dipulihkan, cadangan/impor JSON.
   - Menu **Cadangan** di bilah atas: *Unduh cadangan paket ini*, *Unduh cadangan lengkap* (semua paket, deck materi beserta hasil telaah, dan sesi uji peserta di browser ini, dalam satu berkas JSON untuk dibagikan ke tim lewat Drive atau WhatsApp), dan *Impor cadangan* (mengenali kedua jenis). Impor cadangan lengkap menggabungkan isinya: data baru ditambah, data yang sama diganti hanya bila versi di berkas lebih baru, sehingga tidak ada yang tertimpa mundur.

## Generator materi (tab Materi)

Deck PowerPoint materi per subtema dengan gaya template tim ("Template Desain Materi"). Spesifikasinya ada di [PRD-Materi.md](PRD-Materi.md).

1. **Cakupan deck.** Bawaannya Tingkat A, lingkup *Tingkat*, dan bentuk *Per subtema*: pilih tingkat (A 34 subtema, A+B 48, A+B+C 69), dan semua subtemanya langsung tercentang. Fokus Tingkat A berarti hanya materi Tingkat A; tingkat lebih tinggi menambah materi, dan contoh soalnya mengikuti tingkat. Pengaturan diingat per browser; *Kembali ke bawaan* mengembalikannya. Lingkup:
   - *Tingkat*: semua subtema tingkat itu, dikelompokkan per materi. Bisa dibatasi ke subtema yang baru mulai di tingkat itu (B 14, C 21).
   - *Materi* (kode): semua subtema satu materi langsung tercentang.
   - *Subtema*: pilih materi, lalu centang subtema satu per satu.
   - *Buat latihan* (bilah deck): merakit paket latihan dari subtema deck yang terbuka (deck gabungan: semua subtemanya) dan membukanya di Hasil paket. Ukuran 20 soal, turun ke 15, 10, atau 5 bila stok subtema kurang; pengaturan tryout di Atur paket tidak berubah.
   - *Silabus* (bagian di bawah Ekspor): satu .xlsx per tingkat berisi pertemuan (60/90/120/180 menit), materi, subtema, nomor slide di deck gabungan, menit, kuis, contoh soal, stok soal latihan, dan jalur deck per subtema di .zip. Durasi dihitung dari slide hasil tata letak: slide isi 2 menit, rumus/contoh soal/pembahasan 3 menit, pembatas 0,5 menit. Kepadatan standar, 90 menit: A 34 subtema ±26 jam (20 pertemuan), A+B 48 ±37 jam (27), A+B+C 69 ±53 jam (40). CLI: `npm run materi -- --tingkat A --silabus --menit-pertemuan 90`.

   Setiap subtema menampilkan tingkatnya dan statusnya: *Belum disusun*, *Draf internal*, atau *Ditelaah*. Pilih kepadatan (Ringkas, Standar, atau Lengkap), jumlah contoh soal dan kuis, lalu tekan **Susun naskah**.

   **Bentuk deck** menentukan hasilnya:
   - *Per subtema*: satu deck per subtema.
   - *Per materi*: subtema yang dicentang digabung menjadi satu deck per materi untuk tingkat itu. Isinya sampul, daftar isi dengan tanda subtema baru di tingkat itu, pembatas per subtema, lalu isi tiap subtema. Contohnya PP Tingkat A berisi 7 subtema, PP Tingkat B · A+B berisi 8.

   Contoh soal mendahulukan soal berlabel tingkat deck (soal pendalaman) bila ada.
2. **Naskah.** Slide tampil sebagai tabel berisi pola, judul, sumber, asal (*Teks acuan*, *Ditulis ulang*, *Model*, *Orisinal*), dan status tata letak.
   - Panel kanan berisi pratinjau (sama dengan isi .pptx), isian slide, pemeriksaan, dan catatan pembicara.
   - **Perbesar pratinjau** (pintasan P) menampilkan deretan slide. J/K memindah slide.
   - Slide yang disunting berstatus *Ditulis ulang*. Tersedia juga Urungkan dan Kembalikan teks acuan.
3. **Ekspor** di panel Cakupan deck:
   - Pilih format: .pptx, naskah .json, atau keduanya.
   - Pilih isi .pptx: *Deck lengkap* atau *Handout peserta* (versi ringkas: sampul, daftar isi, ikhtisar, rumus, rangkuman, dan kuis Benar/Salah, tanpa catatan pembicara; nama berkas `-handout.pptx`). Handout yang masih memuat teks acuan tetap meminta konfirmasi KM2.
   - Tekan **Unduh semua · N deck** untuk semua subtema dalam cakupan sekarang, baik cakupan bawaan maupun yang sudah diatur. Bila hanya sebagian yang dicentang, tombol utama menjadi **Unduh yang dicentang**, dan *Unduh semua* tetap ada di bawahnya.
   - Isi unduhan mengikuti pengaturan sekarang: deck yang belum ada, atau yang belum disunting tetapi disusun dengan tingkat, kepadatan, kuis, contoh soal, atau tanggal lain, disusun dulu. Deck yang sudah disunting atau ditelaah tidak ditimpa dan disebut di ringkasan.
   - Satu berkas diunduh langsung; lebih dari satu berkas menjadi satu .zip berhierarki Tingkat / Materi / Subtema, misalnya `materi-tingkat-a-34-deck.zip` berisi `Tingkat A/04 PPN - PPN & SPT PPN/05 Pengkreditan Pajak Masukan.pptx`. Bentuk *Per materi*: `Tingkat A/04 PPN - PPN & SPT PPN/materi-ppn-tingkat-a.pptx`. Handout berakhiran ` - handout.pptx`, naskah ` - naskah.json`. Ukurannya sekitar 2,4 MB per deck .pptx (Tingkat A 84 MB, A+B+C 171 MB).
   - Bilah bawah juga menyediakan unduhan deck yang sedang dibuka (.pptx atau naskah .json). Naskah .json bisa diimpor lagi untuk topik lain.
   - Deck yang masih memuat teks acuan LatihUKP dan belum ditelaah meminta konfirmasi, lalu diberi tanda **Draf internal** di properti berkas dan catatan pembicara (PRD-Materi KM2).
4. **Telaah.** Penelaah menandai tiap slide *Sesuai* atau *Perlu diubah* di panel kanan, dengan catatan dan nama. Tabel slide bisa disaring "Belum ditelaah" dan "Perlu diubah". **Lembar telaah .xlsx** bisa diisi di Excel oleh penelaah yang tidak memakai aplikasi, lalu diimpor kembali. Slide teks acuan yang ditelaah *Sesuai* tidak lagi membuat deck Draf internal; menyunting isi slide menghapus hasil telaahnya.
5. **Tulis ulang.** Teks pengganti teks LatihUKP disimpan di `data/ukp-tulis.json` per id kartu aturan, kartu hafalan/rumus, dan kuis (angka, pasal, dan dasar hukum tetap sama). Slide dari teks ini berasal *Ditulis ulang*. Saat ini Bea Meterai (15 aturan, 7 kartu, 8 kuis) sudah ditulis ulang, sehingga deck-nya tidak lagi Draf internal; materi lain menyusul. Setelah menyunting berkas itu jalankan `npm run import:data -- --salin-saja` (atau `node scripts/import-latihukp.mjs --salin-saja`) lalu `npm run verify:materi`.

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
npm run materi -- --tingkat B --gabung --setuju-acuan --zip
npm run materi -- --tingkat A --kode BM --gabung --handout --pdf
```

- Lingkupnya ditentukan dari opsi yang diisi:
  - `--subtema`: per subtema.
  - `--kode`: per materi (semua subtema kode itu).
  - Tanpa keduanya: per tingkat. Tambahkan `--hanya-baru` untuk subtema yang mulai di tingkat itu saja.
  - Tambahkan `--gabung` untuk satu deck per materi (misalnya `materi-pp-tingkat-b.pptx`), bukan satu deck per subtema.
- Lebih dari satu berkas ditulis berhierarki Tingkat / Materi / Subtema, sama dengan .zip tab Materi; satu berkas langsung di folder hasil.
- `--handout` menulis handout peserta (`-handout.pptx`, tanpa catatan pembicara). `--pdf` menyimpan PDF setiap .pptx lewat PowerPoint (`scripts/materi-pdf.ps1`; hanya Windows dengan PowerPoint, tidak bersama `--zip`). Contoh: handout BM gabungan Tingkat A 24 slide (deck lengkap 73), PDF 24 halaman.
- Cakupan mengikuti `--tingkat`: A 34 subtema, A+B 48, A+B+C 69. Subtema atau kode di luar cakupan ditolak.
- `--setuju-acuan` wajib untuk .pptx selama isi deck masih teks acuan LatihUKP. Berkasnya diberi tanda Draf internal (PRD-Materi KM2), sama dengan dialog di tab Materi. `--format json` (naskah saja) tidak memerlukannya.
- Hasil ditulis ke `output/materi-<lingkup>/`: `laporan.json` (slide, teks meluap, catatan penyusun per deck), lalu .pptx/.json berhierarki Tingkat / Materi / Subtema, atau satu .zip dengan `--zip`.
- Satu tingkat penuh (34 deck) selesai sekitar 9 detik. Untuk uji render: `powershell -ExecutionPolicy Bypass -File scripts/materi-render.ps1 output/materi-tingkat-a` (membaca subfolder).

`agent-office.json` berisi pekerjaan Buka UKP Studio, Buat paket UKP, Buat deck materi UKP (termasuk handout dan PDF), Buat silabus UKP, Verifikasi, dan Impor data. Perbarui berkas ini setiap kali opsi CLI atau script berubah; `npm run verify` dan `npm run verify:materi` memeriksa kesesuaiannya.

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
npm run verify:models    # uji emas dari kartu rumus/kunci bank + 25 model × ≥240 seed
npm run verify:export    # PDF, Word, Word/Excel SiAdu, K2, CSV, JSON, HTML uji, statistik peserta
npm run verify:materi    # mesin deck materi: metrik Poppins, paket dasar, 69 subtema × 3 kepadatan, cakupan tingkat, kasus tepi, deck tab Materi, CLI materi
```

Uji render PowerPoint (Windows dengan PowerPoint terpasang): membuka setiap deck, membandingkan tinggi teks hasil render dengan kotaknya, dan mengekspor PNG.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/materi-render.ps1 output/materi-uji -Gambar
```

**CI GitHub** (`.github/workflows/ci.yml`): setiap push dan pull request menjalankan `npm ci`, typecheck, kelima pemeriksa di atas, dan `npm run build` di Ubuntu dengan Node 22. Uji render PowerPoint dan PDF tidak ikut karena butuh Windows dengan PowerPoint. Hasilnya di tab *Actions* repositori.

## Batas

- 50 paket per proses, 200 soal per paket, 4.000 soal per proses.
- Tanpa soal kembar (tryout 100 soal): sumber bank A 10, B 15, C 19 paket; campuran A 17, B 16, C 20+; soal baru saja A 7, B 8, C 10 (diukur 3 Nov 2026).
- Pada soal angka dari bank, setelah opsi diurutkan, kunci sering jatuh di B/C. Perakit menyeimbangkan posisi kunci per paket, tetapi pola per soal tetap bisa ditebak peserta. Model soal baru dirancang dengan posisi kunci yang lebih bervariasi.
- Penyimpanan terikat pada browser dan alamat situs. Unduh cadangan lengkap sebelum membersihkan data browser atau pindah perangkat. Belum ada penyimpanan bersama di server; tim berbagi lewat berkas cadangan lengkap (R12).

## Akses dan keamanan

- **Repositori sebaiknya private.** Repositori memuat bank soal acuan LatihUKP (PRD K2) dan teks kartu aturan. Ubah di GitHub: *Settings → General → Danger Zone → Change repository visibility*. CI tetap berjalan di repositori private.
- **Isi `public/data/` terbaca siapa pun yang tahu alamat situsnya.** Aplikasi ini statis: bank soal, kunci, dan pembahasan dimuat browser dari `public/data/*.json`. Bila situs di-deploy ke alamat publik, berkas itu bisa diunduh langsung tanpa membuka aplikasi.
- **Belum ada kata sandi situs** (keputusan 3 Nov 2026). Bila nanti perlu dibatasi, pilihannya tanpa mengubah kode: perlindungan kata sandi bawaan layanan hosting (misalnya Vercel Password Protection atau Deployment Protection), Cloudflare Access di depan domain, atau cukup menjalankan aplikasi di jaringan lokal (`npm run build` lalu `npm run start`).
- Paket, deck, dan sesi uji tersimpan di IndexedDB browser masing-masing pengguna, tidak dikirim ke server. Berkas cadangan lengkap berisi semua data itu, jadi bagikan hanya ke anggota tim.

