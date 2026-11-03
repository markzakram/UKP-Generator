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
