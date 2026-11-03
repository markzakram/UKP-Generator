// Adaptasi identitas soal acuan: nama badan, singkatannya, dan nama orang diganti nama fiktif secara konsisten
// di satu blok kasus. Angka, tanggal, lokasi, kunci, dan logika soal tidak berubah. Hasilnya tetap turunan
// sumber LatihUKP (asal "adaptasi"), jadi tetap butuh konfirmasi K2 untuk ekspor produksi.
import { HURUF } from './config';
import { checksumSoal } from './soal';
import type { DataUkp, Soal } from './types';
import { hash, rng } from './util';

const RE_BADAN = /\b(PT|CV|Firma|Koperasi|UD|Yayasan)\s+((?:[A-Z][A-Za-z&'-]*(?:\s+|$)){1,4})/g;
const RE_SINGKAT = /\((PT|CV)\s+([A-Z]{2,6})\)/g;
const RE_ORANG = /\b(Tn\.|Ny\.|Nn\.|Sdr\.|Sdri\.|Bapak|Ibu)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g;
// Nama institusi nyata yang tidak boleh diganti (BUMN, bursa, lembaga negara).
const NYATA = /Indonesia|Persero|Pertamina|PLN|Taspen|Asabri|Bursa|Kustodian|Telkom|BPJS|Pegadaian|Jasa Raharja|Kereta Api|Garuda|Pos\b|Bank\b/;

function teksSoal(s: Soal): string[] {
  return [s.kasus ?? '', s.soal, ...HURUF.map((h) => s.opsi[h]), s.inti, ...s.langkah, ...Object.values(s.kenapaSalah).map(String), s.catatanAturan ?? '', s.poinIngat ?? ''];
}

/** Peta nama lama → nama baru untuk satu kelompok soal (satu blok kasus atau satu soal). */
export function petaNama(soal: Soal[], data: DataUkp, seed: string): Map<string, string> {
  const r = rng(seed);
  const peta = new Map<string, string>();
  const kata = data.konteks.namaPt, orang = data.konteks.namaOrang.map((n) => n.replace(/^(Tn\.|Ny\.)\s+/, ''));
  const dipakai = new Set<string>();
  const teks = soal.flatMap(teksSoal).join('\n');
  for (const m of teks.matchAll(RE_BADAN)) {
    const nama = m[2].trim();
    const penuh = m[1] + ' ' + nama;
    if (peta.has(penuh) || NYATA.test(nama) || /^[A-Z]{2,6}$/.test(nama)) continue;
    let baru = '';
    for (let i = 0; i < 30 && (!baru || dipakai.has(baru)); i++) baru = m[1] + ' ' + r.pick(kata) + ' ' + r.pick(kata);
    dipakai.add(baru);
    peta.set(penuh, baru);
  }
  // Singkatan "(PT TPM)" mengikuti inisial nama baru.
  for (const m of teks.matchAll(RE_SINGKAT)) {
    const lama = m[1] + ' ' + m[2];
    const sebelum = teks.slice(0, m.index).match(new RegExp('\\b' + m[1] + ' ((?:[A-Z][A-Za-z&\'-]*\\s+){1,4})$'));
    const penuhLama = sebelum ? (m[1] + ' ' + sebelum[1].trim()) : '';
    const penuhBaru = peta.get(penuhLama);
    if (penuhBaru && !peta.has(lama)) peta.set(lama, m[1] + ' ' + penuhBaru.split(' ').slice(1).map((w) => w[0]).join('').toUpperCase() + (m[2].length > 3 ? 'X' : ''));
  }
  for (const m of teks.matchAll(RE_ORANG)) {
    const lama = m[1] + ' ' + m[2];
    if (peta.has(lama)) continue;
    const pilihan = orang.filter((n) => !dipakai.has(n));
    const baru = m[1] + ' ' + (pilihan.length ? r.pick(pilihan) : r.pick(orang));
    dipakai.add(baru.split(' ').slice(1).join(' '));
    peta.set(lama, baru);
  }
  return peta;
}

function ganti(t: string, peta: Map<string, string>): string {
  // Nama terpanjang lebih dulu supaya "PT Sinar Logam Morowali" tidak terganti sebagian oleh "PT Sinar".
  let hasil = t;
  for (const [lama, baru] of [...peta].sort((a, b) => b[0].length - a[0].length)) {
    hasil = hasil.replace(new RegExp(lama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', 'g'), baru);
  }
  return hasil;
}

/** Adaptasi satu kelompok soal (blok kasus utuh atau satu soal tunggal). */
export function adaptasi(soal: Soal[], data: DataUkp, seed: string): Soal[] {
  const peta = petaNama(soal, data, seed);
  return soal.map((s) => {
    const g = (t: string) => ganti(t, peta);
    const baru: Soal = {
      ...s,
      uid: 'adaptasi:' + s.sumberId + ':' + hash(seed),
      asal: 'adaptasi',
      kasus: s.kasus ? g(s.kasus) : null,
      soal: g(s.soal),
      opsi: Object.fromEntries(HURUF.map((h) => [h, g(s.opsi[h])])) as Soal['opsi'],
      inti: g(s.inti),
      langkah: s.langkah.map(g),
      kenapaSalah: Object.fromEntries(Object.entries(s.kenapaSalah).map(([h, v]) => [h, g(String(v))])),
      catatanAturan: s.catatanAturan ? g(s.catatanAturan) : null,
      poinIngat: s.poinIngat ? g(s.poinIngat) : null,
    };
    baru.checksum = checksumSoal(baru);
    return baru;
  });
}

/** Adaptasi soal pada nomor tertentu di paket; soal kasus ikut seluruh bloknya. Kembali: soal baru + jumlah yang berubah. */
export function adaptasiNomor(soalPaket: Soal[], nomor: number[], data: DataUkp, seed: string): { soal: Soal[]; jumlah: number } {
  const hasil = [...soalPaket];
  const selesai = new Set<number>();
  let jumlah = 0;
  for (const no of nomor) {
    const i = no - 1, s = hasil[i];
    if (!s || selesai.has(i) || (s.asal !== 'bank')) continue;
    const indeks = s.kasusId ? hasil.map((x, j) => (x.kasusId === s.kasusId ? j : -1)).filter((j) => j >= 0) : [i];
    const baru = adaptasi(indeks.map((j) => hasil[j]), data, seed + '|' + s.sumberId);
    indeks.forEach((j, k) => { hasil[j] = baru[k]; selesai.add(j); });
    jumlah += indeks.length;
  }
  return { soal: hasil, jumlah };
}
