# Catatan QC UKP Generator

Setiap tahap ditutup dengan satu QC. Butir yang gagal diperbaiki lalu diperiksa ulang sebelum tahap berikutnya dimulai.

## Tahap 0 · Keputusan (2 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| K1–K9 tercatat di PRD bagian 15 | Lulus |
| Desain B+ tercatat di PRD bagian 18 | Lulus |
| `npm install` | Lulus. Next 16.3.8 punya celah kritis (GHSA-2464-fhr4-w9xw dkk.), jadi dinaikkan ke 16.4.3 |
| `npm audit` | Lulus, 0 kerentanan |
| `npm run typecheck` pada kerangka | Lulus |
| `tsx` berjalan (esbuild win32-x64 tersedia walau postinstall diblokir) | Lulus |

## Tahap 1 · Fondasi data (2 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run import:data` | Lulus: 2.387 soal (1.547 EASY, 840 HARD), 334 aturan, 92 kartu, 318 kuis, 11 topik, 183 kasus / 461 soal kasus |
| `npm run verify` (bagian Tahap 1, 19 cek) | Lulus |
| `npm run typecheck` | Lulus |
| Impor diulang menghasilkan berkas identik (sha256) | Lulus |
| Bagian `override` di `ukp-mapping.json` bertahan saat impor ulang | Lulus |
| `public/data/` tersalin sama dengan `data/` | Lulus |

Temuan dan penanganannya:

- 552 soal tidak punya rujukan aturan yang valid, termasuk 178 soal yang merujuk id aturan yang tidak ada. Subtemanya ditebak lewat kemiripan teks dengan kartu aturan materi yang sama. Tebakan ini diuji pada 1.731 soal yang subtemanya diketahui: setelan awal hanya 76,4% tepat, setelah dinormalkan 84,4%. Hasilnya 656 soal ditandai `subtemaDasar: "kemiripan"` supaya bisa dikoreksi tangan.
- 17 blok kasus berisi soal dengan tingkat berbeda. Tingkat blok diambil dari tingkat tertinggi anggotanya (`tingkatBlok`), supaya blok tidak terpotong di paket tingkat rendah.
- 7 soal menyebut huruf opsi dalam kurung, misalnya "(A)", yang tidak bisa dibedakan dari butir peraturan. Urutan opsinya dikunci (`posisiTetap`).
- Kasus P4-PPN-K1: teks kasus pada soal kedua lebih panjang daripada soal pertama. Teks per soal dipertahankan.

## Tahap 2 · Generator dari bank (2 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus |
| `npm run verify` (85 cek: data, perakit, cakupan tingkat/jenis, batas/stok, ganti nomor, workspace/cadangan, CLI, kesesuaian `agent-office.json`) | Lulus |
| `npm run verify:quality` (18 cek: 90 paket dari 30 seed × tingkat A/B/C × sumber bank/campuran, pemetaan opsi seluruh bank, pemeriksa mutu) | Lulus |
| `npm run verify:export` (22 cek: isi PDF per mode, Word, CSV, JSON, ZIP per paket) | Lulus |
| `npm run build` (Next 16.4.3) | Lulus |
| Browser 1440 px: Buat paket → Hasil paket, peta soal, panel detail, Ganti nomor ini, Sunting → revisi 2, Riwayat (2 snapshot), muat ulang (IndexedDB bertahan), J/K, Tampilan peserta, dialog Unduh, lima bagian Pustaka | Lulus |
| Browser 375 px: Atur dan Hasil tanpa geser samping | Lulus |
| Kinerja: 3 paket × 100 soal 46 ms; 10 paket < 15 detik | Lulus |

Temuan dan penanganannya:

- **Soal kasus kurang dari target.** Awalnya hanya 15 dari target 20. Pemilihan blok sekarang mencoba 12 urutan dan memakai hasil terbaik; selisihnya ≤ 4 karena ukuran blok 2–4 soal.
- **Posisi kunci paket kurang merata.** Penyeimbangan diubah menjadi dua tahap, dan sekarang 90 paket merata di rentang 23–27.
  - Penyebabnya adalah pola kunci pada soal bank beropsi angka. Setelah opsi diurutkan naik, kunci jatuh di A 147, B 328, C 249, D 59 (n = 783).
  - **Risiko sisa:** pada soal angka dari bank, peserta bisa menebak B/C. Model soal baru di Tahap 3 dirancang dengan posisi kunci yang bervariasi.
- **Pemeriksa CSV salah.** `TextDecoder` membuang BOM saat membaca, padahal berkasnya benar. Yang diperbaiki ujinya.
- **Format belum tersedia.** `agent-office.json` sempat menyebut format SiAdu dan HTML uji yang belum ada. Pemeriksa kesesuaian menangkapnya, jadi entri itu dihapus sampai Tahap 4–5.
- **Berkas data opsional belum ada.** Browser mencatat 404 untuk `ukp-parameter/konteks/jebakan/orisinal.json`. Aplikasi menanganinya tanpa galat; berkasnya dibuat di Tahap 3 dan 5.
- **Kapasitas bank tanpa soal kembar** (tryout 100 soal, sumber bank): 12 paket Tingkat C, 7 Tingkat B, 6 Tingkat A. Target K4 (5 paket per tingkat) terpenuhi.
- **Soal bercatatan 15,9%,** kebanyakan dari heuristik panjang opsi, misalnya kunci adalah opsi terpanjang. Statusnya informasi untuk penelaah, tidak menahan ekspor.

## Tahap 3 · Soal baru (2 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus |
| `npm run verify:models` (64 cek) | Lulus |
| ↳ 25 uji emas dari contoh kartu rumus dan kunci soal bank (PPh 23, 4(2), 21 bukan pegawai, 26, PPN DPP, PPN terutang, PPh OP, UMKM, bea meterai, tenggat) | Lulus |
| ↳ 10 model × ≥240 seed (2.400 soal): struktur, hitung ulang = kunci, pengecoh unik, alasan dan penyebab per opsi, rujukan, teks utuh, kunci bebas aturan lama, deterministik | Lulus |
| ↳ Model menolak bila parameter belum berlaku (DPP 11/12 pada 2024); paket 2024 tetap terbentuk dengan bank | Lulus |
| ↳ Integrasi: sumber baru tanpa kembar logika; campuran ±25 soal baru per paket; ganti nomor soal model | Lulus |
| `npm run verify:quality` (40 cek, termasuk 18 uji pola aturan lama positif/negatif dan bukti hitung ulang) | Lulus |
| `npm run verify` (85) dan `npm run verify:export` (22) | Lulus |
| `npm run build` | Lulus |
| Browser: Pustaka → Model soal baru (10 model, pratinjau berurutan seperti di paket); Buat paket campuran → 25/75 soal baru/bank; panel mutu "Hitung ulang … cocok dengan kunci" | Lulus |

Temuan dan penanganannya:

- **Kartu rumus tidak lengkap.** Impor membuang kolom `rumus`, `contoh`, dan `rumus_ket` pada kartu. Impor diperbaiki, dan rumus dipakai sebagai acuan model serta uji emas.
- **Positif palsu deteksi aturan lama.** Pola awal menandai 19 kunci bank yang sebenarnya sah, misalnya denda PBB 2%, kenaikan Pasal 15/17C/17D 100%, lapisan pesangon Rp50 juta, dan "Rp6.000.000". Ditambahkan kolom `kecuali`; sekarang 0 positif palsu pada kunci dan inti 2.387 soal, dan 21 pengecoh ditandai sebagai info.
- **Posisi kunci soal angka model.** Awalnya kunci hampir tidak pernah di D (3,6%). Setelah ditambah pengecoh bernilai kecil yang tetap bermakna, sebarannya menjadi A 16% / B 30% / C 38% / D 16%.
- **Pengecoh UMKM kurang.** Model UMKM kehabisan pengecoh saat kuncinya Rp0. Ditambah pengecoh tarif lama 1%, dan bulan yang ditanya tidak lagi Januari.
- **Kesesuaian teks soal.** Penjual di model PPN DPP sempat memakai jenis usaha pembeli, dan model UMKM bisa memakai "rumah sakit" sebagai usaha orang pribadi beromzet kecil. Keduanya diperbaiki.
- **Dua jenis jasa di data konteks** tidak pasti tercantum di PMK 141/2015. Keduanya diganti dengan jasa yang jelas tercakup, yaitu konsultan dan event organizer.
- **Risiko sisa (PRD K8):** tarif dan rumus diambil dari kartu LatihUKP per Oktober 2026 dan belum disahkan penelaah materi. Tabel TER PPh 21 dan tarif bunga KMK bulanan tidak dimodelkan, karena datanya tidak tersedia dan tidak boleh ditebak.

## Tahap 4 · SiAdu dan produksi (2 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus |
| `npm run verify:export` (40 cek; 18 baru untuk SiAdu dan K2) | Lulus |
| ↳ Word SiAdu: "Soal N" berurutan → Category/Lesson/Chapter → Bentuk Soal: Option New → Tingkat Kesulitan → kasus + batang → A–D → Jawaban → Pembahasan; gaya SiaduQuestion/SiaduAnswer; mode tanpa pembahasan | Lulus |
| ↳ Excel SiAdu: sheet SOAL + PETUNJUK, header 21 kolom persis template, `option_new`, opsi_e dan skor kosong, aman dari karakter kontrol | Lulus |
| ↳ K2: SiAdu dengan soal acuan ditolak tanpa konfirmasi; bisa disetujui atau soal acuan dikeluarkan | Lulus |
| Uji silang Excel dengan openpyxl terhadap `Template_Bank_Soal_SiAdu.xlsx`: header identik, 40 baris, level/kunci/answer_type valid | Lulus |
| Uji silang Word SiAdu dengan konverter resmi skill `soal-to-siadu-excel` (`convert_soal.py`): `tipe_pasti` true, `perlu_konfirmasi` kosong, 30/30 soal OK, urutan kunci sama, pembahasan terbaca | Lulus |
| CLI: `--format siadu-docx,siadu-xlsx`; tanpa konfirmasi → `Error: … acuan internal`; `--tanpa-acuan` dan `--setuju-acuan` | Lulus |
| `npm run verify` (85, termasuk kesesuaian `agent-office.json` dengan format dan opsi baru) | Lulus |
| `npm run build` | Lulus |
| Browser: tombol Word/Excel SiAdu dan Salin terpilih; dialog K2 mengunci Unduh sampai dipilih; "Unduh soal ini" pada soal kasus memilih seluruh blok | Lulus |

Catatan:

- **Uji di SiAdu sungguhan.** Penyimpanan ke akun SiAdu belum diuji karena tidak ada akses akun. Yang diuji adalah pembacaan oleh konverter skill. Sebelum menjalankan antrean, sarankan tim memakai "Isi 1 Soal Tanpa Simpan" di importir SiAdu.
- **Unduhan di browser tidak diklik**, karena berkas akan masuk ke folder Unduhan pengguna. Isi berkas diuji lewat `verify:export` dan CLI dengan fungsi pembuat yang sama.

## Tahap 5 · Perluasan (2 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus |
| `npm run verify:models` (114 cek; 21 model, 5.040 soal) | Lulus |
| ↳ 17 uji emas model lanjutan: bunga Pasal 8(2) Rp303.000 dan 9(2a) Rp404.000; batas 24 bulan; Pasal 31E Rp387,2 juta; branch profit tax Rp156 juta; thin cap Rp1 miliar; PBB-P5L; pesangon Rp50,5 juta; penyusutan GL/SM; jasa konstruksi; kredit PPh 24; NPPN; PPh 25 | Lulus |
| `npm run verify` (98 cek; 13 baru: bank orisinal, sumber baru, adaptasi, drill jebakan) | Lulus |
| `npm run verify:export` (52 cek; 12 baru: HTML uji tanpa kunci, statistik 40 sesi simulasi, pemadanan versi, impor hasil) | Lulus |
| `npm run verify:quality` (40 cek, 90 paket campuran: posisi kunci merata) | Lulus |
| `npm run build` | Lulus |
| Browser: tab Uji peserta (statistik 100 baris); tombol "Adaptasi identitas semua acuan" (75 soal, blok tetap utuh); Pustaka 21 model; semua 8 berkas data termuat 200 | Lulus |
| Browser: berkas uji HTML (12 soal) dibuka seperti oleh peserta: nama, timer 180 menit, jawab, navigasi, tanpa kunci/pembahasan | Lulus |

Yang dibuat di Tahap 5:

- **11 model lanjutan:** sanksi bunga KMK (tabel tarif disebut sebagai fakta di soal, konsisten dengan rumus uplift), NPPN, penyusutan fiskal, Pasal 31E, angsuran PPh 25, thin capitalization, branch profit tax, PBB-P5L, PPh final jasa konstruksi, kredit PPh 24, dan PPh 21 final pesangon.
- **Adaptasi identitas:** nama badan, singkatannya, dan nama orang diganti secara konsisten per blok kasus. Angka, tanggal, lokasi, kunci, dan institusi nyata tidak diubah. Hasilnya tetap berstatus turunan sumber untuk K2.
- **Bank orisinal:** 10 soal ditulis dari fakta kartu aturan (`data/ukp-kasus/`) dan ikut sumber "Soal baru".
- **Drill jebakan aturan:** sudah ada sejak Tahap 2 dan diuji ulang; pool ≥ 300 soal.
- **Uji peserta:** berkas HTML mandiri, impor hasil JSON, dan statistik butir. Respons dicocokkan dengan uid + checksum; label empiris dan daya beda dihitung pada ≥ 30 sesi.

Temuan dan penanganannya:

- **Posisi kunci tidak merata lagi.** Dengan ±33 soal model per paket, soal angka yang urutannya tetap sempat berkunci B sebanyak 28 (batas 27). Perakit sekarang memilih calon soal model yang posisi kuncinya paling jarang di paket itu; 90 paket merata.
- **Pengecoh kurang di dua model.** Penyusutan (6 bulan) dan pesangon (di bawah Rp60 juta) kekurangan pengecoh karena kandidat kebetulan bernilai sama. Ditambah pengecoh bermakna.
- **Tanggal bayar setelah tanggal acuan.** Model sanksi bunga bisa membuat tanggal bayar sesudah tanggal acuan. Tahun dasarnya digeser ke tahun lalu.
- **Satu soal orisinal dibatalkan,** yaitu kedaluwarsa bea meterai kuitansi, karena saat terutangnya tidak jelas di kartu. Contoh jatuh tempo PBB juga tidak konsisten antara kartu dan bank, sehingga soal PBB ditulis tanpa bergantung pada cara menghitung hari.
- **Berkas uji QC sempat ditaruh di `public/_qc/`.** Sudah dihapus supaya tidak ikut ter-deploy.

Belum dibuat dan dicatat di ROADMAP: model PPh 21 TER (tabel lampiran PP 58/2023 belum ada sebagai data), pemajakan keluarga PH/MT, rekonsiliasi fiskal dan pajak tangguhan, PPh 21 harian, CFC, serta PPN besaran tertentu. Bank orisinal baru 10 soal.

## QC akhir lintas tahap (2 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus |
| `npm run verify` | 98 cek lulus |
| `npm run verify:quality` | 40 cek lulus |
| `npm run verify:models` | 114 cek lulus |
| `npm run verify:export` | 52 cek lulus |
| `npm run build` (Next 16.4.3) | Lulus |
| `npm audit` | 0 kerentanan |
| `agent-office.json` valid; opsi dan format sesuai `--help` (dicek otomatis di `verify`) | Lulus |
| `public/` hanya berisi `data/` (tanpa sisa artefak QC) | Lulus |

Total 304 cek otomatis lulus. Risiko sisa yang perlu keputusan atau telaah manusia:

1. **K8 · Penelaah materi.** Parameter, 21 model, dan 10 soal orisinal belum disahkan ahli pajak. Semua angka diambil dari kartu LatihUKP per Oktober 2026.
2. **K3 · Tingkat soal.** Tingkat masih mengikuti label sumber, belum disahkan terhadap Cakupan Materi UKP BPPK.
3. **K2 · Hak pakai.** Paket campuran berisi sekitar 67% soal acuan LatihUKP. Ekspor SiAdu untuk produksi sebaiknya memakai opsi "keluarkan soal acuan" sampai hak pakainya jelas, atau setelah bank orisinal diperbanyak.
4. **SiAdu sungguhan.** Penyimpanan ke akun SiAdu belum diuji. Format sudah lolos konverter skill dan memakai pola SKD Generator.
5. **Pola tebakan.** Pada soal angka dari bank, setelah opsi diurutkan, kunci condong ke B/C.

# Generator Materi (PRD-Materi.md)

## M0 · Keputusan dan desain (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| PRD-Materi disetujui; KM1–KM10 memakai usulan bawaan | Lulus |
| Tiga opsi tampilan tab Materi di kanvas desain; dipilih B, gabungan B+ disetujui dan tercatat di PRD-Materi bagian 19 | Lulus |
| Uji kelayakan 8 slide dari data UKP terbuka di PowerPoint tanpa perbaikan (`docs/materi/uji-coba-materi.pptx`) | Lulus |

## M1 · Mesin PPTX (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| Paket dasar `npm run materi:dasar`: 52 bagian, 16 media (ikon dengan pasangan SVG), font tertanam hanya Poppins Regular/Bold, font tema Poppins, tanpa slide | Lulus. Arial Nova (font Microsoft) dan Inter dibuang |
| Metrik Poppins: 212 huruf diukur dari PowerPoint; lebar kalimat acuan tidak lebih sempit dari PowerPoint dan selisih ≤ 6% | Lulus |
| `npm run verify:materi`: 69 subtema dari 334 kartu aturan nyata → 69 deck, 2.072 slide; struktur paket dan tata letak bersih; pemutusan baris dicocokkan dengan PowerPoint | 74 cek lulus |
| Teks isi tidak pernah dipotong; label yang dipotong (judul kartu ikhtisar dari naskah uji) | 0 isi; 22 label (1,1%) ditandai untuk disunting |
| Kasus tepi: 12 kartu, tabel 25 baris, 15 poin, isi 3.000 huruf, 9 langkah, 7 definisi, simbol `& < > "` dan karakter kontrol, judul sangat panjang, slide tersembunyi, navigasi > 6 label, pola tidak dikenal | Lulus |
| Determinisme: naskah sama → berkas identik (SHA-256) | Lulus |
| Uji render PowerPoint 4 deck contoh (`scripts/materi-render.ps1`): dibuka tanpa perbaikan, 2.168 kotak teks, hanya Poppins | 0 teks meluap |
| Uji render PowerPoint penuh: ke-69 deck (`verify:materi --semua` lalu `materi-render.ps1 output/materi-semua`) | 69 deck dibuka tanpa perbaikan, 23.274 kotak teks, 0 meluap (setelah temuan 9 diperbaiki) |
| QC visual (PNG hasil render) | Lulus setelah perbaikan di bawah |
| Rangkaian lama: typecheck, verify 98, verify:quality 40, verify:models 114, verify:export 52 | Lulus |
| `npm run build`, `npm audit` | Lulus, 0 kerentanan |

Temuan dan perbaikan selama QC M1:

1. Pemeriksa paket salah membaca `_rels/.rels` di akar paket (regex nama berkas). Diperbaiki.
2. Teks pembuka dan kartu ikhtisar sempat dipotong di 95 slide. Diperbaiki: kalimat pembuka yang tidak muat pindah ke isi, kartu ikhtisar per slide dikurangi (kartu melebar), dan slide kesalahan umum dipecah menjadi penjelasan + perbandingan.
3. Galat pecahan desimal (3 × 18 × 1,2 = 2,999… baris) membuat sel tabel terpotong. Diperbaiki dengan toleransi pembanding.
4. PowerPoint menghitung tinggi baris terakhir ±1,5 pt lebih besar. Ditambahkan cadangan 0,15 × ukuran huruf. Semua tinggi kotak kini memakai satu fungsi pengukur (`ruang()`, `pasUkuran`).
5. BoundWidth PowerPoint ikut menghitung spasi di ujung baris (tidak tampil). Pemeriksa render memberi kelonggaran satu spasi pada lebar, sedangkan tinggi tetap ketat.
6. QC visual: isi konsep turun sampai 18 pt (terlalu kecil untuk ditayangkan), tabel sampai 13 pt, kartu terlalu tinggi untuk isi pendek, dan judul ikhtisar patah dua baris. Batas minimum dinaikkan (PRD-Materi bagian 11), kartu dibuat setinggi isinya, dan judul diutamakan satu baris.
7. Ukuran huruf slide lanjutan bisa berbeda dari slide pertama. Kini dikunci sama setelah dipecah (dicek otomatis).
8. Calibri ikut terdaftar karena font tema template. Font tema diganti Poppins di paket dasar.
9. Uji render penuh pertama menemukan 1 luapan dari 23.282 kotak: judul kartu "PP 20/2026 anti-pemecahan usaha". PowerPoint memutus baris setelah tanda hubung, sedangkan mesin memutus kata panjang per huruf. Aturan pemutusan diuji lewat COM: tanda hubung adalah titik putus, garis miring bukan. Mesin disesuaikan, dan 10 kasus hasil ukur PowerPoint menjadi cek otomatis.

## M2 · Penyusun naskah (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `susunNaskah`: 69 subtema × 3 kepadatan dari aturan, kartu rumus/hafalan, kuis B/S, dan contoh soal model/orisinal | Ringkas 822 slide (maks 28/deck), Standar 1.519 (maks 58), Lengkap 2.402 (maks 91) |
| Pola baru P8 Rumus, P9 Angka besar, P11 Kuis (pernyataan lalu jawaban), P12 Contoh soal, P13 Pembahasan, P14 Rangkuman, termasuk kasus tepi (15 baris rumus, 7 butir kuis, kasus 2.000 huruf, 9 langkah, 9 poin) | Lulus; isi tidak pernah dipotong, nomor berlanjut di slide lanjutan |
| Tanggal acuan dan tingkat menyaring aturan; aturan yang dikeluarkan dicatat untuk penelaah | Lulus (R-KUP-01 keluar pada 2024-06-01; tingkat A tanpa aturan C) |
| Contoh soal: sumber "baru" hanya model/orisinal; "bank" memakai bank acuan bertanda acuan; kunci dan teks kunci pembahasan cocok dengan soal | Lulus; 22 subtema punya model/orisinal, 50 subtema punya kuis terpetakan |
| Catatan pembicara (ID aturan, keyakinan, berlaku, dasar hukum, sumber, kunci kuis/soal) di setiap slide; dibaca ulang dari PowerPoint lewat COM | Lulus |
| Tanda Draf internal (KM2) di properti berkas dan catatan bila ada teks acuan; hilang bila semua ditulis ulang atau deck ditelaah | Lulus |
| Ketentuan lama di teks naskah dicatat untuk penelaah (uji sisipan "disetor tanggal 10") | Lulus |
| Deterministik: naskah dan berkas identik untuk pengaturan sama; seed berbeda → contoh soal berbeda | Lulus |
| `npm run verify:materi` | 112 cek lulus pada akhir M2 |
| Uji render PowerPoint penuh: 69 deck naskah Standar | 69 dibuka tanpa perbaikan, 16.349 kotak teks, 0 meluap; diulang dengan kode final setelah perbaikan 6–7: 16.347 kotak teks, 0 meluap |
| Uji render sampel + QC visual (PNG): deck PPh 21 final (3 kepadatan) dan kasus tepi pola baru | 8 deck, 3.422 kotak teks, 0 meluap |

Temuan dan perbaikan M2:

1. Baris kuis dan pembahasan meluap 4 pt: rencana tinggi memakai bantalan 10 pt, kotak digambar dengan 12 pt. Disamakan.
2. Judul kartu "Contoh" di slide rumus 1 pt kurang tinggi. Tinggi kotak memakai `ruang()`.
3. Keterangan rumus panjang terpotong. Lampiran rumus kini disusun berdampingan, lalu bertumpuk, lalu satu per slide, tanpa memotong.
4. Kepadatan Standar terlalu gemuk (1 slide kesalahan umum per aturan). Di Standar, kesalahan umum dirangkum dalam satu tabel; slide per aturan hanya di Lengkap. Standar turun dari 1.751 menjadi 1.519 slide.
5. Label pendek "Pemotong PPh 21/26 dan pihak" menggantung. Pemotongan kini didahulukan sebelum "dan/serta/atau".
6. Soal model tanpa kasus terpisah tampil tebal seluruhnya. Kalimat terakhir menjadi pertanyaan, sisanya kasus.
7. Kartu rumus menyisakan 40% ruang di setiap slide walau rumus belum selesai. Ruang hanya disisakan di slide tempat rumus terakhir muat.

## M3 · Tab Materi (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| Tab "Materi" (desain B+ Materi): panel cakupan dengan status per subtema dan saring, susun beberapa deck, tab deck, strip angka, catatan penyusun, tabel naskah, mode Perbesar (deretan slide + pratinjau besar), panel isian per pola, pemeriksaan slide, catatan pembicara, atur slide (naik/turun/gandakan/sembunyikan), urungkan, kembalikan teks acuan, tandai ditelaah, hapus deck | Lulus di browser (1440 dan 375 px) |
| Pratinjau di browser dari kotak tata letak yang sama dengan .pptx (Poppins, gradien, ikon SVG) | Lulus; tampilan sama dengan render PowerPoint |
| Sunting judul: asal slide berubah menjadi "Ditulis ulang", tata letak dihitung ulang, riwayat bertambah, tersimpan di IndexedDB setelah muat ulang | Lulus |
| Unduh: dialog konfirmasi Draf internal untuk deck bertek acuan yang belum ditelaah; berkas .pptx dibuat di browser (2,4 MB, zip sah) | Lulus (unduhan dicegat di memori saat uji) |
| Impor naskah .json, ekspor naskah, unduh .zip beberapa deck | Logika dicek otomatis (`bacaNaskah`, `buatDeck`, `zip`) |
| Logika deck (sunting, kembalikan, urungkan, atur slide, batas riwayat 20, status telaah kembali draf setelah disunting, opsi ditelaah tanpa tanda Draf) | 12 cek di `verify:materi` |
| Lebar 375 px: tanpa geser horizontal; konsol tanpa galat | Lulus |
| Rangkaian lengkap: typecheck, verify 98, verify:quality 40, verify:models 114, verify:export 52, verify:materi 124 | 428 cek lulus |
| `npm run build`, `npm audit` | Lulus, 0 kerentanan |

Temuan dan perbaikan M3: kotak pilihan "Sumber contoh soal" melebar keluar panel kiri pada layar sempit; isian di tab Materi kini selebar kolomnya.

Risiko sisa materi: isi deck masih teks acuan LatihUKP (KM2) dan belum ditelaah ahli (K8); 47 subtema belum punya contoh soal model/orisinal dan 19 belum punya kuis terpetakan; pemetaan kartu ke subtema memakai kemiripan kata (bisa keliru, terlihat di catatan pembicara "Kartu ...").

## Cakupan tingkat dan lingkup materi (3 Nov 2026)

Keputusan user: cakupan mengikuti pembagian di `docs/Cakupan-Materi-UKP.xlsx` (dari label soal bank), soal berlabel lebih tinggi dari subtemanya tetap di tingkat labelnya, dan sebaran kesulitan bawaan dibedakan per tingkat. Lihat PRD K3 dan K4.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run import:data` menulis `subtema` di `data/ukp-mapping.json`: 69 subtema, A 33, B 23, C 13; berkas data lain tidak berubah (dibandingkan byte demi byte) | Lulus |
| Tingkat soal = yang lebih tinggi antara tingkat subtema dan label; 81 soal PPh 22/23 berlabel B di luar cakupan A; stok kumulatif A 1.170, A+B 1.884, A+B+C 2.387 | Lulus (`verify`) |
| Paket tiap tingkat hanya memuat subtema dalam cakupannya; Tingkat A tanpa PBB, AKT, BDN, BTI, INT | Lulus (`verify`, browser) |
| Komposisi bawaan A 40/45/15, B 30/50/20, C 20/50/30 di Atur paket (berganti saat tingkat diganti) dan CLI `--kesulitan` bila kosong | Lulus (`verify`, browser, CLI) |
| 5 paket × 100 soal untuk A, B, C dengan komposisi bawaan, sumber bank dan campuran | Lulus (`verify`) |
| Deck materi: daftar subtema A 33, A+B 56, A+B+C 69; kartu aturan ikut tingkat subtema; sampul menulis tingkat subtema; subtema B ditolak di deck A | Lulus (`verify:materi`) |
| Tab Materi lingkup Subtema / Materi (kode) / Tingkat, opsi "hanya subtema yang mulai di tingkat ini" (B 23, C 13), pilih semua/kosongkan, kelompok per materi, pilihan deck berupa daftar bila lebih dari 6 deck | Lulus di browser |
| Susun 23 deck tambahan Tingkat B sekaligus; unduh .zip dengan dialog Draf internal, 23 .pptx dalam 5 folder kode (54 MB, sekitar 4 detik) | Lulus (unduhan dicegat di memori; deck uji dihapus dari IndexedDB pratinjau) |
| Lebar 375 px: tanpa geser horizontal | Lulus |
| Rangkaian lengkap: typecheck, verify 114, verify:quality 40, verify:models 114, verify:export 52, verify:materi 128; `npm run build` | 448 cek lulus, build lulus |

Temuan dan perbaikan:

1. Cek persediaan menghitung anggota blok kasus sebagai stok penuh per kesulitan. Akibatnya cek bisa lulus lalu perakitan gagal (terlihat pada Tingkat C 10 paket dengan 30% sulit). Sekarang batas per kesulitan memakai `stokSel` (anggota blok hanya sebanyak kuota kasus), dan perakit mengisi sisa sel dengan blok kasus tambahan yang muat.
2. Label tiga model disamakan dengan soal bank topiknya (bunga sanksi 41 soal A, NPPN 20 soal A, jasa konstruksi 14 soal A): `sanksi-bunga`, `nppn`, dan `jasa-konstruksi` menjadi A.

Risiko sisa:

- Pembagian tingkat belum disahkan terhadap dokumen BPPK (K3).
- 56 soal bank bertipe "Tingkat B" berlabel tingkat A, jadi ikut paket A. Ini mengikuti data sumber.
- 10 paket × 100 soal tanpa kembar di Tingkat A atau B (sumber bank/campuran) bisa gagal saat dirakit karena kurang 1–4 soal, padahal cek persediaan lulus. Ini sudah terjadi dengan aturan lama dan komposisi 30/50/20. Pesan galatnya menyebut materi dan jumlah kekurangannya.
- Uji render PowerPoint tidak diulang karena tata letak tidak berubah; teks pil sampul hanya menjadi lebih pendek.

## M4 · Produksi dan QC akhir materi (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| CLI `npm run materi`: lingkup per subtema (`--subtema`), per materi (`--kode`), dan per tingkat (tanpa keduanya, opsi `--hanya-baru`); `--daftar` A 33 subtema, tambahan B 23 | Lulus (`verify:materi`, uji manual) |
| Penolakan dengan `Error:` dan kode keluar 1: .pptx bertek acuan tanpa `--setuju-acuan` (KM2), subtema/kode di luar cakupan tingkat, opsi tidak valid; `--format json` tanpa persetujuan diizinkan | Lulus |
| Hasil: `laporan.json` per deck (tingkat subtema, slide, teks meluap, catatan penyusun, Draf internal), .pptx/.json dengan folder per kode, atau satu .zip tanpa kompresi ulang dengan nama sama dengan tab Materi | Lulus; .zip tambahan Tingkat C berisi 13 .pptx sah di folder AKT, BTI, INT |
| Satu tingkat penuh lewat CLI: Tingkat A 33 deck, 746 slide, 0 teks meluap, sekitar 9 detik | Lulus |
| Uji render PowerPoint atas 33 deck CLI Tingkat A (script render kini membaca subfolder) | 33 deck terbuka, 8.293 kotak teks, 0 meluap |
| `agent-office.json`: job `buatmateri` (opsi dicek terhadap `--help`), bantuan tingkat dan kapasitas paket diperbarui (bank tanpa kembar: A 9, B 7, C 10 paket tryout 100 soal) | Lulus (`verify`, `verify:materi`) |
| Rangkaian lengkap: typecheck, verify 114, verify:quality 40, verify:models 114, verify:export 52, verify:materi 137 | 457 cek lulus |
| `npm run build`, `npm audit` | Lulus, 0 kerentanan |

Risiko sisa:

- Isi deck masih teks acuan LatihUKP (KM2) dan belum ditelaah ahli (K8), jadi semua .pptx bertanda Draf internal.
- Pembagian tingkat belum disahkan terhadap dokumen BPPK (K3).
- Tanda Ditelaah dan suntingan naskah hanya ada di tab Materi. CLI selalu menyusun ulang dari data.

## Label tingkat seragam (3 Nov 2026)

Semua label tingkat di layar sekarang memakai helper di `lib/config.ts` (`labelTingkat`, `singkatTingkat`, `diujiDi`, `ujianUntuk`):

- **Tingkat ujian:** "Tingkat A", "Tingkat B · A+B", "Tingkat C · A+B+C". Dipakai di tombol Atur paket, ringkasan, dan Riwayat. Tab Materi memakai bentuk ringkas "A", "B · A+B", "C · A+B+C" di bawah judul "Tingkat".
- **Subtema/soal:** "diuji di A, B, C", "diuji di B, C", "diuji di C". Dipakai di daftar subtema tab Materi, saringan dan tabel Pustaka, kartu aturan, dan tabel model.
- **Tidak diubah:** ekspor (PDF/Word/SiAdu), sampul deck, dan CLI tetap menulis "Tingkat X" sebagai nama resmi ujian.

| Pemeriksaan | Hasil |
| --- | --- |
| Cek baru di `verify`: label cocok dengan `dalamCakupan` untuk semua pasangan tingkat | Lulus (verify 115) |
| Browser 1440 dan 375 px: Atur paket, Materi, Pustaka tanpa geser horizontal | Lulus |
| typecheck, build | Lulus |

## Materi dibedakan per tingkat: deck gabungan per materi (3 Nov 2026)

Keputusan user: materi dibedakan per tingkat dengan **satu deck per materi per tingkat**. Isi deck subtema tidak dibedakan, karena kartu aturan tidak memisahkan bagian dasar dan pendalaman.

| Pemeriksaan | Hasil |
| --- | --- |
| `susunNaskahMateri`: PP Tingkat A 7 bagian, PP Tingkat B · A+B 8 bagian; "Tata cara penyetoran & pelaporan" bertanda "Tingkat B (baru)" di daftar isi dan "baru di Tingkat B" di pembatas | Lulus (`verify:materi`) |
| Isi tiap bagian = deck subtemanya tanpa sampul dan penutup; navigasi bawah ikut subtema (`nav` per slide); subset subtema dihormati; materi di luar cakupan ditolak; ekspor-impor naskah; nav slide lebih dari 6 ditolak | Lulus |
| 24 deck gabungan ringkas (A 5, A+B 9, A+B+C 10 materi): tata letak, berkas, id unik, navigasi, daftar isi satu slide | Lulus |
| Daftar isi memakai tabel `rapat` (baris min 40 pt) supaya 8 subtema muat satu slide; sebelumnya terpecah 6 + 2 | Diperbaiki |
| Contoh soal: deck Tingkat A memakai soal A; deck Tingkat B mendahulukan soal berlabel B (PPh 22/23 dengan sumber bank) | Lulus |
| CLI `--gabung` (`materi-bm-tingkat-a.pptx`); job agent-office mendapat isian "Satu deck per materi" | Lulus |
| Tab Materi: pilihan Bentuk deck (Per subtema / Satu per materi); 9 deck gabungan Tingkat B disusun dalam 0,4 detik; unduhan `materi-tingkat-b-per-materi-9-deck.zip` 24,9 MB; lebar 375 px tanpa geser | Lulus di browser (unduhan dicegat; deck uji dihapus) |
| Uji render PowerPoint: 24 deck gabungan standar (3.391 slide) dan 138 deck subtema (69 deck uji mesin + 69 naskah standar) | Semua terbuka; 38.431 dan 39.614 kotak teks; 0 meluap |
| Rangkaian lengkap: typecheck, verify 115, verify:quality 40, verify:models 114, verify:export 52, verify:materi 146; build | 467 cek lulus |

Perbaikan kecil yang ikut:

- Judul sampul gabungan memberi spasi di sekitar "/" ("PPh Pemotongan / Pemungutan"), supaya tidak terputus di tengah kata.
- Label pendek tidak lagi berakhir dengan tanda baca ("…tanggal 15," menjadi "…tanggal 15").

Contoh hasil: `docs/materi/gabung-pp-tingkat-b.png` (sampul, daftar isi, pembatas, dan isi bagian 1 dan 8).

Risiko sisa:

- Deck gabungan panjang (PP standar sekitar 200 slide); untuk sesi kelas, kepadatan ringkas (sekitar 95 slide) lebih cocok.
- Status Ditelaah dicatat per deck, jadi deck gabungan dan deck subtema ditelaah terpisah.

## Ekspor di panel Cakupan deck (3 Nov 2026)

Permintaan user: lingkup yang memuat banyak deck harus punya pilihan unduh langsung sebagai .zip dari panel Cakupan deck.

| Pemeriksaan | Hasil |
| --- | --- |
| Tingkat A, lingkup Tingkat, per subtema, .pptx: 31 deck yang belum ada disusun dulu, lalu `materi-tingkat-a-33-deck.zip` (78 MB, folder KUP, OP, PP, PPN, BM), dengan dialog Draf internal | Lulus |
| Format .json: `materi-tingkat-a-33-deck-naskah.zip` (0,2 MB), tanpa dialog Draf internal | Lulus |
| Per materi + keduanya: `materi-tingkat-a-per-materi-5-deck.zip` berisi 5 .pptx dan 5 .json | Lulus |
| Satu subtema: langsung `materi-pp-pph-21-pemotong-penerima-objek.pptx` tanpa .zip | Lulus |
| Tombol pilihan panel kiri (Tingkat, Lingkup, Bentuk deck, Kepadatan, Format) satu baris pada lebar panel minimum 260 px, tanpa teks terpotong; label "Materi (kode)" menjadi "Materi" dan "Satu per materi" menjadi "Per materi" | Lulus |
| verify 115, verify:quality 40, verify:materi 146; typecheck dan build | Lulus |

Unduhan diuji di browser dengan dicegat di memori. Deck uji dihapus dari IndexedDB pratinjau.

## R3 · Pengesahan tingkat terhadap dokumen BPPK (3 Nov 2026)

Dokumen: *Cakupan Materi Uji Kompetensi Perpajakan* (BPPK, 14 Okt 2026), 12 halaman, 282 KB, diunduh dari KLC Kemenkeu (tautan resmi yang tercatat di data LatihUKP) ke `../Scrape UKP/output/bppk/` atas izin user.

| Pemeriksaan | Hasil |
| --- | --- |
| `data/bppk-cakupan.json`: 69 subtema dipetakan ke butir dokumen (tingkat terendah, rujukan butir, keyakinan, catatan) | 69/69; 60 cocok dengan hasil impor, 9 berbeda |
| 9 perbedaan diterapkan lewat `override` setelah disetujui user: Tata cara penyetoran B→A; Jasa konstruksi B→C; BTI Subjek badan dan Tarif PMA/BUT B→C; 5 subtema PBB-P5L B→C. `override` bertahan setelah `npm run import:data` | Lulus |
| Cakupan efektif A 34, B 14, C 21; stok bank kumulatif A 1.173, A+B 1.731, A+B+C 2.387; deck materi A 34, A+B 48, A+B+C 69 | Lulus (`verify`, `verify:materi`) |
| Cek baru: tingkat efektif sama dengan dokumen BPPK untuk 69 subtema; override hanya untuk subtema yang berbeda dari impor | Lulus |
| `docs/Cakupan-Materi-UKP.xlsx` dibuat ulang dengan kolom Rujukan BPPK dan keterangan "Diubah sesuai BPPK"; dihitung ulang di Excel | 196 rumus, 0 galat |
| Angka cakupan di README, PRD, PRD-Materi, ROADMAP, bantuan CLI `npm run materi`, dan `agent-office.json` | Diperbarui |
| Rangkaian lengkap: verify 117, verify:quality 40, verify:models 114, verify:export 52, verify:materi 147 | 470 cek lulus |

Temuan pada dokumen BPPK:

- Baris Tingkat B no. 4 berlabel "PBB-P5L", tetapi 17 butirnya PPh Badan. PBB-P5L dengan butirnya sendiri hanya ada di Tingkat C, sehingga dipetakan ke C.
- Pajak minimum global (GloBE) tidak disebut.
- Topik yang sama bisa muncul di beberapa tingkat dengan subjek berbeda (orang pribadi, badan dalam negeri, transaksi internasional). Kemunculan terendah menjadi tingkat subtema; kemunculan di atasnya menjadi pendalaman (soal berlabel lebih tinggi).

Risiko sisa: dua subtema PBB (pendaftaran/SPOP/SPPT, pembayaran dan denda) tidak disebut tersendiri di dokumen, sehingga keyakinannya rendah.

## R1 · Alur telaah per slide dan lembar telaah (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| Slide punya `telaah` (Sesuai / Perlu diubah, catatan, penelaah, waktu). `telaahSlide` tidak mengubah asal dan tidak menurunkan status deck; menyunting isi slide menghapus hasil telaahnya | Lulus (`verify:materi`) |
| Slide teks acuan yang ditelaah Sesuai tidak lagi membuat deck Draf internal (KM2); catatan pembicara tanpa "DRAF INTERNAL" | Lulus |
| Lembar telaah .xlsx (kolom Deck, ID slide, isi slide, Status, Catatan, Penelaah, plus lembar Petunjuk): tulis → isi → baca → terapkan; impor ulang tanpa perubahan melewati semua baris; lembar tanpa kolom wajib ditolak | Lulus |
| Pembaca .xlsx: sharedStrings, teks kaya, entitas XML, kolom berlubang | Lulus (uji sintetis) |
| Uji Excel sungguhan: lembar diisi dan disimpan ulang oleh Microsoft Excel (sharedStrings), lalu dibaca kembali: 6 baris, catatan "Tarif & dasar hukum dicek ulang <PMK>" utuh, 6 diterapkan | Lulus |
| Tab Materi: kolom status di tabel slide, saringan Semua / Belum ditelaah / Perlu diubah, panel "Telaah slide ini" (status, catatan, nama penelaah tersimpan di browser), angka "x / y slide ditelaah", tombol Lembar telaah .xlsx dan Impor lembar telaah; "Tandai deck ditelaah" menampilkan progres | Lulus di browser |
| typecheck, build, verify:materi 156 | Lulus |

Catatan uji: di pane browser yang tidak aktif, `blur()` tidak memicu `focusout`, jadi penyimpanan catatan diuji dengan `focusout`. Pengguna sungguhan memicunya saat berpindah dari kotak catatan.

## R2 · Lapisan tulis ulang dan contoh Bea Meterai (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `data/ukp-tulis.json`: 15 kartu aturan, 7 kartu hafalan/rumus, dan 8 kuis Bea Meterai ditulis ulang dengan kalimat sendiri; dimuat di Node dan browser (disalin ke `public/data`) | Lulus |
| Angka, tanggal, dan nomor pasal sumber tetap ada di teks tulis ulang (diperiksa per item) | 0 hilang (3 rujukan yang sempat hilang dikembalikan: Pasal 3 ayat (2), masa transisi 1 tahun, Pasal 23) |
| Setiap teks panjang berbeda dari sumber (bukan salinan); field fakta pendek (subjek, tarif, ambang, tenggat) boleh sama | Lulus |
| Deck Bea Meterai 4 subtema × 3 kepadatan dan deck gabungan: tanpa slide teks acuan, bukan Draf internal; kuis memakai teks baru dengan kunci dari sumber; catatan pembicara menandai "teks ditulis ulang (belum ditelaah)"; materi lain tetap teks acuan | Lulus (`verify:materi`) |
| CLI: `npm run materi -- --kode BM` tidak lagi meminta `--setuju-acuan`; penolakan KM2 diuji dengan subtema KUP | Lulus |
| Uji render PowerPoint 13 deck BM (ringkas, standar, lengkap, gabungan) | 3.031 kotak teks, 0 meluap |
| verify 117, quality 40, models 114, export 52, materi 164 | 487 cek lulus |

Risiko sisa: teks tulis ulang belum ditelaah ahli pajak (K8); status telaahnya dicatat lewat alur R1.

## R12 · Cadangan lengkap untuk tim (3 Nov 2026)

Keputusan user: berkas cadangan lengkap tanpa server.

| Pemeriksaan | Hasil |
| --- | --- |
| `lib/cadangan.ts`: buat dan baca cadangan lengkap (paket, deck materi beserta hasil telaah, sesi uji); setiap paket diperiksa seperti cadangan satu paket, setiap naskah lewat `bacaNaskah` | Lulus (`verify`) |
| Cadangan rusak ditolak dengan pesan yang menyebut bagiannya (paket ke-n, deck materi id); cadangan satu paket dikenali bukan cadangan lengkap | Lulus |
| Gabung: id baru ditambah, versi berkas lebih baru mengganti, versi browser lebih baru dibiarkan | Lulus |
| Browser: menu Cadangan (paket ini / lengkap / impor keduanya); unduh `ukp-studio-cadangan-lengkap-2026-11-03.json` (1 paket, 3 deck, 914 KB); deck yang dihapus pulih setelah impor; tab Materi memuat ulang otomatis | Lulus (unduhan dicegat; data uji dihapus) |
| Label status deck: "Draf internal" hanya bila masih ada teks acuan yang belum ditelaah; deck lain "Belum ditelaah" | Diperbaiki |
| verify 121; typecheck; build | Lulus |

## R6 · Kapasitas paket: pergeseran kesulitan yang tercatat (3 Nov 2026)

Masalah: banyak paket tanpa soal kembar di Tingkat A/B bisa gagal dirakit karena kurang 1–4 soal pada satu kesulitan, padahal cek persediaan lulus.

| Pemeriksaan | Hasil |
| --- | --- |
| Langkah 6 perakit: sel yang kosong diisi dari kesulitan terdekat pada materi yang sama (soal bank, lalu model bila sumbernya mengizinkan); setiap pergeseran dicatat sebagai "Paket n · KODE: x soal sulit diganti sedang (stok sulit habis)" | Lulus (`verify`) |
| 10 paket bank Tingkat A: berhasil, jumlah soal per materi sesuai kuota, tanpa soal kembar, pergeseran hanya di paket 10 | Lulus |
| 5 paket Tingkat A/B/C (bank dan campuran) dengan komposisi bawaan: tanpa pergeseran | Lulus |
| Kapasitas tanpa kembar (tryout 100 soal) diukur ulang. Bank: A 9→10, B 7→14, C 10→19 paket. Campuran: A 14, B 15, C 20+. Pergeseran baru muncul mulai paket ke-10/11 | Diperbarui di README dan `agent-office.json` |
| Pesan di aplikasi, RINGKASAN CLI, dan `validasi.json` (`geserKesulitan`) menyebut jumlah dan rincian pergeseran | Lulus (CLI A 10 paket: 5 soal) |
| verify 124, verify:quality 40; typecheck | Lulus |

## R4 · Empat model soal baru (3 Nov 2026)

Subtema berbobot besar tanpa model: Pengkreditan Pajak Masukan (PPN, A), Rekonsiliasi fiskal (AKT, B), Pajak tangguhan PSAK 212 (AKT, B), dan Pembetulan, keberatan & pengurangan (KUP, A). Model ada di `lib/models/tambahan.ts`.

| Pemeriksaan | Hasil |
| --- | --- |
| Parameter baru `sanksi.keberatan` (0,5 → 0,3 sejak 29 Okt 2021) dengan `dasar`; format berkas parameter dipertahankan; disalin ke `public/data` | Lulus |
| Uji emas 13 cek: PM (13,2 jt − PM yang boleh dikreditkan), PKP dan PPh badan hasil rekonsiliasi, liabilitas dan beban pajak tangguhan, denda keberatan ditolak, dikabulkan sebagian, banding (Rp0), dan tarif 50% sebelum UU HPP | Lulus |
| 240 seed per model: hitung ulang = kunci, 3 pengecoh berbeda dengan alasan dan penyebab yang dikenal, rujukan aturan valid, cek mutu tanpa gagal, deterministik; kapasitas 48 / 48 / 48 / 48 | Lulus |
| Konteks PM hanya usaha yang penyerahannya objek PPN (hotel, restoran, rumah sakit, sekolah dikeluarkan) | Diperbaiki |
| Posisi kunci: model baru awalnya condong ke A (D 3%); ditambah pengecoh bernilai di bawah kunci (tarif PPN lama, faktor 11/12 ganda, tarif Pasal 31E/UMKM, denda dari pajak yang dibayar). Seluruh model: A 23%, B 33%, C 33%, D 10,8% (batas ≥ 10%) | Diperbaiki |
| Pengecoh "tarif × laba komersial" tidak lagi berakhiran ganjil (laba dibulatkan dulu) supaya tidak mudah ditebak | Diperbaiki |
| Bahasa contoh soal tiap model dibaca ulang | Lulus |
| verify:models 139 (6.000 soal model), verify 124, verify:quality 40, verify:materi 164; typecheck | Lulus |

## R5 · Bank soal orisinal (3 Nov 2026)

Sebelumnya bank orisinal berisi 10 soal, 45 subtema tidak punya soal non-acuan sama sekali, dan INT kosong. Ditambah 46 soal di `data/ukp-kasus/` (PPN 7, KUP 6, PP 3, BM 2, OP 3, AKT 4, BDN 3, BTI 5, PBB 2, INT 11). Faktanya dari kartu aturan; nama, angka, dan tanggal dibuat sendiri (tidak menyalin contoh kartu yang berasal dari LatihUKP). `keyakinan` tetap "Sedang" sampai ditelaah (K8).

| Pemeriksaan | Hasil |
| --- | --- |
| Penulis JSON mereproduksi keempat berkas lama byte demi byte, jadi gaya berkas tetap | Lulus |
| Pemeriksaan mandiri: subtema ada di mapping, rujukan aturan ada, batang diakhiri "...", tanpa opsi kembar, rasio panjang opsi ≤ 3, kunci tidak lebih dari 1,2× opsi terpanjang berikutnya, penyebab salah dikenal | Lulus (2 soal diratakan panjang opsinya) |
| `cekSoal` atas 56 soal orisinal setelah opsi diurutkan: tanpa gagal dan tanpa peringatan; kunci tetap | Lulus |
| Kunci tersebar A 12, B 12, C 11, D 11; tingkat A 21, B 9, C 16; kesulitan mudah 15, sedang 21, sulit 10 | Lulus |
| Subtema tanpa soal non-acuan: 45 → 4 (OP NPWP & pendaftaran, PP Tata cara penyetoran, PBB Pendaftaran/SPOP/SPPT, AKT Bank) | Dicatat di ROADMAP |
| Perakit sumber "baru": bobot materi kini dari sebaran bank (sama dengan sumber bank/campuran), dibatasi stok; soal orisinal diambil lebih dulu, lalu model. Tryout Tingkat C 1 paket: jumlah per materi sama dengan tryout bank, INT 11 soal, 54 subtema (sebelumnya tanpa INT dan hampir semuanya model) | Lulus (`verify`) |
| Batas soal per materi dihitung dari jumlah batas per kesulitan, bukan floor(total ÷ paket); 1–2 slot tidak lagi kosong di batas kapasitas | Diperbaiki |
| Pembagian orisinal antarpaket (soal kembar dilarang): paket awal tidak mengambil lebih dari bagian adilnya. Pembulatan ke atas memihak paket pertama (31/21); pembulatan acak membuat kapasitas tidak monoton (C 7 gagal, 8 lulus). Pembulatan ke bawah dipilih: kapasitas naik bertahap, sisa jatuh ke paket akhir (2 paket C: 21/31) | Dipilih, dicek di `verify` |
| Kapasitas tanpa kembar diukur ulang. Soal baru saja: A 6→7, B 8, C 9→10 (memenuhi target K4 5 paket tanpa soal acuan). Bank: A 10, B 14→15, C 19. Campuran: A 14→17, B 15→16, C 20+ | Diperbarui di README dan `agent-office.json` |
| Bug lama terungkap: E2-AKT-07/08/09 dan E3-AKT-03 ditandai "posisi tetap" karena notasi jurnal "(D) … (K)" terbaca sebagai rujukan opsi D; E2-AKT-09 (opsi angka) lalu tetap diurutkan dan melanggar cek. Importir kini mengabaikan notasi jurnal; impor ulang hanya mengubah 4 tanda itu (dibandingkan per kolom dengan HEAD), 9 override BPPK utuh | Diperbaiki |
| Cek lama yang mengandaikan stok lama diperbarui: jumlah orisinal 56, "sumber baru: semua soal dari model" → "model dan orisinal, orisinal ikut terpakai", contoh subtema tanpa orisinal di `verify:materi` dipindah ke PP Tata cara penyetoran | Diperbarui |
| CLI `--tingkat C --sumber baru --paket 2`: 2 × 100 soal, valid, 0 catatan mutu | Lulus |
| verify 129, verify:quality 40, verify:models 139, verify:export 52, verify:materi 164; typecheck | Lulus |

## R7 · Silabus per tingkat (3 Nov 2026)

`lib/materi/silabus.ts`: deck gabungan per materi untuk tingkat terpilih (deck gabungan yang sudah disunting di browser dipakai bila berisi semua subtema cakupan), durasi per pola slide setelah tata letak, lalu dibagi ke pertemuan. Tab Materi: bagian **Silabus** di bawah Ekspor (durasi 60/90/120/180 menit, unduh .xlsx). CLI: `npm run materi -- --silabus [--tingkat] [--hanya-baru] [--menit-pertemuan]`; `agent-office.json` job `buatsilabus`.

| Pemeriksaan | Hasil |
| --- | --- |
| Silabus A: 5 materi, 34 subtema; slide = slide deck gabungan setelah tata letak (termasuk lanjutan); unit per subtema berurutan menutup semua slide | Lulus (`verify:materi`) |
| Pembagian pertemuan: tidak melebihi durasi; setiap slide tepat sekali; subtema dilanjutkan ke pertemuan berikutnya bila sisa ≥ 30 menit (atau sepertiga pertemuan), selain itu mulai di pertemuan baru; subtema lebih panjang dari satu pertemuan dipecah di batas slide | Lulus (cek sintetis 60 + 40 menit dan sisa pendek) |
| Pengisian awal (subtema utuh saja) hanya 73% waktu pertemuan; aturan pelanjutan menaikkannya: A 24 → 20 pertemuan, C 47 → 40 | Diperbaiki |
| Hasil (kepadatan standar, 90 menit): A 775 slide ±1.574 menit (35 JP, 20 pertemuan); A+B 1.105 slide (50 JP, 27); B tambahan 14 subtema (15 JP, 8); A+B+C 1.567 slide ±3.175 menit (71 JP, 40); dihitung < 0,5 detik | Lulus |
| Deck disunting (slide tersembunyi) ikut dihitung; deck gabungan yang hanya berisi sebagian subtema diabaikan | Lulus |
| .xlsx tiga lembar (Silabus, Per materi, Ringkasan beserta asumsi menit per pola) terbaca `bacaXlsx` dan terbuka di Excel | Lulus |
| Label cakupan Tingkat A tertulis "(A, B, C)" (daftar ujian, bukan cakupan) | Diperbaiki → "Subtema A (kumulatif)" |
| CLI: `--silabus --menit-pertemuan 120` menulis satu .xlsx; `--silabus --kode` dan `--menit-pertemuan 45` ditolak; opsi job `buatsilabus` ada di `--help` | Lulus |
| Browser (build produksi): bagian Silabus Tingkat C; unduh `silabus-tingkat-c-90-menit.xlsx` (69 subtema, 71 JP, 40 pertemuan, sama dengan CLI); ganti 120 menit → ringkasan direset, unduhan 29 pertemuan | Lulus (unduhan dicegat) |
| Label pilihan durasi "1.3333333333333333 JP" | Diperbaiki → "1,3 JP" |
| verify:materi 178 (14 baru); typecheck; build | Lulus |

## R8 · Materi ↔ latihan dan remedial (3 Nov 2026)

`lib/remedial.ts`: `saranRemedial` (statistik Uji peserta per subtema, p benar < 60%, minimal 5 respons) dan `rakitLatihan` (paket jenis subtema 20 → 15 → 10 → 5 soal). Studio: paket latihan menjadi workspace baru tanpa mengubah pengaturan Atur paket; tab Materi bisa dibuka langsung ke satu subtema (`fokus`, dipakai sekali).

| Pemeriksaan | Hasil |
| --- | --- |
| Latihan satu subtema: 20 soal jenis subtema, semuanya subtema itu, durasi 36 menit; pengaturan dasar tidak berubah | Lulus (`verify`) |
| Stok kecil: PP Tata cara penyetoran Tingkat B (8 soal) → 5 soal; OP NPWP & pendaftaran (2 soal) ditolak dengan galat persediaan; tanpa subtema ditolak | Lulus |
| Catatan: PP Tata cara penyetoran bertingkat A, tetapi 5 dari 8 soalnya berlabel B, jadi di Tingkat A hanya tersedia 2–3 soal (aturan tingkat soal = yang lebih tinggi) | Dicatat |
| Latihan lintas materi (PPN + KUP): dua materi, semua soal dari dua subtema itu | Lulus |
| Remedial sintetis: hanya subtema di bawah batas, dengan nomor soal; subtema dengan < 5 respons tidak disarankan | Lulus |
| Browser (build produksi): *Buat latihan* di deck PP PPh 21 pemotong → paket latihan 15 soal (stok tidak cukup untuk 20) di Hasil paket; 6 sesi sintetis (semua salah) diimpor → tabel Saran remedial 15 soal, 90 respons, 0%, nomor 1–15; *Buka materi* → tab Materi Tingkat C, subtema tercentang, deck terbuka | Lulus (data uji dihapus; 2 deck materi pengguna tetap) |
| Label durasi silabus "1,3 JP" setelah build ulang | Lulus |
| verify 137 (8 baru); typecheck; build | Lulus |

## R9 · Handout peserta dan PDF (3 Nov 2026)

`lib/materi/handout.ts` (`naskahHandout`): sampul bertanda "Handout peserta", daftar isi, pembatas, ikhtisar, rumus, rangkuman, kuis Benar/Salah beserta jawabannya, penutup; tabel isi materi, konsep, dan contoh soal tidak ikut. `tulisPptx(..., { tanpaCatatan: true })` tidak menulis catatan pembicara. Tab Materi: pilihan *Isi .pptx* di Ekspor. CLI: `--handout`, `--pdf` (PowerPoint COM, `scripts/materi-pdf.ps1`).

| Pemeriksaan | Hasil |
| --- | --- |
| Handout hanya memuat pola ringkas; semua rangkuman dan kuis deck lengkap ikut; sampul dan judul bertanda Handout peserta; slide tersembunyi tidak ikut | Lulus (`verify:materi`) |
| Handout .pptx tanpa `notesSlides`, paket sah, 0 teks meluap; deck lengkap tetap memuat catatan pembicara | Lulus |
| CLI `--tingkat A --kode BM --gabung --handout --pdf`: 24 slide (dari 73), 0 Draf internal, PDF 24 halaman (sampul "Handout peserta"); uji render PowerPoint 267 kotak teks, 0 meluap | Lulus |
| `--pdf` bersama `--zip`, `--pdf` dengan `--format json` ditolak; job `buatmateri` di `agent-office.json` memuat `handout` dan `pdf` | Lulus |
| Regex pemisah baris di pembaca keluaran PDF rusak karena escape di skrip penyunting | Diperbaiki |
| Browser (build produksi): deck PP PPh 21 pemotong diunduh *Deck lengkap* lalu *Handout peserta* → `…-handout.pptx`; dialog KM2 tetap muncul karena teks acuan | Lulus (unduhan dicegat) |
| verify:materi 186; typecheck; build | Lulus |

## R11 · CI GitHub dan R10 · catatan akses (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| `.github/workflows/ci.yml`: push dan pull request → `npm ci`, typecheck, verify, verify:quality, verify:models, verify:export, verify:materi, build (Ubuntu, Node 22, cache npm, batal otomatis untuk run lama di ref yang sama, izin `contents: read`) | YAML valid |
| Pemeriksa tidak memakai PowerShell atau path Windows; data dan aset yang dibutuhkan ter-track git (`public/data`, `assets/materi`). Berkas baru sejak commit terakhir (misalnya `data/ukp-tulis.json`, `public/data/ukp-tulis.json`, `data/ukp-kasus/*.json`) harus ikut di-commit | Dicek |
| CI belum pernah berjalan di GitHub karena belum di-push | Belum diverifikasi |
| README: bagian *Akses dan keamanan* (repositori private, `public/data` terbaca publik bila di-deploy, tanpa kata sandi situs sesuai keputusan, pilihan pembatasan tanpa kode, data browser dan cadangan); bagian *Batas* diperbarui dengan kapasitas terbaru | Selesai |

## QC akhir lintas rekomendasi R1–R12 (3 Nov 2026)

| Pemeriksaan | Hasil |
| --- | --- |
| typecheck | Lulus |
| verify 137 · verify:quality 40 · verify:models 139 · verify:export 52 · verify:materi 186 (554 cek) | Lulus, 0 gagal |
| `npm run build` (produksi) | Lulus |
| `npm audit` | 0 kerentanan |
| Render PowerPoint ke-69 deck × kepadatan (`materi-verify --semua`): 138 deck dibuka, 40.981 kotak teks, 0 meluap | Lulus (soal orisinal R5 ikut sebagai contoh soal) |
| Browser (build produksi): Silabus (R7), Buat latihan dan Saran remedial (R8), handout (R9); data uji dihapus, 2 deck materi pengguna tetap | Lulus |
| CI GitHub (R11) | Belum berjalan sampai di-push |

Yang masih terbuka (dicatat di ROADMAP): telaah penelaah materi (K8) atas 25 model dan 56 soal orisinal; tulis ulang materi selain Bea Meterai; 4 subtema tanpa soal orisinal; repositori private dan pembatasan akses situs (pemilik repo).

## Cakupan deck: bawaan tingkat, Unduh semua, .zip berhierarki (4 Nov 2026)

Permintaan user: bawaan lingkup Tingkat dan bentuk Per subtema, opsi unduh semua menurut cakupan bawaan maupun yang diatur, .zip rapi menurut tingkat, materi, subtema.

| Pemeriksaan | Hasil |
| --- | --- |
| Bawaan: lingkup Tingkat, Per subtema, semua subtema tercentang, satu tombol "Susun & unduh semua"; urutan pilihan lingkup Tingkat, Materi, Subtema; baris cakupan "5 materi, 34 subtema" | Lulus (browser) |
| Tingkat bawaan tab Materi diubah dari C ke A atas keputusan user: 34 deck, tombol utama sesuai; *Kembali ke bawaan* ke Tingkat A; CLI dan Atur paket tetap bawaan C | Lulus (browser) |
| Tingkat A: .zip `materi-tingkat-a-34-deck.zip`, satu folder `Tingkat A`, 5 folder materi bernomor, 34 deck kedalaman 3, 84 MB, 14 detik, progres "Memproses 7/34…" | Lulus (browser, isi zip dibaca) |
| Tingkat C: 69 deck, 10 folder materi, 171 MB, 31 detik, jalur terpanjang 127 karakter | Lulus (browser) |
| Centang sebagian: tombol utama "yang dicentang" (33), "Unduh semua" (34) tetap ada dan mengabaikan centangan; bentuk Per materi: 5 deck per folder materi | Lulus (browser) |
| Masalah yang ditemukan: id deck subtema tidak memuat tingkat, padahal contoh soalnya mengikuti tingkat, dan pengaturan baru diabaikan untuk deck yang sudah ada. Deck Tingkat C yang diunduh dari Tingkat A bisa membawa soal level C. `rencanaDeck`: deck yang belum disunting disusun ulang menurut pengaturan sekarang; yang disunting, ditelaah, atau impor tidak ditimpa dan disebut di ringkasan | Diperbaiki (`verify:materi`; browser: PPN Pengkreditan PM berganti dari `O-PPN-01` label C ke model level A, deck tersunting tetap C) |
| Deck gabungan berisi sebagian subtema disusun ulang bila cakupan unduhan berbeda | Diperbaiki |
| Pengaturan hilang setiap pindah tab karena komponen dilepas: kini diingat per browser, nilai rusak jatuh ke bawaan, *Kembali ke bawaan* tersedia | Diperbaiki (browser) |
| Deck terbuka bisa berada di luar cakupan (materi INT saat Tingkat A): deck terbuka kini mengikuti cakupan, juga saat tab dimuat | Diperbaiki (browser) |
| `lib/materi/jalur.ts`: nama aman Windows (`:` `/` dan karakter terlarang), jalur unik, nomor berurutan untuk A, A+B, A+B+C dan "hanya subtema baru" | Lulus (`verify:materi`) |
| CLI memakai hierarki yang sama untuk lebih dari satu berkas; satu berkas tetap langsung. `--tingkat A` 34 deck dibuka PowerPoint lewat folder baru: 8.970 kotak teks, 0 meluap | Lulus |
| Silabus: kolom baru jalur deck per subtema di .zip, karena kolom Deck merujuk deck gabungan yang bukan bawaan unduhan | Ditambahkan |
| verify:materi 201; verify 137; typecheck; build | Lulus |

## Unduh materi sebagai PDF (5 Nov 2026)

Permintaan user: pilihan unduh materi tidak hanya .pptx, tetapi juga .pdf, dengan lebar paling besar 16. Ditafsirkan sebagai halaman 16 × 9 inci (rasio slide sama); ukuran ada di satu konstanta `HALAMAN_PDF`. Situs Vercel tidak punya PowerPoint, jadi `lib/materi/pdf.ts` menggambar kotak hasil tata letak sebagai vektor dengan jsPDF, sama di browser dan CLI. `scripts/materi-pdf.ps1` (R9) dihapus; `--pdf` kini memakai penulis ini.

| Pemeriksaan | Hasil |
| --- | --- |
| Banding dengan ekspor PDF PowerPoint untuk deck yang sama (BM gabungan 71 halaman, PPN 25 halaman): baris sama persis 1.157 dari 1.170 dan 410 dari 417, jumlah halaman sama, selisih posisi median mendekati 0 (terbesar 1,4 pt horizontal di kanvas 1440) | Lulus |
| Baca visual berdampingan: sampul, ikhtisar, tabel, konsep, kuis, rumus, gradien, bayangan, ikon | Lulus |
| Teks miring bergeser keluar dari kotak karena matriks kemiringan ikut mengalikan posisi Y | Diperbaiki |
| Gradien judul kurang kontras: PowerPoint merentangkannya sepanjang teks, bukan sepanjang kotak | Diperbaiki |
| Garis dasar lebih rendah sekitar 5% ukuran huruf: dikalibrasi ke 0,755 × tinggi baris | Diperbaiki |
| Baris putus lebih awal karena cadangan lebar pengukur: cadangan hanya untuk PowerPoint, di PDF lebar huruf pasti | Diperbaiki |
| `→` (737 kali), `↔`, dan `Σ` tidak ada di Poppins: digambar dengan font Symbol bawaan PDF, tampil benar dan `→` bisa dicari. Semua huruf di 69 deck (standar dan lengkap) bisa digambar | Lulus (`verify:materi`) |
| PDF: satu halaman per slide termasuk lanjutan, MediaBox 1152 × 648 pt, Poppins Regular dan Bold tertanam, ToUnicode ada, foto latar tertanam sekali, slide tersembunyi tidak ikut, 71 halaman 2,83 MB | Lulus (`verify:materi`) |
| Draf internal: PDF tidak punya catatan pembicara, jadi tanda tampil di setiap halaman dan di properti berkas; hilang setelah deck ditelaah. Dialog KM2 berlaku untuk .pdf; CLI menolak tanpa `--setuju-acuan` | Lulus |
| CLI: `--format pdf` satu berkas sah; `--pdf --zip` .pptx dan .pdf berdampingan di folder materi; format lain ditolak; job `buatmateri` menerima pdf | Lulus |
| Tab Materi: format jadi pilihan yang bisa digabung (.pptx, .pdf, Naskah .json), format terakhir tidak bisa dikosongkan, nilai lama tersimpan tetap terbaca; tombol .pdf di bilah bawah | Lulus (browser) |
| Browser, build produksi: satu deck .pdf 22 halaman 2,64 MB 1,3 detik; handout .pdf 6 halaman; Tingkat A .pptx + .pdf 68 berkas 174 MB 42 detik; Tingkat C .pptx + .pdf 138 berkas 354 MB 92 detik tanpa galat | Lulus (unduhan dicegat) |
| verify:materi 218; verify 137; verify:export 52; verify:quality 40; typecheck; build | Lulus |

