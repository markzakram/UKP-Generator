# PRD: Generator Materi UKP (UKP Studio · Materi)

| | |
| --- | --- |
| Status | Versi 0.3, disetujui 3 November 2026. KM1–KM10 memakai usulan bawaan (bagian 16). Desain tab Materi: B+ disetujui (bagian 19) |
| Tanggal | 3 November 2026 |
| Folder | `G:\Ali\code\UKP Generator` (modul baru di aplikasi yang sama) |
| Template desain | `G:\Downloads\Template Desain Materi.pptx` (11 slide, ekspor Canva) |
| Uji kelayakan | `docs/materi/uji-coba-materi.pptx` dan `docs/materi/uji-coba-materi.png` (8 slide dari data UKP) |
| Sumber isi | Data UKP Studio: `data/ukp-rules.json`, `ukp-materi.json`, `ukp-bank.json`, model soal, `data/ukp-kasus/` |

## 1. Ringkasan

Generator Materi menyusun deck PowerPoint (.pptx) materi belajar UKP dengan gaya "Template Desain Materi". Isinya diambil dari data yang sudah ada di UKP Studio: 334 kartu aturan, 92 kartu hafalan/rumus, 318 kuis, serta soal model dan soal orisinal untuk contoh soal.

Alurnya tiga langkah:

1. Pilih cakupan, misalnya satu subtema.
2. Generator membuat **naskah materi** (kerangka slide berisi teks yang bisa disunting).
3. Naskah dirender menjadi .pptx yang tampilannya sama dengan template.

Seperti generator soal, modul ini berjalan di browser dan CLI tanpa API key dan tanpa AI. Hasilnya berupa berkas PowerPoint biasa yang tetap bisa disunting tim.

## 2. Latar belakang

- Template materi saat ini dibuat manual di Canva. Satu deck berisi 11 slide untuk satu topik (contoh: Konsep Dasar Penalaran Verbal).
- UKP punya 10 materi dan 69 subtema. Kalau satu subtema butuh sekitar 15 slide, totalnya sekitar 1.000 slide yang harus disusun, dijaga konsisten, dan diperbarui setiap kali aturan berubah (misalnya batas setor tanggal 15 dan tarif PPN 12% × 11/12).
- Datanya sudah terstruktur di UKP Studio. Setiap aturan punya konsep, pokok, syarat, pengecualian, tarif/DPP, ambang, tenggat, contoh, jebakan, dasar hukum, dan masa berlaku. Data ini bisa dipetakan langsung ke pola slide template.

## 3. Tujuan dan non-tujuan

### Tujuan

1. Menghasilkan deck .pptx per subtema (juga per materi atau per aturan pilihan) yang tampilannya mengikuti template: palet, font Poppins, chip judul, kartu, bilah navigasi, dan foto sampul.
2. Teks tidak boleh meluap, terpotong, atau bertumpuk. Ukuran huruf menyesuaikan panjang teks, dan teks yang terlalu panjang dipecah ke slide lanjutan.
3. Isi bisa disunting sebelum diunduh: judul slide, poin, urutan, dan slide yang disembunyikan. Naskah tersimpan dan bisa dibuat ulang.
4. Isi mengikuti tanggal acuan aturan, sama seperti generator soal. Aturan yang belum atau sudah tidak berlaku tidak dipakai, dan ketentuan lama ditandai.
5. Setiap slide bisa ditelusuri ke sumbernya: ID aturan, dasar hukum, dan masa berlaku dicatat di catatan pembicara.
6. Tersedia di UI (tab baru) dan CLI/Agent Office, termasuk unduhan massal satu materi.

### Non-tujuan

- Menulis materi baru dengan AI. Naskah disusun dari data. Penulisan ulang dilakukan manusia di penyunting, atau naskah JSON dari luar diimpor (bagian 10, F8).
- Mengubah desain template atau membuat tema baru di versi awal.
- Video, suara, animasi, dan transisi.
- Menjamin kebenaran isi. Isi tetap menunggu telaah penelaah materi (PRD utama K8).

## 4. Pengguna

| Pengguna | Kebutuhan |
| --- | --- |
| Tim konten/pengajar | Deck siap pakai per subtema, bisa disunting sebelum kelas |
| Penelaah materi | Melihat sumber dan dasar hukum per slide; menandai bagian yang sudah ditulis ulang atau ditelaah |
| Admin produksi | Unduh massal per materi untuk LMS atau drive kelas |
| Agent Office | Menjalankan pembuatan deck lewat CLI |

## 5. Bedah template

### 5.1 Fakta teknis

- Kanvas 16:9 berukuran 1440 × 810 pt (20 × 11,25 inci). Semua ukuran di dokumen ini memakai satuan pt pada kanvas tersebut. Ukuran huruf terlihat besar karena kanvasnya 1,5 kali kanvas PowerPoint standar.
- Semua slide memakai layout kosong (Blank). Elemennya berupa freeform dan textbox hasil ekspor Canva, tanpa placeholder dan tanpa nama yang bermakna.
- Font tertanam (format EOT): Poppins, Poppins Bold, Poppins Ultra-Bold, Inter, Inter Medium, Inter Bold, Arial Nova Bold, dan Arial Nova Bold Italics.
- Media: foto meja kerja 1920 × 1080 untuk sampul dan penutup (opasitas 31%), 6 ikon garis, 2 ilustrasi (dokumen-jam, orang bertanya), ikon peringatan, dan pola gradien.

### 5.2 Token desain

| Token | Nilai | Dipakai untuk |
| --- | --- | --- |
| Biru langit | `00AEEF` | Awal gradien judul dan bilah |
| Biru tua | `004B66` | Akhir gradien judul, label navigasi aktif |
| Teal | `0A6486` | Judul slide, kartu kedua, kotak langkah |
| Slate | `364D61` | Kartu gelap, kepala tabel, pil sampul, teks pembuka |
| Mint | `CFE2BE` | Akhir gradien chip dan bilah navigasi |
| Gradien judul | `00AEEF → 004B66`, 45° | Judul sampul, judul ikhtisar, teks chip |
| Huruf | Poppins Regular/Bold | Semua teks |
| Judul slide | Poppins Bold 54–56 pt, teal | |
| Isi | Poppins 26–30 pt | Paragraf; teks pembuka berwarna slate |

### 5.3 Pola slide di template

| Slide | Pola | Unsur |
| --- | --- | --- |
| 1 | Sampul | Foto pudar, judul gradien kapital, 2 pil gelap (nama Indonesia dan Inggris) |
| 2 | Ikhtisar | Judul gradien besar dan subjudul miring; 6 kartu (kartu pertama gradien, sisanya slate) berisi judul, deskripsi, dan ubin ikon; bilah navigasi |
| 3, 6 | Konsep | Chip judul bagian (gradien + ubin ikon), judul, teks pembuka slate, isi, ilustrasi kanan, catatan ⚠ |
| 4 | Tiga definisi | Kartu slate: label tebal, garis pemisah, deskripsi |
| 5 | Tabel | Kepala slate, 3 kolom × 3 baris |
| 7–9 | Dua kartu kontras | Kartu slate dan teal: judul, lalu contoh Bacaan/Klaim |
| 10 | Langkah | 4 kotak teal bernomor |
| 11 | Penutup | Foto pudar, "TERIMA KASIH" gradien |

Bilah navigasi di bawah menampilkan 5 bagian deck. Di slide 8, bagian aktif tampil gelap dan bagian lain pudar.

### 5.4 Cacat template yang tidak ikut ditiru

| Cacat | Perlakuan di generator |
| --- | --- |
| Judul sampul 3 baris menabrak pil | Ukuran judul disesuaikan, posisi pil dihitung dari tinggi judul |
| Kartu ke-6 berisi teks contoh berbahasa Inggris ("Release the final product…") | Kartu dibuat dari data. Cek otomatis menolak teks contoh |
| Typo "Struktrul Soal" di bilah navigasi | Label diambil dari naskah |
| Semua langkah bernomor "1." | Nomor dibuat otomatis |
| Rata kanan-kiri menimbulkan spasi renggang | Isi rata kiri |
| Status aktif navigasi hanya muncul di slide 8 | Status aktif ada di semua slide isi |
| Judul ditulis dengan font "Poppins Bold" yang tidak terbaca PowerPoint, sehingga tampil sebagai Arial | Memakai Poppins dengan atribut tebal. Uji coba membuktikan judul tampil Poppins Bold |
| Arial Nova (font Microsoft) ikut tertanam | Tidak dipakai. Pil sampul memakai Poppins Bold/miring |

## 6. Pendekatan teknis dan hasil uji kelayakan

### 6.1 Pilihan pendekatan

| Pendekatan | Kelebihan | Kekurangan | Keputusan |
| --- | --- | --- | --- |
| A. Gandakan slide template lalu ganti teksnya | Persis seperti template | Kotak teks berukuran tetap sehingga mudah meluap; grup Canva bertransformasi; jumlah kartu tetap 6; tidak ada nama elemen yang stabil | Ditolak |
| B. pptxgenjs dari nol | Pustaka umum | Tidak bisa membuat teks gradien atau menanam font; tampilan bergeser dari template | Ditolak |
| **C. Paket dasar template + slide dirakit dari kode** | Tema, font tertanam, dan media template tetap dipakai. Posisi dan ukuran dihitung sesuai isi. Jumlah kartu dan baris bebas. XML-nya bersih (kotak bulat dan teks biasa) | Gaya template perlu ditulis ulang sekali sebagai pola kode | **Dipakai** |

### 6.2 Hasil uji kelayakan (3 November 2026)

Script uji membuat 8 slide dari subtema "PPh 21: pemotong, penerima & objek": sampul, ikhtisar, konsep, dua kartu, tabel, langkah, contoh soal, dan penutup. Hasilnya dirender lewat PowerPoint di komputer yang tidak memasang Poppins.

- PowerPoint membuka berkas tanpa permintaan perbaikan.
- Poppins Regular dan Bold tampil dari font tertanam. Judul tampil Poppins Bold, lebih rapi daripada template asli yang jatuh ke Arial.
- Teks gradien, gradien chip, bilah navigasi dengan status aktif, bayangan ubin ikon, dan foto pudar 31% semuanya tampil sesuai.
- Ukuran berkas 2,4 MB. Sebagian besar dari foto sampul.
- **Temuan 1:** perkiraan lebar huruf rata-rata membuat judul patah dan paragraf bertumpuk. Masalah ini selesai dengan **tabel lebar per huruf Poppins** yang diukur dari PowerPoint. Selisihnya ≤ 2% dibanding pengukuran PowerPoint, dan selalu sedikit lebih lebar sehingga aman.
- **Temuan 2:** `[Content_Types].xml` harus dibersihkan dengan pencocokan atribut yang tidak bergantung urutan. Bila tidak, PowerPoint menolak berkas. Masalah ini masuk cek struktur otomatis.
- Validator OOXML dari skill pptx tidak berjalan di Windows ini, karena gagal memuat skema XSD, termasuk untuk template aslinya. Pengujian akhir memakai PowerPoint lewat COM.

### 6.3 Arsitektur

```
data UKP ──► susunNaskah() ──► Naskah (JSON, bisa disunting/diimpor)
                                   │
                                   ▼
                          tataLetak(naskah) ──► daftar kotak absolut (pt) per slide
                                   │                 │
                                   ▼                 ▼
                         tulisPptx() + paket dasar   pratinjau HTML di browser
                         (tema, font, media)         (koordinat sama, font Poppins web)
```

- Pratinjau di aplikasi dan .pptx memakai satu hasil tata letak, jadi apa yang terlihat di layar sama dengan berkas yang diunduh.
- Fungsi pengukur teks memakai tabel lebar per huruf (Poppins Regular/Bold untuk 212 huruf: ASCII, Latin-1, dan simbol seperti – → × · … ≤ ≥ “ ” €) dengan cadangan lebar 3%. Tabel ini tidak bergantung pada browser atau Node.
- Tinggi teks: PowerPoint memakai 1,2 × ukuran huruf per baris untuk Poppins. Mesin menulis spasi baris dalam pt yang pasti dan menambah cadangan 0,15 × ukuran huruf di bawah baris terakhir. Tambahan ini terukur dari render PowerPoint pada M1.
- Paket dasar berasal dari template yang dibersihkan: tanpa slide, hanya font Poppins Regular dan Bold, media yang dipakai saja (ikon dengan pasangan SVG), dan font tema diganti Poppins. Paket ini disimpan di `assets/materi/dasar.pptx` (dibuat `npm run materi:dasar`) dan disalin ke `public/materi/` untuk browser.

## 7. Sumber isi dan pemetaan ke slide

| Data | Jumlah | Dipakai untuk |
| --- | --- | --- |
| Kartu aturan (`ukp-rules.json`) | 334 aturan, 69 subtema | Isi utama |
| Kartu hafalan (`ukp-materi.json`) | 64 | Tabel atau daftar "yang wajib dihafal" |
| Kartu rumus | 28 | Slide rumus dan langkah hitung |
| Kuis | 318 (B/S 92, PG 95, isian 74, jodoh 57) | Kuis cepat di akhir deck |
| Topik (`topik`) | 11 | Slide pembuka materi dan info ujian |
| Soal model dan orisinal | 21 model, 10 soal orisinal | Contoh soal dan pembahasan |
| Soal bank LatihUKP | 2.387 | Contoh soal hanya dengan konfirmasi (KM3) |
| Jebakan aturan lama (`ukp-jebakan.json`) | 13 pola | Slide "kesalahan umum" dan pemeriksaan naskah |

Pemetaan ruas aturan ke pola slide:

| Ruas aturan | Pola slide |
| --- | --- |
| `konsep` (teks pembuka) + `pokok` (isi) + `dasarHukum` (catatan ⚠) | Konsep (P3) |
| `subjek`/`syarat` dan `pengecualian` | Dua kartu kontras (P5): "Termasuk" dan "Dikecualikan" |
| `tarifDpp`, `ambang`, `tenggat` | Tabel angka (P6) atau kartu angka besar (P9) |
| `hakKewajiban`, `konsekuensi` | Tiga definisi (P4): Hak/Kewajiban, Konsekuensi, Berlaku |
| `contoh` | Kartu contoh (P5, varian "Kasus → Jawaban") |
| `jebakan` | Kesalahan umum (P10, ⚠ + ilustrasi) |
| `bedaDengan` | Tabel pembeda (P6) |
| `berlaku`, `sumber`, `id`, `keyakinan` | Catatan pembicara (tidak tampil di slide) |
| Kartu rumus: `rumus`, `rumusKet`, `contoh` | Rumus (P8) lalu Langkah (P7) |

## 8. Struktur deck bawaan (per subtema)

| No | Bagian | Pola | Muncul jika |
| --- | --- | --- | --- |
| 1 | Sampul | P1 | Selalu |
| 2 | Ikhtisar: kartu per aturan (maks. 6 per slide) + kartu Latihan | P2 | Selalu |
| 3… | Per aturan: Konsep → Ketentuan → Angka → Contoh/Jebakan | P3–P6, P10 | Ruasnya terisi |
| … | Rumus dan langkah hitung | P8, P7 | Ada kartu rumus untuk subtema ini |
| … | Wajib dihafal | P6 | Ada kartu hafalan untuk subtema ini |
| … | Kuis cepat (3–5 butir B/S) | P11 | Ada kuis |
| … | Contoh soal, lalu pembahasan | P12, P13 | Ada soal yang memenuhi sumber yang dipilih |
| … | Rangkuman | P14 | Selalu |
| akhir | Penutup | P15 | Selalu |

Kepadatan bisa dipilih:

| Kepadatan | Isi | Perkiraan untuk subtema 4–5 aturan |
| --- | --- | --- |
| Ringkas | 1 slide per aturan | 9–12 slide |
| **Standar** (bawaan) | 2–3 slide per aturan | 15–20 slide |
| Lengkap | Semua ruas, contoh soal ganda | 22–30 slide |

Bilah navigasi menampilkan bagian deck, paling banyak 6 label pendek. Untuk subtema dengan ≤ 5 aturan, labelnya judul pendek setiap aturan ditambah "Latihan". Kalau aturannya lebih banyak, labelnya jenis bagian: Konsep · Ketentuan · Angka · Contoh · Latihan.

Cakupan lain:

- **Per materi:** sampul materi, pembatas bagian per subtema (P16), lalu deck subtema berurutan.
- **Per aturan pilihan:** untuk kelas tematik, misalnya "semua jebakan tanggal setor".

## 9. Katalog pola slide

| Kode | Pola | Asal | Aturan isi |
| --- | --- | --- | --- |
| P1 | Sampul | Slide 1 | Judul ≤ 3 baris, 56–92 pt; pil kiri = materi, pil kanan = tingkat dan tahun |
| P2 | Ikhtisar | Slide 2 | 2–6 kartu; judul kartu ≥ 15 pt, deskripsi ≥ 11 pt; lebih dari 6 kartu dibagi ke slide berikutnya |
| P3 | Konsep | Slide 3, 6 | Teks pembuka ≤ 3 baris; isi ≥ 18 pt; sisa isi dipecah ke slide lanjutan; ilustrasi bergantian |
| P4 | Tiga definisi | Slide 4 | 2–4 kartu label + deskripsi |
| P5 | Dua kartu kontras | Slide 7–9 | 2 kartu (slate/teal), poin berbutir ≥ 16 pt |
| P6 | Tabel | Slide 5 | 2–4 kolom, ≤ 5 baris per slide; baris berlebih masuk slide lanjutan |
| P7 | Langkah | Slide 10 | 2–6 langkah bernomor; "Label:" otomatis ditebalkan |
| P8 | Rumus | Baru, gaya slide 4 | Rumus dalam kartu slate, keterangan di bawah |
| P9 | Angka besar | Baru, gaya slide 2 | 2–4 angka (tarif/ambang/tenggat) 60–72 pt dengan label |
| P10 | Kesalahan umum | Slide 6 | ⚠ + ilustrasi; "Aturan lama" dan "Yang berlaku" berdampingan |
| P11 | Kuis cepat | Baru | Pernyataan + Benar/Salah; jawaban di slide berikutnya atau di catatan pembicara |
| P12 | Contoh soal | Baru, uji coba slide 7 | Kasus + soal dalam kotak muda, 4 kartu opsi |
| P13 | Pembahasan | Baru | Kunci disorot teal, langkah P7, dasar hukum |
| P14 | Rangkuman | Baru, gaya slide 2 | 3–6 poin kunci dari `konsep` setiap aturan |
| P15 | Penutup | Slide 11 | Teks bisa diubah (bawaan "TERIMA KASIH") |
| P16 | Pembatas bagian | Baru, gaya sampul | Untuk deck per materi |

## 10. Lingkup fitur

### F1. Pilih cakupan, P0
Pilih tingkat (A, A+B, atau A+B+C), materi, subtema atau aturan, kepadatan, tanggal acuan, sumber contoh soal, dan jumlah contoh soal/kuis.

### F2. Susun naskah otomatis, P0
`susunNaskah()` deterministik untuk data dan pengaturan yang sama. Setiap blok mencatat `asal` (acuan, ditulis ulang, atau orisinal) dan rujukan ID aturan/kartu/soal.

### F3. Penyunting naskah, P0
- Daftar slide di kiri, isi slide terpilih di kanan.
- Bisa menyunting judul, teks pembuka, poin, dan label pendek; mengubah urutan; menyembunyikan atau menggandakan slide; mengganti pola dengan pola lain yang sesuai; dan mengganti contoh soal.
- Blok yang disunting otomatis berstatus "ditulis ulang".

### F4. Pratinjau slide, P0
- Pratinjau memakai tata letak yang sama dengan .pptx.
- Peringatan muncul per slide: teks dipecah, huruf mengecil sampai batas minimum, atau label terlalu panjang.

### F5. Unduh, P0
- .pptx dan naskah .json.
- Unduhan massal satu materi berupa .zip berisi satu deck per subtema.
- PDF menyusul (P2). Sementara bisa lewat PowerPoint (Simpan sebagai PDF).

### F6. Riwayat, P1
Naskah disimpan di IndexedDB dengan 20 versi terakhir, sama seperti paket soal. Tersedia cadangan dan impor.

### F7. CLI dan Agent Office, P0
```
npm run materi -- --subtema "PPh 21: pemotong, penerima & objek" --kepadatan standar --format pptx,json --out output\materi
npm run materi -- --materi PPN --format pptx --zip
```
- CLI mencetak `RINGKASAN ->` dan `BERKAS ->`.
- `agent-office.json` mendapat pekerjaan "Buat materi".

### F8. Impor naskah, P1
- Naskah JSON dari luar (ditulis manusia atau agen) dirender dengan mesin yang sama.
- Fitur ini juga membuka pemakaian untuk topik non-UKP, misalnya Penalaran Verbal seperti contoh template.

## 11. Aturan tata letak dan teks

- Batas aman: margin kiri dan kanan 57 pt. Isi berakhir paling bawah di 700 pt, karena bilah navigasi ada di 720–784 pt.
- Urutan penyesuaian ukuran: huruf diperkecil 1 pt per langkah sampai batas minimum pola. Kalau masih tidak muat, teks dipecah per kalimat atau poin ke slide "(lanjutan)". Huruf tidak boleh di bawah batas minimum. Setelah satu bagian dipecah, semua slide lanjutannya memakai ukuran huruf yang sama.
- Teks isi tidak pernah dipotong. Hanya label (judul kartu, chip, label navigasi, kepala kolom) yang boleh dipotong dengan "…" bila tidak muat. Label itu dilaporkan untuk disunting.
- Judul diusahakan satu baris (judul slide 54→44 pt, judul ikhtisar 100→64 pt) sebelum dua baris diizinkan.
- Kartu dua sisi (P5) dan kesalahan umum (P10) setinggi isinya (minimal 260/240 pt), tidak selalu memanjang sampai bawah.
- Ukuran huruf per pola (maks → min, pada kanvas 1440 pt; ditetapkan pada QC visual M1 agar terbaca saat ditayangkan):

| Teks | Maks → min |
| --- | --- |
| Judul slide | 54 → 38 |
| Isi konsep (P3) | 26 → 22 |
| Teks pembuka | 30 → 22 (P3), 28 → 20 (pola lain) |
| Poin kartu dua sisi (P5) | 24 → 18 |
| Isi kartu kesalahan (P10) | 24 → 20 |
| Isi definisi (P4) | 24 → 16 |
| Sel tabel (P6) | 24 → 16; dipecah pada 18 |
| Langkah (P7) | 24 → 18 |
| Sorotan ⚠ | 24 → 16 |
| Judul kartu ikhtisar / isi kartu ikhtisar | 21 → 15 / 14 → 11 |
| Label navigasi | 17 → 14 |
- Isi rata kiri. Rata tengah hanya untuk judul sampul, ikhtisar, kartu ikhtisar, dan label navigasi.
- Label pendek (chip dan navigasi) paling panjang 28 karakter. Label yang dibuat otomatis dari `judul` aturan (bagian sebelum ":" atau ";") dan masih terlalu panjang akan ditandai untuk disunting.
- Ikon dan ilustrasi bergiliran secara deterministik per aturan, supaya slide yang berurutan tidak memakai gambar yang sama.
- Catatan pembicara memuat: ID aturan, dasar hukum, masa berlaku, keyakinan, URL sumber, dan kunci kuis.

## 12. Pemeriksaan mutu

Cek otomatis (`npm run verify:materi`) dijalankan untuk semua 69 subtema dan 3 kepadatan:

1. Struktur paket: setiap slide terdaftar di `presentation.xml`, rels, dan content types; tidak ada bagian yatim; XML valid.
2. Tidak ada teks meluap (menurut pengukur) dan tidak ada huruf di bawah batas minimum.
3. Tidak ada teks contoh dari template (`lorem`, `Release the final product`, `Struktrul`) dan tidak ada kotak kosong.
4. Penomoran langkah dan opsi soal benar. Kunci di slide pembahasan sama dengan kunci soal.
5. Aturan yang dipakai berlaku pada tanggal acuan. Teks naskah dipindai pola jebakan aturan lama dengan pengecualian sah yang sama seperti generator soal.
6. Deterministik: pengaturan yang sama menghasilkan naskah dan berkas yang sama (kecuali cap waktu).
7. Uji render (khusus mesin pengembang yang punya PowerPoint): `scripts/materi-render.ps1` membuka deck lewat COM (gagal buka = berkas perlu perbaikan), membandingkan tinggi teks hasil render PowerPoint dengan kotaknya, memastikan hanya Poppins yang dipakai, dan bisa mengekspor PNG untuk QC visual.

## 13. Hak pakai isi

Teks kartu aturan, kartu hafalan, dan kuis berasal dari LatihUKP, sama seperti bank soal. Deck materi yang dibagikan ke peserta berarti menerbitkan ulang teks tersebut. Usulan bawaan (KM2), sejalan dengan K2 di PRD utama:

1. Deck yang masih memuat blok berstatus `acuan` diberi tanda **Draf internal** di catatan pembicara dan properti berkas. Unduhan untuk dibagikan meminta konfirmasi, seperti ekspor SiAdu.
2. Blok yang disunting di F3, atau naskah orisinal yang diimpor, berstatus bebas.
3. Contoh soal memakai soal model dan soal orisinal. Soal bank LatihUKP hanya dipakai dengan konfirmasi.
4. Foto sampul dan ikon berasal dari template tim, dan font Poppins berlisensi OFL, jadi aman ditanam. Arial Nova tidak dipakai.

## 14. Rancangan struktur kode

```
lib/materi/
  naskah.ts        tipe Naskah, Slide, Blok, asal
  susun.ts         susunNaskah(data, pengaturan): aturan/kartu/kuis/soal → naskah
  metrik.ts        tabel lebar Poppins + ukurTeks/bungkus/pasUkuran
  tata-letak/      satu berkas per pola (P1–P16) → Kotak[]
  pptx.ts          tulisPptx(kotak[], paketDasar) → Uint8Array (fflate)
  cek.ts           pemeriksaan bagian 12
assets/materi/
  dasar.pptx       template yang dibersihkan (tema, master, Poppins, media)
  metrik-poppins.json
components/materi/ AturMateri, PenyuntingNaskah, PratinjauSlide
scripts/materi.ts  CLI
scripts/materi-verify.ts
```

## 15. Rencana tahap

| Tahap | Isi | QC |
| --- | --- | --- |
| M0 · Keputusan dan desain | PRD ini disetujui, KM1–KM10 dijawab, 3 opsi tampilan tab Materi lalu dipilih | Keputusan tercatat di PRD |
| M1 · Mesin PPTX | Paket dasar, metrik, 10 pola dari template (P1–P7, P10, P15, P16), pemecah slide lanjutan | Uji render COM, cek struktur, 0 luapan pada data uji |
| M2 · Penyusun naskah | `susunNaskah`, pola baru (P8, P9, P11–P14), tanggal acuan, jebakan, catatan pembicara, status asal | 69 subtema × 3 kepadatan lulus `verify:materi` |
| M3 · UI | Tab Materi: cakupan, penyunting, pratinjau, unduh, riwayat, konfirmasi hak pakai | Uji browser 1440 dan 375 px |
| M4 · Produksi | CLI, `agent-office.json`, unduhan massal .zip, README | QC akhir lintas tahap, `npm audit` 0 |
| M5 · Perluasan (opsional) | Impor naskah non-UKP, PDF, ikon tambahan | Per fitur |

## 16. Keputusan

Disetujui 3 November 2026: semua butir memakai usulan bawaan.

| No | Pertanyaan | Keputusan |
| --- | --- | --- |
| KM1 | Generator khusus UKP, atau umum untuk topik lain (contoh template: Penalaran Verbal)? | Isi otomatis khusus UKP. Mesin dan format naskah dibuat umum, jadi topik lain bisa masuk lewat impor naskah (F8, P1) |
| KM2 | Hak pakai teks LatihUKP di deck yang dibagikan | Tanda "Draf internal" + konfirmasi sampai bloknya ditulis ulang atau ditelaah (bagian 13) |
| KM3 | Sumber contoh soal | Model dan orisinal; bank LatihUKP dengan konfirmasi |
| KM4 | Font | Poppins Regular/Bold saja, tertanam; Inter dan Arial Nova dibuang |
| KM5 | Foto sampul dan stiker "all about cere" | Dipakai apa adanya sebagai identitas tim |
| KM6 | Cakupan dan kepadatan bawaan | Per subtema, kepadatan Standar (15–20 slide) |
| KM7 | Letak modul | Tab "Materi" di UKP Studio (berbagi data, desain B+, riwayat, CLI) |
| KM8 | Ilustrasi | Set ikon dan ilustrasi template dipakai bergiliran; ikon tambahan berlisensi bebas di M5 |
| KM9 | Kuis di deck | 3–5 butir B/S per subtema, jawaban di slide berikutnya |
| KM10 | Format unduhan | .pptx + naskah .json di M1–M4; PDF di M5 |

## 17. Metrik keberhasilan

- 69 dari 69 subtema menghasilkan deck pada ketiga kepadatan, tanpa luapan dan tanpa huruf di bawah batas minimum.
- Sampel deck terbuka di PowerPoint tanpa permintaan perbaikan, dan font tampil Poppins di komputer tanpa Poppins terpasang.
- Satu deck subtema selesai dibuat di browser dalam ≤ 3 detik. Ukuran berkas ≤ 5 MB.
- Penyunting naskah: perubahan teks langsung terlihat di pratinjau, dan berkas yang diunduh sama dengan pratinjau.

## 18. Risiko

| Risiko | Mitigasi |
| --- | --- |
| Keynote dan beberapa versi PowerPoint Mac mengabaikan font tertanam | Poppins tersedia gratis; README mencantumkan cara memasangnya. Google Slides menyediakan Poppins |
| Lebar huruf meleset pada teks berbahasa campuran atau simbol langka | Cadangan 3%; huruf di luar tabel memakai lebar huruf lebar; uji render COM pada sampel |
| Teks kartu aturan padat sehingga slide terlalu berteks | Kepadatan Ringkas, pemecahan per poin, dan penyunting naskah |
| Isi belum ditelaah ahli (K8) | Status `keyakinan` dan asal blok ada di catatan pembicara; tanda "Draf internal" |
| Hak pakai teks acuan (K2) | Bagian 13 |
| Template diperbarui tim desain | Token desain dan pola terkumpul di `tata-letak/`. Perubahan kecil (warna, font, foto) cukup di paket dasar dan tabel token |

## 19. Desain tampilan tab Materi

Tab Materi memakai gaya B+ (IBM Plex, grafit, amber). Ada 3 opsi tata letak di kanvas desain (halaman "Generator materi"), semuanya memakai data subtema "PPh 21: pemotong, penerima & objek" dan slide hasil uji coba. **Dipilih 3 November 2026: B · Lembar Naskah. Gabungan B+ di bawah tabel ini disetujui pada hari yang sama dan menjadi desain final tab Materi.**

| Opsi | Inti | Cocok untuk |
| --- | --- | --- |
| A · Meja Slide | Daftar slide bergambar di kiri, pratinjau besar di tengah, panel isian di kanan; pemeriksaan dan catatan pembicara di bawah pratinjau | Menyunting satu deck sampai rapi |
| B · Lembar Naskah | Panel cakupan di kiri (bisa beberapa subtema), naskah sebagai tabel slide dengan kolom pola, sumber, asal, dan tata letak; pratinjau dan isian di kanan; unduh .zip | Menyusun dan memeriksa beberapa deck sekaligus, sejalan dengan layar Hasil paket |
| C · Rak Produksi | 69 subtema per materi dengan status Belum/Draf internal/Ditelaah, pilih banyak untuk disusun atau diunduh; laci kanan berisi deretan slide dan pemeriksaan | Memantau produksi seluruh materi dan status telaah |

### B+ Materi, disetujui (artboard "Materi B+" di kanvas)

Dasarnya B: panel cakupan di kiri, naskah berupa tabel slide, dan panel slide di kanan.

| Tambahan | Dari | Alasan |
| --- | --- | --- |
| Mode **Perbesar pratinjau**: tabel diganti deretan gambar slide di atas, pratinjau besar di tengah, dan panel isian di kanan. Tombol dan pintasan P untuk kembali ke tabel | A, deretan slide dari C | Merapikan tata letak satu slide lebih nyaman di pratinjau besar, sedangkan tabel tetap menjadi tampilan utama untuk memeriksa urutan dan asal |
| Daftar **Pemeriksaan slide ini** (tata letak, aturan berlaku, ketentuan lama, asal teks) di panel kanan | A | Penelaah langsung melihat alasan status tanpa membuka catatan pembicara |
| Tombol **Kembalikan teks acuan** | A | Membatalkan suntingan satu slide, dan statusnya kembali menjadi "Teks acuan" |
| Status deck per subtema (**Belum disusun / Draf internal / Ditelaah**) di daftar subtema, dengan saring status dan angka "3/8 disusun" di pilihan materi | C | Kemajuan produksi terlihat tanpa layar rak terpisah |
| Tombol **Tandai deck ditelaah** di setiap tab deck | C | Status ini yang menentukan tanda Draf internal pada berkas (KM2) |

Tidak diambil:

- Bilah cakupan di atas dari A, karena B sudah punya panel cakupan di kiri.
- Daftar slide vertikal permanen dari A. Tabel sudah menjalankan fungsinya, dan deretan gambar muncul di mode Perbesar.
- Layar rak 69 subtema dari C. Status di panel kiri dan saringnya sudah cukup, dan layar terpisah menambah navigasi tanpa fungsi baru.
