# Bank orisinal (`data/ukp-kasus/`)

Soal yang ditulis tim UKP Studio sendiri, bukan salinan LatihUKP. Isinya memakai fakta dari kartu aturan, sehingga ikut dalam ekspor produksi tanpa konfirmasi K2.

Isi per 3 Nov 2026: 56 soal di 10 materi (label tingkat A 24, B 10, C 22). Nama, angka, dan tanggal dibuat sendiri, tidak menyalin contoh kartu aturan. Pada sumber "Soal baru" soal orisinal dipakai lebih dulu, lalu sisanya diisi model.

- Satu berkas JSON berisi larik soal. Nama berkas bebas; dimuat menurut abjad.
- Bentuk satu soal sama dengan `BankSoal` di `lib/types.ts`, dengan `bank: "orisinal"`, `subtemaDasar: "manual"`, dan `sumber: []`. Contohnya ada di `KUP.json`.
- `subtema` harus ada di `data/ukp-mapping.json` untuk materi yang sama. `ruleIds` harus merujuk kartu aturan yang ada.
- Soal kasus memakai `kasusId` yang sama dan teks `kasus` yang sama untuk semua anggota blok.
- `keyakinan: "Sedang"` berarti belum ditelaah penelaah materi (PRD K8). Ubah ke `"Tinggi"` setelah disahkan.

Setelah mengubah berkas, jalankan `npm run import:data -- --salin-saja` untuk menyalin gabungannya ke `public/data/ukp-orisinal.json`, lalu jalankan `npm run verify`.
