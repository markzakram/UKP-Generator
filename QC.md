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
