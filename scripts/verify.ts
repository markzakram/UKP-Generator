// npm run verify: keutuhan data, perakit paket, ganti nomor, penyimpanan, dan CLI.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HURUF, KESULITAN, KOMPOSISI_TINGKAT, pengaturanAwal, TINGKAT, URUTAN_KODE } from '../lib/config';
import { dalamCakupan, tingkatAturan, tingkatSoal } from '../lib/data';
import { FOLDER_DATA, muatDataNode } from '../lib/data-node';
import { soalJebakan, totalBaris } from '../lib/blueprint';
import { buatPaket, GalatPersediaan, posisiKunci, tandaTeks } from '../lib/generate';
import { cekPaket } from '../lib/quality';
import { gantiNomor } from '../lib/replace';
import { dariBank, opsiAngkaUrut, terapkanUrutan } from '../lib/soal';
import type { BankSoal, Paket, Pengaturan, Soal } from '../lib/types';
import { validasiData } from '../lib/validate';
import { bacaCadangan, buatCadangan, buatWorkspace, denganPerubahan, pulihkan, suntingSoal } from '../lib/workspace';
import { bagian, cek, selesai } from './harness';
import { adaptasi, adaptasiNomor } from '../lib/adaptasi';

const data = muatDataNode();
const laporan = JSON.parse(readFileSync(path.join(FOLDER_DATA, 'import-report.json'), 'utf8'));
const bankById = new Map<string, BankSoal>([...data.bank, ...data.orisinal].map((b) => [b.id, b]));
const P = (p: Partial<Pengaturan> = {}): Pengaturan => ({ ...pengaturanAwal(), tanggalAcuan: '2026-11-02', ...p });
const lempar = (f: () => unknown) => { try { f(); return null; } catch (e) { return e; } };

bagian('Tahap 1 · Data hasil impor');
cek('2.387 soal', data.bank.length === 2387, data.bank.length);
cek('1.547 EASY + 840 HARD', data.bank.filter((s) => s.bank === 'easy').length === 1547 && data.bank.filter((s) => s.bank === 'hard').length === 840);
cek('334 kartu aturan', data.aturan.length === 334, data.aturan.length);
cek('92 kartu hafalan/rumus', data.materi.kartu.length === 92);
cek('10 topik + 1 pengantar', data.materi.topik.length === 11);
cek('laporan impor cocok dengan data', laporan.jumlah.soal === data.bank.length && laporan.jumlah.aturan === data.aturan.length);
const v = validasiData(data);
cek('tidak ada galat struktur/rujukan/subtema', v.galat.length === 0, v.galat.slice(0, 10));
cek('183 blok kasus', v.blok === 183 + new Set(data.orisinal.filter((s) => s.kasusId).map((s) => s.kasusId)).size, v.blok);
cek('461 soal kasus bank', data.bank.filter((s) => s.kasusId).length === 461);
cek('semua soal punya subtema', data.bank.every((s) => s.subtema && s.subtema !== 'Lainnya'));
cek('akurasi tebakan subtema ≥ 80%', laporan.jumlah.akurasiTebakSubtema >= 80, laporan.jumlah.akurasiTebakSubtema);
cek('178 soal rujukan hilang tercatat', laporan.rujukanHilang.length === 178, laporan.rujukanHilang.length);
cek('mapping memuat 10 materi', data.mapping.materi.length === 10);
cek('cakupan kumulatif A ⊂ B ⊂ C', dalamCakupan('A', 'B') && dalamCakupan('B', 'C') && !dalamCakupan('C', 'B') && !dalamCakupan('B', 'A'));
const perTingkat = Object.fromEntries(TINGKAT.map((t) => [t, data.bank.filter((s) => dalamCakupan(tingkatSoal(s, data.mapping), t)).length]));
cek('stok kumulatif A=1170, B=1884, C=2387', perTingkat.A === 1170 && perTingkat.B === 1884 && perTingkat.C === 2387, perTingkat);
const semuaSubtema = data.mapping.materi.flatMap((m) => m.subtema.map((s) => m.kode + '::' + s));
const perTingkatSubtema = Object.fromEntries(TINGKAT.map((t) => [t, semuaSubtema.filter((k) => data.mapping.subtema[k] === t).length]));
cek('tingkat subtema: 69 subtema terpetakan, A=33, B=23, C=13', semuaSubtema.length === 69 && semuaSubtema.every((k) => data.mapping.subtema[k]) && perTingkatSubtema.A === 33 && perTingkatSubtema.B === 23 && perTingkatSubtema.C === 13, perTingkatSubtema);
cek('tingkat subtema mengikuti cakupan (KUP Sanksi A, PBB B, INT C)', data.mapping.subtema['KUP::Sanksi administrasi'] === 'A' && data.mapping.subtema['PBB::Objek & subjek PBB-P5L'] === 'B' && data.mapping.subtema['INT::P3B: residensi & tie breaker'] === 'C');
cek('tingkat soal = yang lebih tinggi antara tingkat subtema dan label', data.bank.every((s) => { const sub = data.mapping.subtema[s.kode + '::' + s.subtema]; const t = tingkatSoal(s, data.mapping); return t === (TINGKAT.indexOf(sub) > TINGKAT.indexOf(s.tingkat) ? sub : s.tingkat); }));
const pendalaman = data.bank.filter((s) => s.kode === 'PP' && s.subtema === 'PPh Pasal 22 & PPh Pasal 23' && s.tingkat === 'B');
cek('soal pendalaman (PPh 22/23 berlabel B) tidak masuk cakupan A', pendalaman.length === 81 && pendalaman.every((s) => !dalamCakupan(tingkatSoal(s, data.mapping), 'A')), pendalaman.length);
const ov = { ...data.mapping, override: { 'KUP::Sanksi administrasi': 'C' as const } };
const contoh = data.bank.find((s) => s.kode === 'KUP' && s.subtema === 'Sanksi administrasi')!;
cek('override subtema mengubah tingkat', tingkatSoal(contoh, ov) === 'C' && tingkatSoal(contoh, data.mapping) === contoh.tingkat);
cek('aturan ikut tingkat subtema', data.aturan.every((a) => tingkatAturan(a, data.mapping) === data.mapping.subtema[a.kode + '::' + a.subtema]));
cek('komposisi kesulitan bawaan per tingkat (A ringan → C berat, total 100)', TINGKAT.every((t) => KESULITAN.reduce((a, d) => a + KOMPOSISI_TINGKAT[t][d], 0) === 100)
  && KOMPOSISI_TINGKAT.A.mudah > KOMPOSISI_TINGKAT.C.mudah && KOMPOSISI_TINGKAT.C.sulit > KOMPOSISI_TINGKAT.A.sulit
  && JSON.stringify(pengaturanAwal().komposisi) === JSON.stringify(KOMPOSISI_TINGKAT.C));
cek('blok kasus: tingkatBlok = tingkat tertinggi anggota', data.bank.filter((s) => s.kasusId).every((s) => s.tingkatBlok && s.tingkatBlok >= s.tingkat));
cek('opsi angka terdeteksi (783)', data.bank.filter((s) => s.opsiAngka).length === 783);

bagian('Tahap 2 · Perakit paket');
const sama = (a: Paket[], b: Paket[]) => JSON.stringify(a.map((p) => p.soal.map((s) => [s.uid, s.opsi, s.kunci]))) === JSON.stringify(b.map((p) => p.soal.map((s) => [s.uid, s.opsi, s.kunci])));
const h1 = buatPaket(data, P({ jumlahPaket: 3, sumber: 'bank' }));
cek('seed sama → paket identik', sama(h1.paket, buatPaket(data, P({ jumlahPaket: 3, sumber: 'bank' })).paket));
cek('seed beda → paket beda', !sama(h1.paket, buatPaket(data, P({ jumlahPaket: 3, sumber: 'bank', seed: 'LAIN-01' })).paket));
cek('3 paket × 100 soal', h1.paket.length === 3 && h1.paket.every((p) => p.soal.length === 100));
cek('kuota total = 100', h1.baris.reduce((a, b) => a + totalBaris(b), 0) === 100);
for (const p of h1.paket) {
  const perKode = Object.fromEntries(URUTAN_KODE.map((k) => [k, p.soal.filter((s) => s.kode === k).length]));
  cek(p.id + ': jumlah per materi sesuai kuota', h1.baris.every((b) => perKode[b.kode] === totalBaris(b)), { perKode, baris: h1.baris });
  const perSel = h1.baris.every((b) => (['mudah', 'sedang', 'sulit'] as const).every((d) => p.soal.filter((s) => s.kode === b.kode && s.kesulitan === d).length === b[d]));
  cek(p.id + ': jumlah per materi × kesulitan sesuai kuota', perSel);
  const m = cekPaket(p, { data, tanggalAcuan: '2026-11-02' }, h1.paket);
  cek(p.id + ': tidak ada soal gagal cek mutu', m.gagal === 0, [...m.perSoal.entries()].filter(([, c]) => c.some((x) => x.level === 'gagal')).slice(0, 3));
  cek(p.id + ': blok kasus utuh dan berurutan', !m.paket.some((c) => c.id.startsWith('blok-')), m.paket.filter((c) => c.id.startsWith('blok-')));
  const k = posisiKunci(p.soal);
  cek(p.id + ': posisi kunci merata (23–27)', HURUF.every((h) => k[h] >= 23 && k[h] <= 27), k);
  cek(p.id + ': dikelompokkan per materi sesuai urutan', p.soal.every((s, i) => i === 0 || URUTAN_KODE.indexOf(p.soal[i - 1].kode) <= URUTAN_KODE.indexOf(s.kode)));
}
const semuaId = h1.paket.flatMap((p) => p.soal.map((s) => s.sumberId));
cek('tidak ada soal kembar antarpaket', new Set(semuaId).size === semuaId.length);
const semuaTeks = h1.paket.flatMap((p) => p.soal.map(tandaTeks));
cek('tidak ada teks soal kembar antarpaket', new Set(semuaTeks).size === semuaTeks.length);

// Pemetaan opsi: teks kunci, alasan per opsi, dan penyebab salah tetap menempel pada opsi aslinya.
let salahPeta = 0, angkaTakUrut = 0, tetapBerubah = 0, diacak = 0;
const tanpaRujukan = (t: string) => t.replace(/\b([Oo]psi|[Pp]ilihan|[Jj]awaban)\s+[A-D]\b/g, '$1 _');
for (const s of h1.paket.flatMap((p) => p.soal)) {
  const b = bankById.get(s.sumberId!)!;
  if (s.opsi[s.kunci] !== b.opsi[b.kunci]) salahPeta++;
  HURUF.forEach((h, i) => {
    const asal = s.urutanAsal[i];
    if (s.opsi[h] !== b.opsi[asal]) salahPeta++;
    if ((s.kenapaSalah[h] ?? '') && tanpaRujukan(s.kenapaSalah[h]!) !== tanpaRujukan(b.kenapaSalah[asal] ?? '')) salahPeta++;
    if ((s.penyebabSalah[h] ?? '') !== (b.penyebabSalah[asal] ?? '')) salahPeta++;
  });
  if (s.opsiAngka && !opsiAngkaUrut(s)) angkaTakUrut++;
  if (s.posisiTetap && s.urutanAsal.join('') !== 'ABCD') tetapBerubah++;
  if (s.urutanAsal.join('') !== 'ABCD') diacak++;
}
cek('opsi, kunci, alasan, dan penyebab salah terpetakan benar', salahPeta === 0, salahPeta);
cek('opsi angka selalu urut naik', angkaTakUrut === 0, angkaTakUrut);
cek('soal berposisi tetap tidak diacak', tetapBerubah === 0);
cek('sebagian besar soal lain diacak', diacak > 150, diacak);
const rujuk = data.bank.find((b) => /\bOpsi [A-D]\b/.test(b.langkah.join(' ')) && !b.posisiTetap && !b.opsiAngka)!;
if (rujuk) {

  const t = terapkanUrutan(dariBank(rujuk, data), ['D', 'C', 'B', 'A']);
  const asli = rujuk.langkah.join(' ').match(/\bOpsi ([A-D])\b/)![1];
  const baru = ({ A: 'D', B: 'C', C: 'B', D: 'A' } as Record<string, string>)[asli];
  cek('rujukan "Opsi X" di pembahasan ikut dipetakan (' + rujuk.id + ')', t.langkah.join(' ').includes('Opsi ' + baru));
}

bagian('Tahap 2 · Cakupan tingkat dan jenis paket');
for (const t of TINGKAT) {
  const h = buatPaket(data, P({ tingkat: t, jumlahPaket: 2, sumber: 'bank' }));
  cek('Tingkat ' + t + ': semua soal dalam cakupan', h.paket.every((p) => p.soal.every((s) => dalamCakupan(s.tingkat, t) && (!s.kasusId || dalamCakupan(bankById.get(s.sumberId!)!.tingkatBlok ?? s.tingkat, t)))));
  cek('Tingkat ' + t + ': subtema paket hanya dari cakupan tingkat ini', h.paket.every((p) => p.soal.every((s) => dalamCakupan(data.mapping.subtema[s.kode + '::' + s.subtema], t))));
  for (const sumber of ['bank', 'campuran'] as const) {
    const hb = lempar(() => buatPaket(data, P({ tingkat: t, sumber, jumlahPaket: 5, komposisi: { ...KOMPOSISI_TINGKAT[t] } })));
    cek('Tingkat ' + t + ' · ' + sumber + ': 5 paket × 100 soal dengan komposisi bawaan tingkat', !(hb instanceof Error), (hb as Error)?.message);
  }
}
const subA = new Set(semuaSubtema.filter((k) => data.mapping.subtema[k] === 'A'));
const hA = buatPaket(data, P({ tingkat: 'A', jumlahPaket: 3, sumber: 'campuran', komposisi: { ...KOMPOSISI_TINGKAT.A } }));
cek('Tingkat A: tidak ada materi PBB, AKT, BDN, BTI, INT', hA.paket.every((p) => p.soal.every((s) => subA.has(s.kode + '::' + s.subtema))));
const hm = buatPaket(data, P({ jenis: 'materi', materi: ['PPN', 'KUP'], jumlahSoal: 40, sumber: 'bank' }));
cek('per materi: hanya PPN dan KUP', hm.paket[0].soal.every((s) => s.kode === 'PPN' || s.kode === 'KUP') && hm.paket[0].soal.length === 40);
const subtemaUji = ['PPN::Faktur Pajak & nota retur', 'KUP::Sanksi administrasi'];
const hs = buatPaket(data, P({ jenis: 'subtema', subtema: subtemaUji, materi: ['KUP', 'PPN'], jumlahSoal: 20, sumber: 'bank' }));
cek('per subtema: hanya subtema terpilih', hs.paket[0].soal.every((s) => subtemaUji.includes(s.kode + '::' + s.subtema)) && hs.paket[0].soal.length === 20);
const hj = buatPaket(data, P({ jenis: 'jebakan', jumlahSoal: 50, sumber: 'bank' }));
cek('drill jebakan: hanya soal berpengecoh ketentuan lama', hj.paket[0].soal.every((s) => soalJebakan(bankById.get(s.sumberId!)!)));
const ha = buatPaket(data, P({ urutan: 'acak', sumber: 'bank' }));
const blokUtuh = cekPaket(ha.paket[0], { data, tanggalAcuan: '2026-11-02' }).paket.every((c) => !c.id.startsWith('blok-'));
cek('urutan acak tetap menjaga blok kasus utuh', blokUtuh);
const kasusAktual = h1.paket[0].soal.filter((s) => s.kasusId).length, kasusTarget = h1.baris.reduce((a, b) => a + b.kasus, 0);
cek('soal kasus mendekati target (selisih ≤ 4)', Math.abs(kasusAktual - kasusTarget) <= 4, { kasusAktual, kasusTarget });

bagian('Tahap 2 · Batas dan stok');
const e30 = lempar(() => buatPaket(data, P({ jumlahPaket: 30, sumber: 'bank' })));
cek('30 paket tanpa kembar ditolak dengan GalatPersediaan', e30 instanceof GalatPersediaan && /cukup untuk \d+ dari 100/.test((e30 as Error).message), (e30 as Error)?.message);
cek('30 paket boleh kembar berhasil', !lempar(() => buatPaket(data, P({ jumlahPaket: 30, larangKembar: false, sumber: 'bank' }))));
cek('51 paket ditolak (batas 50)', lempar(() => buatPaket(data, P({ jumlahPaket: 51 }))) instanceof GalatPersediaan);
cek('201 soal ditolak (batas 200)', lempar(() => buatPaket(data, P({ jumlahSoal: 201 }))) instanceof GalatPersediaan);
cek('subtema kosong ditolak', lempar(() => buatPaket(data, P({ jenis: 'subtema', subtema: [] }))) instanceof GalatPersediaan);
const kuotaTangan = h1.baris.map((b) => (b.kode === 'BM' ? { ...b, sulit: 60 } : b));
const eKuota = lempar(() => buatPaket(data, P({ kuota: kuotaTangan, jumlahSoal: kuotaTangan.reduce((a, b) => a + totalBaris(b), 0) })));
cek('kuota tangan melebihi stok ditolak dengan angka', eKuota instanceof GalatPersediaan && /BM · sulit: butuh \d+/.test((eKuota as Error).message), (eKuota as Error)?.message);
const t0 = Date.now();
buatPaket(data, P({ jumlahPaket: 10, sumber: 'bank' }));
const durasi = Date.now() - t0;
cek('10 paket × 100 soal < 15 detik', durasi < 15000, durasi + ' ms');

bagian('Tahap 2 · Ganti nomor');
const peng = P({ jumlahPaket: 3, sumber: 'bank' });
const nomorTunggal = h1.paket[0].soal.map((s, i) => (s.kasusId ? 0 : i + 1)).filter(Boolean).slice(0, 6);
const g = gantiNomor(data, peng, h1.paket, 0, nomorTunggal, 'uji-ganti');
const lama = h1.paket[0].soal, baru = g.paket[0].soal;
cek('6 nomor tunggal diganti', g.diganti === 6, g);
cek('jumlah dan nomor soal tetap', baru.length === lama.length && lama.every((s, i) => nomorTunggal.includes(i + 1) || s.uid === baru[i].uid));
cek('pengganti dari materi, subtema, kesulitan yang sama', nomorTunggal.every((n) => baru[n - 1].kode === lama[n - 1].kode && baru[n - 1].subtema === lama[n - 1].subtema && baru[n - 1].kesulitan === lama[n - 1].kesulitan && baru[n - 1].uid !== lama[n - 1].uid));
cek('posisi kunci dipertahankan (kecuali opsi angka/posisi tetap)', nomorTunggal.every((n) => baru[n - 1].opsiAngka || baru[n - 1].posisiTetap || baru[n - 1].kunci === lama[n - 1].kunci));
const semuaSetelah = g.paket.flatMap((p) => p.soal.map((s) => s.sumberId));
cek('tidak ada kembar di semua paket setelah ganti', new Set(semuaSetelah).size === semuaSetelah.length);
cek('paket lain tidak berubah', g.paket[1] === h1.paket[1] && g.paket[2] === h1.paket[2]);
const iKasus = lama.findIndex((s) => s.kasusId);
const gk = gantiNomor(data, peng, h1.paket, 0, [iKasus + 1], 'uji-ganti-kasus');
const blokLama = lama.filter((s) => s.kasusId === lama[iKasus].kasusId).length;
cek('soal kasus: seluruh blok diganti', gk.diganti === blokLama && gk.paket[0].soal[iKasus].kasusId !== lama[iKasus].kasusId, gk.ringkasan);
cek('blok pengganti utuh berurutan', cekPaket(gk.paket[0], { data, tanggalAcuan: '2026-11-02' }, gk.paket).paket.every((c) => !c.id.startsWith('blok-')));
// Stok habis: subtema sempit, semua soalnya sudah dipakai.
const kecil = buatPaket(data, P({ jenis: 'subtema', subtema: ['OP::NPWP & pendaftaran'], materi: ['OP'], jumlahSoal: 2, jumlahPaket: 1, sumber: 'bank' }));
const gHabis = gantiNomor(data, { ...peng, jenis: 'subtema', subtema: ['OP::NPWP & pendaftaran'], materi: ['OP'] }, kecil.paket, 0, [1, 2], 'uji-habis');
cek('stok habis dilaporkan, soal semula dipertahankan', gHabis.gagal.length === 2 && gHabis.diganti === 0 && /habis/.test(gHabis.gagal[0].alasan), gHabis);

bagian('Tahap 2 · Workspace, riwayat, cadangan');
let ws = buatWorkspace(peng, h1.paket);
ws = denganPerubahan(ws, g.paket, 'Ganti 6 nomor');
cek('perubahan menyimpan snapshot', ws.riwayat.length === 1 && ws.riwayat[0].paket === h1.paket);
const s0: Soal = ws.paket[0].soal[0];
const ws2 = suntingSoal(ws, 0, s0.uid, { soal: s0.soal + ' (disunting)' });
const s1 = ws2.paket[0].soal[0];
cek('sunting menaikkan revisi dan checksum berubah', s1.revisi === s0.revisi + 1 && s1.disunting && s1.checksum !== s0.checksum);
const ws3 = pulihkan(ws2, ws2.riwayat[0].id);
cek('pulihkan membuat versi baru', ws3.paket[0].soal[0].soal === s0.soal && ws3.riwayat.length === ws2.riwayat.length + 1);
let wsBanyak = ws;
for (let i = 0; i < 25; i++) wsBanyak = denganPerubahan(wsBanyak, wsBanyak.paket, 'uji ' + i);
cek('riwayat dibatasi 20 snapshot', wsBanyak.riwayat.length === 20);
const pulih = bacaCadangan(JSON.stringify(buatCadangan(ws2)));
cek('cadangan JSON pulih utuh', JSON.stringify(pulih.paket) === JSON.stringify(ws2.paket) && pulih.id === ws2.id);
const rusak = JSON.parse(JSON.stringify(buatCadangan(ws2)));
rusak.workspace.paket[0].soal[3].kunci = 'E';
cek('cadangan rusak ditolak', lempar(() => bacaCadangan(JSON.stringify(rusak))) instanceof Error);
cek('berkas bukan cadangan ditolak', lempar(() => bacaCadangan('{"a":1}')) instanceof Error && lempar(() => bacaCadangan('bukan json')) instanceof Error);

bagian('Tahap 5 · Bank orisinal, adaptasi, drill jebakan');
cek('bank orisinal termuat (10 soal)', data.orisinal.length === 10, data.orisinal.length);
cek('bank orisinal valid (struktur, subtema, rujukan)', validasiData(data).galat.filter((g) => g.startsWith('O-')).length === 0);
cek('public/data/ukp-orisinal.json sama dengan data/ukp-kasus', JSON.stringify(JSON.parse(readFileSync('public/data/ukp-orisinal.json', 'utf8'))) === JSON.stringify(data.orisinal));
const hBaru = buatPaket(data, P({ sumber: 'baru', jenis: 'materi', materi: ['KUP', 'PPN', 'OP', 'PP', 'BM'], jumlahSoal: 40, jumlahPaket: 1 }));
cek('sumber "baru": hanya model atau bank orisinal', hBaru.paket[0].soal.every((s) => s.asal === 'model' || s.asal === 'orisinal'));
const hOri = buatPaket(data, P({ sumber: 'baru', jenis: 'materi', materi: ['PBB', 'AKT'], jumlahSoal: 12, jumlahPaket: 1 }));
cek('sumber "baru" materi tanpa banyak model memakai orisinal', hOri.paket[0].soal.some((s) => s.asal === 'orisinal'), hOri.paket[0].soal.map((s) => s.asal));

const blokAkt = data.bank.filter((b) => b.kasusId === 'P1-AKT-K1').map((b) => dariBank(b, data));
const ad = adaptasi(blokAkt, data, 'verify');
cek('adaptasi: nama badan diganti di seluruh blok', ad.every((s) => !/Teknik Prima Morowali|PT TPM\b|Sinar Logam Morowali|PT SLM\b/.test([s.kasus, s.soal, ...Object.values(s.opsi), s.inti, ...s.langkah].join(' '))));
const akronim = ad[0].kasus!.match(/\((PT [A-Z]+)\)/)?.[1];
cek('adaptasi: singkatan baru konsisten di kasus, opsi, dan pembahasan', !!akronim && ad[1].inti.includes(akronim!), { akronim, inti: ad[1].inti.slice(0, 120) });
cek('adaptasi: angka, kunci, dan urutan opsi tetap', ad.every((s, i) => s.kunci === blokAkt[i].kunci && HURUF.every((h) => (s.opsi[h].match(/[\d.]+/g) ?? []).join() === (blokAkt[i].opsi[h].match(/[\d.]+/g) ?? []).join())));
cek('adaptasi: asal "adaptasi", sumber tetap, checksum baru', ad.every((s, i) => s.asal === 'adaptasi' && s.sumberId === blokAkt[i].sumberId && s.checksum !== blokAkt[i].checksum));
const nyata = { ...dariBank(data.bank[0], data), soal: 'PT Pertamina (Persero) dan PT Bursa Efek Indonesia menerima pembayaran dari PT Contoh Abadi Jaya ...' };
const adN = adaptasi([nyata], data, 'nyata')[0].soal;
cek('adaptasi: institusi nyata tidak diganti', adN.includes('PT Pertamina (Persero)') && adN.includes('PT Bursa Efek Indonesia') && !adN.includes('PT Contoh Abadi Jaya'), adN);
const pk = h1.paket[0];
const iK = pk.soal.findIndex((s) => s.kasusId && s.asal === 'bank');
const an = adaptasiNomor(pk.soal, [iK + 1], data, 'nomor');
cek('adaptasiNomor: soal kasus mengadaptasi seluruh blok', an.jumlah === pk.soal.filter((s) => s.kasusId === pk.soal[iK].kasusId).length && an.soal.filter((s) => s.kasusId === pk.soal[iK].kasusId).every((s) => s.asal === 'adaptasi'));
cek('adaptasi tetap lolos cek mutu (tanpa gagal, blok utuh)', cekPaket({ ...pk, soal: an.soal }, { data, tanggalAcuan: '2026-11-02' }, [{ ...pk, soal: an.soal }]).gagal === 0);
const poolJebakan = data.bank.filter((b) => soalJebakan(b)).length;
cek('drill jebakan: pool ≥ 300 soal', poolJebakan >= 300, poolJebakan);

bagian('Tahap 2 · CLI');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'ukp-cli-'));
const tsx = path.join('node_modules', 'tsx', 'dist', 'cli.mjs');
const jalanCli = (argumen: string[]) => {
  try { return { kode: 0, out: execFileSync(process.execPath, [tsx, 'scripts/generate.ts', ...argumen], { encoding: 'utf8', stdio: 'pipe' }) }; }
  catch (e) { const x = e as { status: number; stdout: string; stderr: string }; return { kode: x.status, out: x.stdout + x.stderr }; }
};
const cli = jalanCli(['--tingkat', 'B', '--soal', '30', '--paket', '2', '--sumber', 'bank', '--format', 'json,pdf,docx,csv', '--out', tmp]);
cek('CLI berhasil dan mencetak RINGKASAN', cli.kode === 0 && /^RINGKASAN -> 2 paket × 30 soal/m.test(cli.out), cli.out);
cek('CLI menulis semua berkas', ['validasi.json', 'paket.json'].every((f) => existsSync(path.join(tmp, f))) && (cli.out.match(/^BERKAS -> /gm) ?? []).length === 5, cli.out);
const cliGagal = jalanCli(['--paket', '40', '--sumber', 'bank', '--out', tmp]);
cek('CLI gagal dengan Error: Persediaan dan kode keluar 1', cliGagal.kode === 1 && /Error: Persediaan/.test(cliGagal.out), cliGagal.out);
const cliSalah = jalanCli(['--tingkat', 'D']);
cek('CLI menolak opsi tidak valid', cliSalah.kode === 1 && /Error: --tingkat/.test(cliSalah.out));
const bantuan = jalanCli(['--help']).out;
const office = JSON.parse(readFileSync('agent-office.json', 'utf8'));
const opsiOffice = JSON.stringify(office.pekerjaan.find((p: { id: string }) => p.id === 'buatpaket').perintah).match(/--[a-z-]+/g) ?? [];
cek('semua opsi agent-office.json ada di --help', opsiOffice.every((o: string) => bantuan.includes(o)), opsiOffice.filter((o: string) => !bantuan.includes(o)));
const formatOffice = office.pekerjaan.find((p: { id: string }) => p.id === 'buatpaket').parameter.format.pola.match(/[a-z-]+/g).filter((x: string) => x.length > 2);
cek('semua format di agent-office.json dikenal CLI', formatOffice.every((f: string) => bantuan.includes(f)), formatOffice.filter((f: string) => !bantuan.includes(f)));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const perintahOffice = office.pekerjaan.flatMap((p: { perintah: unknown[]; lanjutan?: { perintah: unknown[] }[] }) => [p.perintah, ...(p.lanjutan ?? []).map((l) => l.perintah)]).map((x: unknown[]) => x[2]).filter((x: unknown) => typeof x === 'string');
cek('semua script agent-office.json ada di package.json', perintahOffice.every((s: string) => pkg.scripts[s]), perintahOffice.filter((s: string) => !pkg.scripts[s]));

selesai('verify');
