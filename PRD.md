# PRD: UKP Generator

| | |
| --- | --- |
| Status | Versi 1.0. Tahap 0–5 selesai dan lulus QC (2 Nov 2026, lihat QC.md). K1–K9 memakai usulan bawaan (bagian 15); penelaah materi (K8) dan dokumen BPPK (K3) masih ditunggu |
| Tanggal | 2 November 2026 |
| Folder | `G:\Ali\code\UKP Generator` |
| Acuan pola | `G:\Ali\code\SKD Generator` (JadiASN SKD Studio v2.2) |
| Sumber materi dan soal | `G:\Ali\code\Scrape UKP\output\` (LatihUKP + Ortax) |

## 1. Ringkasan

UKP Generator adalah ruang kerja tim konten untuk menyusun, memeriksa, dan mengekspor paket soal latihan dan tryout **Uji Kompetensi Perpajakan (UKP) Tingkat A, B, dan C**. Polanya sama dengan SKD Generator: atur blueprint paket, generator merakit soal dari bank dan dari model soal berparameter, tim memeriksa hasilnya, lalu mengekspor ke PDF, Word, Word/Excel SiAdu, CSV, dan JSON.

Bahan awalnya adalah hasil scrape di project Scrape UKP: 2.387 soal pilihan ganda lengkap dengan kunci dan pembahasan, 334 kartu aturan, 92 kartu hafalan/rumus, 318 kuis, dan ringkasan 10 materi.

Aplikasi berjalan di browser, tanpa API key, tanpa server AI, dan tanpa basis data eksternal. Paket disimpan di IndexedDB dan bisa di-deploy ke Vercel.

## 2. Latar belakang

- Sejak PMK 55/2026, ujian sertifikasi konsultan pajak berganti nama menjadi UKP. Periode 1–8 tahun 2026 diselenggarakan 26–29 Oktober 2026. Menurut data jadwal hasil scrape, rencananya ada 40 periode, jadi permintaan latihan akan terus ada.
- Tim sudah punya generator untuk ujian lain (SKD, TKA, OJK, Kepribadian, dan lain-lain), tetapi belum untuk UKP.
- Project Scrape UKP sudah mengumpulkan bahan. **Ruang Pajak** (`Scrape UKP/ruang-pajak/`) adalah aplikasi belajar pribadi untuk peserta: membaca materi, latihan, dan tryout dari bank yang sama. Aplikasi ini tidak bisa menyusun paket produksi, membuat soal baru, memeriksa mutu, atau mengekspor ke SiAdu.
- Aturan pajak banyak berubah sepanjang 2025–2026 (PMK 81/2024 Coretax, tarif PPN efektif 11/12, batas setor tanggal 15, sanksi bunga KMK bulanan, PSAK 212/216, dan lainnya). Soal yang memakai aturan lama langsung salah kunci. Generator perlu menjaga hal ini secara sistematis.

## 3. Tujuan dan non-tujuan

### Tujuan

1. Menyusun paket tryout dan latihan UKP per tingkat (A, B, C) dalam hitungan detik, dengan komposisi materi yang bisa diatur dan tanpa soal kembar antarpaket.
2. Menghasilkan **soal baru** untuk tipe hitungan (PPh 21, PPh 23, PPN, sanksi bunga, PBB-P5L, bea meterai, penyusutan, dan lainnya) dari model berparameter. Kuncinya dihitung ulang oleh mesin, bukan disalin.
3. Menjaga kebenaran aturan: setiap soal terhubung ke kartu aturan dan dasar hukumnya, dan pemeriksa menandai soal yang memakai ketentuan lama.
4. Mengekspor ke format yang dipakai tim produksi: PDF, Word, **Word SiAdu** dan **Excel SiAdu**, CSV, dan JSON.
5. Bisa dijalankan operator tanpa AI lewat Agent Office (`agent-office.json`) dan CLI.

### Non-tujuan

- Bukan aplikasi belajar untuk peserta. Itu sudah ada di Ruang Pajak.
- Tidak mengklaim soal resmi BPPK/DJP, bobot resmi, atau prediksi kelulusan.
- Tidak melakukan scraping. Data diambil dari snapshot `Scrape UKP/output/` lewat script impor.
- Tidak memakai LLM saat aplikasi berjalan. Penulisan soal naratif baru dengan AI dikerjakan di sesi Claude, lalu masuk ke bank sebagai data.
- Belum ada akun pengguna, basis data bersama, atau sinkronisasi antarperangkat di versi pertama.

## 4. Pengguna

| Pengguna | Kebutuhan utama |
| --- | --- |
| Tim akademik / penyusun soal | Membuat paket sesuai blueprint, mengganti nomor yang kurang pas, menyunting, dan memeriksa kunci serta pembahasan |
| Penelaah materi pajak | Melihat dasar hukum, kartu aturan, dan penanda aturan lama pada setiap soal |
| Operator input SiAdu | Mengunduh Word/Excel SiAdu yang langsung terbaca importer |
| Operator Agent Office (tanpa AI) | Menjalankan "buat paket UKP", "verifikasi", dan "buka aplikasi" dari tombol cepat |

## 5. Acuan ujian UKP

Bagian ini diambil dari ringkasan riset LatihUKP per 18 Oktober 2026 (`topics.json`, `_info`) dan jadwal resmi yang dikutip di `raw/jadwal_ukp.json`. Datanya belum diverifikasi ulang terhadap dokumen BPPK.

- Dasar: PMK 55/2026 (menggantikan PMK 111/2014 s.t.d.d. PMK 175/2022) dan Pengumuman PENG-7/PP/2026.
- Tiga tingkat: A, B, C. Situs LatihUKP memakai cakupan kumulatif: A = materi A, B = A+B, C = A+B+C.
- Bentuk soal: pilihan ganda berbasis kasus. Di bank sumber, semua soal memakai **4 opsi (A–D)**.
- Penilaian: Lulus/Tidak Lulus, batas lulus 60 dari 100. Jawaban salah atau kosong bernilai 0.
- Durasi sesi 3,5 jam (08.00–11.30 atau 13.00–16.30). Jumlah soal dan bobot per materi **belum diumumkan resmi**. Tryout pihak ketiga memakai 100 soal (Ortax 180 menit, LatihUKP 150 menit).
- CAT menyediakan kalkulator, lembar kerja, dan tautan peraturan (kompilasi UU pajak, lampiran TER PP 58/2023, lampiran PER-11/PJ/2025, formulir SPT Coretax). Bea Meterai dan PBB-P5L tidak disediakan bahannya, jadi harus dihafal.
- Kode etik tidak lagi diuji di UKP.

## 6. Inventaris sumber data

### 6.1 LatihUKP (`Scrape UKP/output/latihukp/`), sumber utama

| Berkas | Isi | Jumlah |
| --- | --- | --- |
| `questions.json` | Soal PG 4 opsi + kunci + pembahasan lengkap | 2.387 (1.547 EASY, 840 HARD) |
| `rules.json` | Kartu aturan: konsep, pokok, syarat, tarif/DPP, ambang, tenggat, pengecualian, contoh, jebakan, dasar hukum, masa berlaku | 334 |
| `cards.json` | Kartu hafalan dan rumus | 64 hafalan, 28 rumus |
| `quizzes.json` | Kuis benar/salah, isian, PG, menjodohkan | 318 |
| `topics.json` | Ringkasan 10 materi (kisi-kisi, aturan inti, perubahan 2025–2026) + info format ujian dan tabel jebakan aturan lama | 10 + 1 |
| `raw/jadwal_ukp.json` | Jadwal periode UKP 2026 | 8 periode |
| `references.json` | Indeks tautan peraturan dan rujukan (belum diunduh) | |

Isi satu soal di bank: `id`, `g` (kode materi), `kelompok`, `subtopik`, `tingkat_kisi`, `tipe`, `kasus_id` + `kasus` (stimulus bersama), `soal`, `opsi` A–D, `kunci`, `dasar_hukum[]`, `rule_ids[]`, `bloom`, `kesulitan`, `kategori`, `penyebab_salah` per opsi, `inti`, `langkah[]`, `kenapa_salah` per opsi, `catatan_aturan`, `poin_ingat`, `sumber[]`, `keyakinan`. Soal HARD juga punya `tingkat_ujian` (setara / di atas / jauh di atas).

Angka penting:

- 461 soal berbasis kasus, dari **183 kasus unik**, masing-masing berisi 2–4 soal. Soal sekasus harus selalu ikut bersama di satu paket.
- 395 soal bertipe hitungan.
- Sebaran kunci sudah seimbang: A 624, B 607, C 602, D 554.
- Penyebab salah yang dipetakan per opsi: `tertukar_aturan` 1.611, `belum_tahu_aturan` 952, `lupa_syarat` 831, `salah_tarif_dpp` 474, `salah_periode` 432, `salah_hitung` 308, `sulit_menggabungkan` 33. Taksonomi ini dipakai juga untuk pengecoh soal baru.
- Bloom (EASY saja): apply 823, understand 393, remember 319, analyze 12. Kesulitan (EASY saja): easy 966, medium 581.

Catatan mutu sumber (dari `report.json`):

- 178 soal merujuk `rule_id` yang tidak ada di bank aturan publik.
- 34 metadata HARD dengan checksum lama tidak digabung.
- Seluruh isi adalah salinan sumber dan **belum diverifikasi independen**. Sumber menyatakan soalnya disusun untuk belajar, bukan soal ujian asli.

### 6.2 Ortax (`Scrape UKP/output/materi-abc/`), pelengkap

80 URL tercatat, 44 halaman teks tersimpan (kebanyakan berita jadwal/hasil UKP dan deskripsi publikasi). Isi modul utuh: 0. Berkas PDF: 0. Ada 44 sumber terkunci. Bahan ini hanya dipakai untuk konteks ujian, bukan untuk soal. Ketentuan Ortax (bagian D disclaimer) melarang penyalinan materi untuk publikasi atau tujuan komersial tanpa izin tertulis.

## 7. Taksonomi materi

Kode materi `g` dari sumber dipakai sebagai kunci utama.

| Kode | Materi | Soal | Kartu aturan | Label tingkat soal di sumber |
| --- | --- | ---: | ---: | --- |
| KUP | KUP, PPSP & Pengadilan Pajak | 315 | 39 | A 299, B 16 |
| OP | PPh Orang Pribadi & SPT PPh OP | 186 | 25 | A 186 |
| PP | PPh Pemotongan/Pemungutan | 376 | 44 | A 250, B 99, C 27 |
| PPN | PPN & SPT PPN | 323 | 47 | A 317, C 6 |
| BM | Bea Meterai | 121 | 15 | A 121 |
| PBB | PBB-P5L | 120 | 27 | B 120 |
| AKT | Akuntansi Perpajakan | 305 | 28 | A 7, B 244, C 54 |
| BDN | PPh Badan (dalam negeri) | 175 | 35 | B 163, C 12 |
| BTI | PPh Badan (transaksi internasional) | 198 | 27 | A 4, B 62, C 132 |
| INT | Pajak Internasional | 268 | 47 | A 13, C 255 |

Hierarkinya: **Tingkat → Materi (g) → Subtema (dari kartu aturan, 5–8 per materi) → Kartu aturan → Soal.**

**Masalah label tingkat.** Label tingkat di soal mengikuti pengelompokan materi situs (KUP, OP, PP, PPN, BM sebagian besar A). Kisi-kisi di `topics.json` membagi tiap materi per butir. Contohnya, KUP: "C: STP dan SKP…, pembetulan, keberatan…, sanksi…" dan "A: NPWP/PKP, pembayaran & pelaporan…". Label tingkat di kartu aturan juga berbeda (KUP: A 13, B 4, C 22). Karena itu generator menyimpan pemetaan tingkat per subtema dalam satu berkas `data/ukp-mapping.json`, seperti `skd-mapping.json` di SKD Generator. Isi awalnya mengikuti kisi-kisi, lalu disahkan terhadap dokumen resmi *Cakupan Materi UKP – BPPK (14 Okt 2026)*. Lihat keputusan K3.

## 8. Lingkup fitur

Prioritas: **P0** = versi pertama (MVP), **P1** = tahap berikut, **P2** = nanti.

### F1. Atur paket (blueprint), P0

- **Tingkat:** A, B, atau C. Cakupan materi kumulatif mengikuti `ukp-mapping.json`.
- **Jenis paket:**
  - *Tryout penuh*: jumlah soal dan durasi bawaan 100 soal / 180 menit, bisa diubah.
  - *Latihan per materi*: satu atau beberapa kode `g`.
  - *Latihan per subtema*: filter `Materi::Subtema`.
  - *Drill jebakan aturan* (P1): hanya soal yang menguji ketentuan yang berubah 2025–2026.
- **Komposisi:** kuota per materi (proporsional bawaan, bisa disunting di tabel), sebaran kesulitan (mudah/sedang/sulit), dan porsi soal kasus.
- **Sumber:** bank acuan, soal baru (model berparameter), atau campuran. Lihat F2.
- **Pengaturan lanjutan:** jumlah paket (maksimal 50), seed, larangan soal kembar antarpaket, dan tanggal acuan aturan (lihat F5).
- **Cek persediaan sebelum generate.** Kalau stok kurang, tampilkan pesan dengan angka sebenarnya. Kuota tidak boleh diisi diam-diam dengan materi lain.
- **Soal kasus tidak dipecah.** Satu kasus (2–4 soal) dihitung sebagai satu blok. Soal-soalnya tampil berurutan dengan stimulus bersama di atas soal pertama.

### F2. Sumber soal, P0

1. **Bank acuan:** 2.387 soal sumber dengan metadata, kunci, dan pembahasan sesuai aslinya. Penandanya *Acuan sumber*. Status pemakaiannya untuk produksi bergantung pada keputusan K2.
2. **Soal baru, model berparameter:** setiap model berisi konteks (jenis usaha, nama entitas fiktif, kota, tanggal), parameter angka, dan rumus dari kartu rumus. Mesin menghitung kunci, menyusun 3 pengecoh dari kesalahan yang khas (`salah_tarif_dpp`, `salah_periode`, `tertukar_aturan`, `lupa_syarat`, `salah_hitung`), lalu menulis pembahasan langkah demi langkah dan alasan tiap pengecoh. Daftar model ada di bagian 9.
3. **Adaptasi kasus (P1):** mengambil kerangka soal kasus dari bank, lalu mengganti entitas, angka, dan tanggal. Kunci dan pembahasan dihitung ulang lewat model yang sesuai. Penandanya *Adaptasi*.
4. **Bank orisinal (P1):** soal naratif baru yang ditulis tim atau sesi Claude, disimpan per materi di `data/ukp-kasus/<g>.json` dengan skema yang sama, dan melewati pemeriksa mutu yang sama.

Setiap soal menyimpan asal-usulnya (`provenance`): sumber, id asal, model, parameter, revisi, dan checksum.

### F3. Hasil paket, P0

Tata letaknya meniru SKD Generator v2:

- Tiga panel: daftar soal (cari, filter materi/tipe, centang) | soal + kunci + pembahasan | panel mutu.
- **Tampilan peserta** menyembunyikan kunci dan pembahasan.
- **Sunting soal** membuat revisi baru dan membatalkan bukti model.
- **Ganti nomor ini / ganti nomor terpilih:** pengganti diambil dari materi, subtema, tingkat, dan kesulitan yang sama, tanpa kembar di dalam paket maupun antarpaket. Mengganti satu soal kasus menawarkan penggantian seluruh blok kasusnya.
- **Ambil soal** (P1): salin atau unduh satu soal atau beberapa soal terpilih.
- Riwayat 20 snapshot dan cadangan/impor JSON workspace.

### F4. Format soal dan pembahasan, P0

Format mengikuti struktur sumber, yang sudah cocok untuk ujian pajak:

```
[Kasus — bila ada]
Soal N
<batang soal> ...
A. ...   B. ...   C. ...   D. ...
Jawaban: X
Pembahasan:
  Inti: <satu kalimat jawaban dan alasannya>
  Langkah: 1. Aturan … 2. Hitungan … 3. Penerapan …
  Mengapa opsi lain salah: A … / C … / D …
  Dasar hukum: UU … Pasal … ; PMK … Pasal …
  Poin ingat: <satu baris>
```

- Angka Rupiah memakai format Indonesia (`Rp4.800.000.000`), tanggal ditulis lengkap (`14 Agustus 2026`).
- Jurnal akuntansi ditulis sebagai tabel Dr/Cr di layar, PDF, dan Word.
- `catatan_aturan` (riwayat aturan lama) hanya tampil di mode penelaah, tidak di naskah peserta.

### F5. Tanggal acuan aturan, P0

Ini fitur khusus domain pajak yang tidak ada di SKD Generator.

- Setiap paket punya **tanggal acuan** (bawaan: tanggal hari ini). Semua tarif, ambang, dan tenggat yang dipakai model diambil dari `data/ukp-parameter.json`. Setiap nilai di berkas itu punya `berlaku.mulai`, `berlaku.sampai`, dan `dasar_hukum`. Angka-angka ini tidak boleh ditanam langsung di kode.
- Soal bank yang merujuk kartu aturan yang belum atau sudah tidak berlaku pada tanggal acuan diberi tanda di panel mutu.
- Tabel "bahan lama vs berlaku" dari `topics.json` (17 baris: bunga sanksi, sanksi keberatan/banding, Pasal 13(3), faktur Pasal 14(4), batas setor, unggah faktur, tarif PPN, PPh final UMKM, pembetulan SPT, PPh 22 impor, formulir DGT, pertukaran informasi, pajak minimum global, PSAK, Pengadilan Pajak, PTKP) dijadikan aturan deteksi. Pemeriksa mencari angka atau frasa versi lama di kunci dan pembahasan.
- Tarif bunga sanksi per bulan (KMK) disimpan sebagai tabel bulanan. Bulan yang belum ada datanya membuat model sanksi bunga menolak generate. Mesin tidak boleh menebak tarif.

### F6. Pemeriksaan mutu otomatis, P0

Pemeriksa tidak memberi status "disetujui". Pemeriksaan substansi tetap dikerjakan penelaah.

- **Struktur:** 4 opsi tidak kosong dan saling berbeda, satu kunci, dan id unik. Soal kasus harus punya stimulus.
- **Hitung ulang:** untuk soal model, kunci dihitung ulang dari parameter dengan parser aritmetika tanpa `eval`. Pengecoh tidak boleh sama dengan kunci setelah pembulatan.
- **Rujukan:** `rule_ids` harus ada di bank aturan dan `dasar_hukum` tidak boleh kosong. Rujukan yang rusak (178 di sumber) ditandai.
- **Aturan lama:** lihat F5.
- **Penyajian:** sebaran posisi kunci per paket merata (tiap huruf dalam rentang n/4 ± 2), panjang opsi seimbang (rasio terpanjang/terpendek dan kunci yang selalu terpanjang), tidak ada "semua benar"/"semua salah", dan tidak ada huruf opsi yang disebut di pembahasan setelah opsi diacak.
- **Duplikasi:** kemiripan teks antarsoal dalam paket dan antarpaket. Variasi angka dari model yang sama dianggap kembar kalau parameter pentingnya sama.
- **Keragaman konteks:** batas pengulangan nama kota/entitas per paket. Sumber banyak memakai "Morowali", jadi perlu dicegah dominan.
- Soal yang gagal pemeriksaan struktur atau hitung ulang menahan ekspor. Peringatan lain bersifat informasi.

### F7. Ekspor, P0 (SiAdu P1)

- **PDF:** naskah tanpa kunci, kunci saja, soal + jawaban tanpa pembahasan, atau soal lengkap dengan pembahasan. Satu berkas atau ZIP per paket.
- **Word biasa:** untuk penyuntingan naskah.
- **Word SiAdu** (P1): paragraf `Soal N`, `Category`, `Lesson`, `Chapter`, tingkat kesulitan, stimulus, opsi, `Jawaban`, dan `Pembahasan`. Bisa dibaca importer SiAdu (Tampermonkey) yang sudah ada. Category/Lesson/Chapter untuk UKP perlu disepakati (K5).
- **Excel SiAdu** (P1): sheet SOAL sesuai template (`no, level, soal, opsi_a..e, jawaban_benar, skor_a..f, pembahasan`), dengan `opsi_e` kosong untuk soal 4 opsi.
- **CSV dan JSON:** data lengkap beserta provenance. Berkas ini memuat kunci.
- **Berkas uji HTML** (P2): naskah untuk peserta tanpa kunci. Hasilnya diimpor kembali untuk statistik.

### F8. Pustaka, P1

- Jelajah bank acuan, kartu aturan, kartu hafalan/rumus, dan kuis per materi/subtema.
- Pratinjau model generator: ubah parameter, lalu lihat soal, kunci, dan pembahasannya berubah.

### F9. CLI, API, dan Agent Office, P0 (API P1)

```powershell
npm run generate -- --tingkat C --soal 100 --paket 3 --seed UKP-C-01 --out output
npm run generate -- --tingkat A --materi PPN,KUP --soal 40 --sumber baru
npm run verify
npm run verify:quality
```

- CLI menulis `paket.json`, `validasi.json`, dan mencetak baris `RINGKASAN`/`BERKAS` supaya tombol "Buka hasil" di Agent Office bisa membaca hasilnya.
- `agent-office.json` berisi pekerjaan: buka aplikasi, buat paket, dan verifikasi. Berkas ini harus diperbarui setiap kali opsi CLI berubah.
- API `POST /api/generate` (P1) memakai pengaturan yang sama dengan form.

### F10. Uji peserta dan statistik, P2

Sama dengan SKD Generator: proporsi benar, frekuensi tiap opsi, pengecoh yang jarang dipilih, dan daya pembeda setelah ≥30 respons.

## 9. Model soal berparameter

Model diturunkan dari 28 kartu rumus di `cards.json`. Setiap model menyimpan parameter, rumus, pengecoh dari kesalahan khas, templat pembahasan, dan rujukan kartu aturan.

**MVP (10 model, Tahap 3):**

| # | Model | Materi | Pengecoh khas |
| --- | --- | --- | --- |
| 1 | PPh 23 atas jasa/sewa/royalti (termasuk tanpa NPWP) | PP | tarif tertukar, lupa tarif lebih tinggi tanpa NPWP, DPP termasuk PPN |
| 2 | PPh 4(2) final yang sering keluar (sewa tanah/bangunan, dan lainnya) | PP | tertukar dengan PPh 23, DPP salah |
| 3 | PPh 21 bukan pegawai | PP | lupa 50% bruto, tarif Pasal 17 tidak kumulatif |
| 4 | PPh 26 + tarif P3B | PP/INT | memakai tarif domestik padahal ada DGT, atau sebaliknya |
| 5 | Tarif & DPP PPN (DPP nilai lain 11/12, barang mewah) | PPN | 11% × harga jual, 12% penuh untuk non-mewah |
| 6 | PPN terutang, kompensasi, restitusi | PPN | PM tidak dapat dikreditkan ikut dihitung, periode salah |
| 7 | PPh terutang OP (Pasal 17 + PTKP) | OP | PTKP status salah, lapisan tarif salah |
| 8 | PPh final UMKM 0,5% (termasuk batas omzet) | OP | batas waktu lama, omzet tidak kena pajak terlewat |
| 9 | Bea meterai (objek, pemeteraian kemudian, sanksi) | BM | dokumen bukan objek, sanksi salah |
| 10 | Tenggat setor/lapor (tanggal 15/20/akhir bulan, geser hari libur) | KUP | aturan tanggal 10 lama, tertukar setor dan lapor |

**Tahap berikutnya (P1):** PPh 21 pegawai tetap dengan TER (butuh tabel lampiran PP 58/2023 sebagai data), PPh 21 tidak tetap/harian, pesangon final, PPh 4(2) jasa konstruksi, PPh 15, PPN besaran tertentu, sanksi bunga (butuh tabel KMK bulanan), PBB-P5L terutang, NPPN, pemajakan keluarga, penyusutan fiskal, rekonsiliasi fiskal dan pajak tangguhan, fasilitas Pasal 31E, angsuran PPh 25, kredit PPh 24, branch profit tax, thin capitalization (DER 4:1), dan CFC.

Kapasitas tiap model (jumlah kombinasi konteks × kondisi yang benar-benar mengubah jawaban) dihitung dan dilaporkan. Variasi angka saja tidak dihitung sebagai soal berbeda kalau logikanya sama.

## 10. Standar konten soal UKP (draf)

Aturan ini dipakai generator, pemeriksa, dan penulis bank orisinal. Draf ini perlu disahkan penelaah materi.

1. PG 4 opsi, satu jawaban paling tepat. Batang soal diakhiri "…" atau pertanyaan yang jelas.
2. Soal kasus menyajikan fakta yang cukup dan tidak ambigu: jenis WP, status PKP/NPWP, tahun buku, tanggal, nilai sebelum/sesudah PPN, dan hal yang diabaikan ("abaikan PPN dalam soal ini").
3. Setiap pengecoh mewakili satu kesalahan khas yang bisa diberi nama (taksonomi `penyebab_salah`). Alasan di "Mengapa opsi lain salah" spesifik dan menyebut pasalnya.
4. Kunci dan pembahasan mengikuti aturan yang berlaku pada tanggal acuan paket. Riwayat aturan lama boleh muncul di pembahasan sebagai pembeda, tidak boleh muncul sebagai kunci.
5. Dasar hukum ditulis lengkap: jenis peraturan, nomor/tahun, pasal, dan ayat.
6. Nama entitas fiktif, kota dan jenis usaha beragam. Tidak boleh memakai nama perusahaan atau orang nyata.
7. Opsi angka diurutkan naik atau turun. Opsi teks panjangnya sebanding.
8. Label Bloom (remember/understand/apply/analyze) dan kesulitan (mudah/sedang/sulit) wajib ada. Untuk soal turunan HARD, `tingkat_ujian` (setara/di atas/jauh di atas) dipertahankan.

## 11. Persyaratan non-fungsional

- **Stack:** Next.js + TypeScript, sama dengan SKD Generator, supaya komponen ekspor (jsPDF, docx), pola IndexedDB, dan importer SiAdu bisa dipakai ulang. Node.js ≥20.9 (deploy 22/24).
- **Tanpa layanan eksternal saat runtime:** tanpa API key, tanpa AI, tanpa basis data. Data dibundel dari `data/`.
- **Deterministik:** seed + pengaturan yang sama menghasilkan paket yang sama.
- **Kinerja:** satu paket 100 soal selesai < 3 detik di laptop kantor. 10 paket < 15 detik.
- **Batas:** 50 paket, 200 soal per paket, 4.000 soal per proses.
- **Tidak bergantung pada folder Scrape UKP saat build atau runtime.** Impor dijalankan manual dan hasilnya di-commit ke `data/`.
- **Responsif:** bisa dipakai di 1440, 1100, dan 375 px.
- **Tampilan:** mengikuti desain B+ (bagian 18).
- **Privasi:** tidak ada sesi Ortax, cookie, atau kredensial di repo maupun di `agent-office.json`.

## 12. Rancangan struktur project

Rancangan ini meniru SKD Generator dan bisa berubah saat implementasi.

```
UKP Generator/
├─ app/                    halaman Next.js + api/generate
├─ components/             GeneratorForm, BlueprintSummary, QuestionCard, ExportDialog, ...
├─ lib/
│  ├─ types.ts             UkpQuestion, UkpCase, UkpRule, Blueprint, Package
│  ├─ config.ts            tingkat, materi, batas
│  ├─ mapping.ts           tingkat ↔ materi ↔ subtema
│  ├─ bank/                pemuat bank acuan & bank orisinal
│  ├─ models/              model berparameter per materi (pph23.ts, ppn-dpp.ts, ...)
│  ├─ parameter.ts         tarif/ambang/tenggat per tanggal acuan
│  ├─ generate.ts          perakit paket (kuota, blok kasus, seed, tanpa kembar)
│  ├─ replace.ts           ganti nomor
│  ├─ quality.ts           pemeriksa mutu
│  ├─ export.ts            PDF / Word / SiAdu / CSV / JSON
│  └─ storage.ts           IndexedDB, riwayat, cadangan
├─ data/
│  ├─ ukp-bank.json        hasil impor questions.json (dinormalisasi)
│  ├─ ukp-rules.json       hasil impor rules.json + cards.json
│  ├─ ukp-mapping.json     pemetaan tingkat per materi/subtema
│  ├─ ukp-parameter.json   tarif, ambang, tenggat, bunga KMK per periode
│  ├─ ukp-jebakan.json     aturan deteksi bahan lama
│  ├─ ukp-kasus/           bank orisinal per materi
│  └─ import-report.json   jumlah, hash sumber, rujukan rusak
├─ scripts/
│  ├─ import-latihukp.mjs  ../Scrape UKP/output/latihukp → data/
│  ├─ generate.ts          CLI
│  ├─ verify.ts            determinisme, kuota, blok kasus, duplikasi, model
│  └─ quality-verify.ts    pemeriksa mutu pada banyak seed
├─ README.md  ROADMAP.md  REFERENSI-UKP.md  CLAUDE.local.md  agent-office.json
└─ PRD.md
```

## 13. Hak pakai sumber

Sumber data adalah situs pihak ketiga, jadi perlu keputusan sebelum ada paket yang keluar dari tim.

- **LatihUKP:** data publik. Situsnya menyatakan soal disusun untuk belajar. Tidak ditemukan lisensi yang mengizinkan penggunaan ulang secara komersial.
- **Ortax:** ketentuannya melarang penyalinan untuk publikasi di portal lain atau tujuan komersial tanpa izin tertulis. Bahan Ortax hanya dipakai sebagai konteks.

Usulan bawaan:

1. Bank LatihUKP berstatus **acuan internal**. Bank ini dipakai untuk melihat pola, cakupan, kesalahan khas, dan sebagai bahan uji regresi.
2. Paket untuk produksi/SiAdu memakai **soal baru** (model berparameter dan bank orisinal) serta **adaptasi** yang sudah ditulis ulang.
3. Ekspor yang memuat soal *Acuan sumber* apa adanya diberi peringatan dan butuh konfirmasi.

Keputusan akhirnya ada pada pemilik produk (K2).

## 14. Rencana tahap

| Tahap | Isi | Kriteria selesai |
| --- | --- | --- |
| 0 · Keputusan | PRD disetujui, K1–K8 dijawab, dokumen Cakupan Materi BPPK didapat | Bagian 15 terisi |
| 1 · Fondasi data | Scaffold Next.js, `import-latihukp.mjs`, normalisasi bank/aturan, `ukp-mapping.json`, tipe dan validator dasar | Impor 2.387 soal / 334 aturan / 183 kasus tanpa galat, laporan rujukan rusak, `verify` lulus |
| 2 · Generator dari bank | Form blueprint, perakit paket (kuota, blok kasus, seed, tanpa kembar), Hasil paket 3 panel, ganti nomor, ekspor PDF/Word/CSV/JSON, CLI + `agent-office.json` | 3 paket Tingkat C × 100 soal tanpa kembar, ekspor terbuka benar, `typecheck`/`verify`/`verify:quality` lulus |
| 3 · Soal baru | `ukp-parameter.json`, 10 model MVP, pemeriksa hitung ulang dan deteksi aturan lama, pratinjau model | Tiap model lulus hitung ulang di ≥200 seed, nol temuan aturan lama, kapasitas dilaporkan |
| 4 · SiAdu & produksi | Word SiAdu, Excel SiAdu, mapping Category/Lesson/Chapter, Ambil soal | Berkas terbaca importer SiAdu (uji lokal), sampel diperiksa tim akademik |
| 5 · Perluasan | Model P1 (TER, sanksi bunga, PBB, akuntansi, internasional), adaptasi kasus, bank orisinal, drill jebakan, uji peserta | Sesuai target stok K4 |

Setiap tahap ditutup dengan satu QA gabungan, mengikuti aturan hemat token di CLAUDE.local.md SKD Generator.

## 15. Keputusan yang perlu dijawab

| # | Pertanyaan | Usulan bawaan |
| --- | --- | --- |
| K1 | Produk ini di bawah merek apa (JadiASN, Cerebrum, lainnya), dan apa nama aplikasinya? Ini menentukan judul dan warna aksen. Tata letak dan font sudah ditetapkan di desain B+. | Nama kerja "UKP Studio", aksen amber B+ sampai merek diputuskan |
| K2 | Apakah soal LatihUKP boleh dipakai apa adanya di paket produksi/SiAdu? | Tidak. Hanya acuan internal (bagian 13) |
| K3 | Pemetaan tingkat resmi per materi/subtema: apakah ada file *Cakupan Materi UKP – BPPK (14 Okt 2026)*? Scrape baru menyimpan tautannya. | Mulai dari kisi-kisi `topics.json`, lalu sahkan dengan PDF BPPK |
| K4 | Format tryout target per tingkat: jumlah soal, durasi, komposisi per materi, dan target jumlah paket tanpa ulang | 100 soal / 180 menit, komposisi proporsional stok, target 5 paket per tingkat |
| K5 | Struktur SiAdu untuk UKP: Category / Lesson / Chapter apa yang dipakai? Apakah sudah ada di SiAdu? | Category = Tingkat, Lesson = Materi, Chapter = Subtema |
| K6 | Jumlah opsi: tetap 4 (A–D) seperti sumber, atau 5 (A–E)? | 4 opsi |
| K7 | Tanggal acuan aturan bawaan untuk paket | Tanggal hari ini; bisa diubah per paket |
| K8 | Siapa penelaah materi pajak yang mengesahkan standar konten (bagian 10) dan sampel hasil model? | Perlu ditunjuk |
| K9 | Stack: ikut SKD Generator (Next.js) atau HTML statis ringan seperti Roda Gila Generator? | Next.js, supaya ekspor dan importer SiAdu bisa dipakai ulang |

**Keputusan Tahap 0 (2 November 2026).** User meminta Tahap 0–5 langsung dikerjakan. Karena itu semua usulan bawaan di atas dipakai sebagai keputusan sementara, dan masing-masing masih bisa diganti tanpa membongkar arsitektur:

- **K1:** nama "UKP Studio" dan aksen amber `#B45309`, diatur di `lib/config.ts`.
- **K2:** bank LatihUKP berstatus acuan internal. Ekspor Word/Excel SiAdu yang memuat soal *Acuan sumber* meminta konfirmasi.
- **K3:** dokumen BPPK belum ada. Tingkat diambil dari `tingkat_kisi` soal sumber, dengan cakupan kumulatif A ⊂ A+B ⊂ A+B+C. Penggantian per materi/subtema ditulis di `data/ukp-mapping.json` bagian `override`.
- **K4:** tryout 100 soal / 180 menit, kuota proporsional terhadap stok, target 5 paket per tingkat tanpa soal kembar.
- **K5:** Category = `UKP Tingkat <tingkat soal>`, Lesson = nama materi, Chapter = subtema.
- **K6:** 4 opsi (A–D).
- **K7:** tanggal acuan bawaan = hari ini.
- **K8:** penelaah materi belum ditunjuk. Hasil model ditandai "perlu telaah ahli" di README dan QC.
- **K9:** Next.js 16 + TypeScript, versi paket sama dengan SKD Generator.

## 16. Metrik keberhasilan

- Satu paket tryout 100 soal siap ekspor (termasuk ganti nomor) dalam < 1 jam kerja penyusun.
- 0 soal model dengan kunci salah hitung pada pemeriksa hitung ulang.
- 0 soal di paket ekspor yang memakai ketentuan lama menurut tabel jebakan pada tanggal acuan.
- ≥90% soal sampel model lolos telaah penelaah materi tanpa revisi substansi.
- Ekspor Word/Excel SiAdu masuk ke SiAdu tanpa koreksi manual format.
- Stok cukup untuk target paket tanpa ulang di K4.

## 17. Risiko

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Aturan berubah lagi setelah snapshot (Oktober 2026 saja ada PER-12/PJ/2026, KEP-239/PJ/2026, PMK 71/2026) | Kunci salah | Parameter bertanggal di `ukp-parameter.json`, tabel jebakan bisa disunting, tanggal acuan per paket, impor ulang data |
| Bank sumber belum diverifikasi independen | Kesalahan sumber ikut terbawa | Penanda *Acuan sumber*, telaah sampel, laporan rujukan rusak |
| Hak pakai bank LatihUKP tidak jelas | Risiko hukum dan reputasi | Keputusan K2, fokus pada soal baru dan adaptasi |
| Label tingkat tidak konsisten | Komposisi tryout salah | `ukp-mapping.json` disahkan terhadap dokumen BPPK (K3) |
| Model hitungan PPh 21 TER dan sanksi bunga butuh tabel resmi | Tidak bisa generate atau tarif tertebak | Model menolak generate tanpa data, data dimasukkan dari lampiran resmi |
| Konteks soal monoton | Soal terasa berulang | Pemeriksa keragaman konteks, daftar kota/usaha yang luas |
| Format UKP resmi (jumlah soal, opsi) belum diumumkan | Blueprint meleset | Semua angka format bisa diatur, bawaan dari K4 |

## 18. Desain tampilan (disetujui 2 November 2026)

Dari tiga konsep (A Studio, B Lembar Kerja, C Alur Gelap), yang dipilih adalah **B+ "Lembar Kerja lengkap"**: Konsep B ditambah beberapa fitur dari A dan C. Mockup ada di kanvas [Pilihan Desain UKP Generator](https://claude.ai/artifact/EpK613YCsAt9yVoXtha3Rf), baris B+ (`B2-Atur`, `B2-Hasil`). Semua angka di mockup hanya contoh tampilan.

### Gaya visual

- Font: IBM Plex Sans untuk teks, IBM Plex Mono untuk angka, Rupiah, kode materi, nomor soal, dan langkah hitungan.
- Warna: teks grafit `#1F2328`, teks sekunder `#57606A`, garis `#D0D7DE`, latar panel `#F6F8FA`, aksen amber `#B45309`. Warna aksen bisa diganti setelah merek diputuskan (K1).
- Status: hijau `#1A7F37` = lolos, amber = ada catatan, biru = informasi. Setiap status juga punya teks atau ikon, supaya tidak hanya dibedakan lewat warna.
- Gaya padat seperti spreadsheet: tabel bergaris tipis, sel yang bisa disunting berlatar kuning muda `#FFF8E6`, dan sudut 6 px.

### Layar Atur paket

1. Bilah atas: tab Atur paket / Hasil paket / Pustaka / Riwayat, tanggal acuan aturan, dan tombol Cadangan.
2. Tab tingkat A / B / C, ditambah tombol pilihan jenis paket (Tryout penuh, Per materi, Per subtema, Drill jebakan aturan) dan sumber soal (Bank acuan, Soal baru, Campuran). Dua grup tombol ini diambil dari Konsep A.
3. Strip pengaturan: jumlah soal, durasi, jumlah paket, seed, tanggal acuan, dan "Larang soal kembar antarpaket".
4. Tabel kuota materi × kesulitan: kode, materi, sumber, stok, mudah/sedang/sulit (bisa disunting), jumlah soal kasus, kuota, dan pemakaian stok. Baris total ada di bawah.
5. Panel ringkasan di kanan (dari A): jumlah paket, sebaran kesulitan, rincian cek persediaan (materi paling ketat, blok kasus, cakupan model), Simpan preset, dan Impor CSV.
6. Bilah bawah menempel: ringkasan satu baris dan tombol **Buat paket**.

### Layar Hasil paket

1. Toolbar: pilih paket, cari, filter (Semua, Ada catatan, Menahan ekspor, Soal baru, Kasus), dan Tampilan peserta.
2. Strip angka paket (dari C): jumlah soal, lolos semua cek, ada catatan, menahan ekspor, posisi kunci, serta soal baru dibanding acuan.
3. Peta soal 1–100 (dari C): penanda untuk nomor yang sedang dibuka, ada catatan, dan bagian kasus. Nomor bisa diklik untuk loncat.
4. Tabel soal: centang, nomor, kode, subtema, tipe, kunci, asal, dan mutu. Soal kasus tampil sebagai satu blok yang bisa dibuka.
5. Panel detail di kanan (dari A): soal, opsi dan kunci, mutu otomatis dengan tombol perbaikan cepat (dari C, misalnya Urutkan opsi dan Adaptasi), pembahasan lengkap, lalu tombol Sunting / Salin soal / Ganti nomor ini.
6. Bilah bawah menempel: jumlah terpilih, Ganti terpilih, PDF, Excel SiAdu, dan Word SiAdu. Pintasan J/K untuk pindah soal.

### Tidak dipakai

- Sidebar langkah dari C, karena tab navigasi sudah mencakupnya dan tabel butuh lebar penuh.
- Tema gelap sebagai bawaan. Mungkin ditambahkan nanti sebagai pilihan.
- Ubin pilihan berukuran besar, karena kurang padat untuk gaya lembar kerja.

### Perilaku di layar sempit

Panel ringkasan dan panel detail turun ke bawah tabel. Tabel bisa digulir ke samping di dalam kotaknya. Strip pengaturan dan tombol pilihan dilipat ke baris berikutnya.
