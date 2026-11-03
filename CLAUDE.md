# UKP Generator (UKP Studio)

Generator paket soal Uji Kompetensi Perpajakan (UKP) Tingkat A, B, C, ditambah generator materi (deck .pptx bergaya template tim). Spesifikasi lengkap ada di `PRD.md` (soal) dan `PRD-Materi.md` (materi), rencana dan status di `ROADMAP.md`, hasil QC per tahap di `QC.md`.

## Struktur singkat

- `data/` hasil impor yang dibundel: `ukp-bank.json`, `ukp-rules.json`, `ukp-mapping.json`, `ukp-parameter.json`, `ukp-konteks.json`, `ukp-jebakan.json`. Disalin ke `public/data/` oleh `npm run import:data` supaya browser bisa memuatnya.
- `lib/` logika murni tanpa React (bisa dipakai browser dan CLI): `generate.ts`, `blueprint.ts`, `replace.ts`, `quality.ts`, `models/`, `export/`, `storage.ts` (khusus browser).
- `lib/materi/` mesin deck materi: `naskah.ts` (format naskah), `metrik.ts` (lebar huruf Poppins), `tata-letak/` (pola P1–P16 → kotak berposisi), `pptx.ts` (penulis .pptx), `cek.ts` (pemeriksaan).
- `assets/materi/` template sumber, paket dasar `dasar.pptx` (dibuat `npm run materi:dasar`, juga disalin ke `public/materi/`), dan `metrik-poppins.json`.
- `components/` dan `app/` tampilan desain B+ (PRD bagian 18; tab Materi: PRD-Materi bagian 19).
- `scripts/` impor data, CLI (`generate.ts` untuk paket soal, `materi.ts` untuk deck materi), dan pemeriksa.

## Cara memeriksa (wajib setelah mengubah kode atau data)

1. `npm run typecheck`
2. `npm run verify`
3. `npm run verify:quality`
4. `npm run verify:models` (setelah mengubah `lib/models/` atau `data/ukp-parameter.json`)
5. `npm run verify:export` (setelah mengubah `lib/export/`)
6. `npm run verify:materi` (setelah mengubah `lib/materi/` atau `assets/materi/`)
7. Uji render PowerPoint (Windows dengan PowerPoint, setelah mengubah tata letak materi): `powershell -ExecutionPolicy Bypass -File scripts/materi-render.ps1 output/materi-uji` — semua deck harus terbuka dan 0 teks meluap. Untuk ke-69 deck: `npx tsx scripts/materi-verify.ts --semua`, lalu jalankan script render untuk `output/materi-semua`.

## Aturan

- Sumber data adalah `../Scrape UKP/output/latihukp/`. Jangan menyunting `data/ukp-bank.json` dengan tangan; ubah `scripts/import-latihukp.mjs` lalu jalankan `npm run import:data`.
- Tarif, ambang, dan tenggat hanya boleh ada di `data/ukp-parameter.json` beserta `berlaku` dan `dasar_hukum`. Model soal tidak boleh menanam angka aturan di kode.
- Tingkat UKP per subtema ada di `data/ukp-mapping.json` bagian `subtema` (ditulis impor) dan `override` (disunting tangan). Tingkat soal/model = yang lebih tinggi antara tingkat subtema dan labelnya; kartu aturan ikut tingkat subtema. Pakai `tingkatSoal`, `tingkatAturan`, atau `tingkatSubtema` dari `lib/data.ts`, jangan membaca `.tingkat` mentah.
- Model tidak boleh menebak data resmi yang tidak ada (tabel TER, tarif bunga KMK bulanan). Angka seperti itu ditulis sebagai fakta di soal, atau model menolak generate.
- Soal bank LatihUKP berstatus acuan internal (PRD K2). Ekspor SiAdu yang memuatnya harus meminta konfirmasi. Teks kartu aturan LatihUKP di deck materi juga acuan (PRD-Materi KM2).
- Deck materi: ukuran dan posisi hanya dihitung lewat `lib/materi/metrik.ts` (lebar huruf hasil ukur PowerPoint). Teks isi tidak boleh dipotong; bila tidak muat, dipecah ke slide "(lanjutan)". Jangan menyunting `assets/materi/dasar.pptx` dengan tangan; ubah `scripts/materi-dasar.mjs` lalu jalankan `npm run materi:dasar`.
- Jangan `git push` dan jangan commit kecuali diminta.
- Kalau opsi CLI atau script `package.json` berubah, perbarui `agent-office.json` di perubahan yang sama.
