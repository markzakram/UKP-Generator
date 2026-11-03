'use client';
import { useState } from 'react';
import { LABEL_MODE, type ModeIsi } from '@/lib/export/common';
import { buatBerkas, FORMAT_SIADU, LABEL_FORMAT, MODE_FORMAT, tanpaAcuan, type FormatEkspor } from '@/lib/export/jalankan';
import { soalAcuan } from '@/lib/export/siadu';
import { unduh } from '@/lib/export/unduh';
import type { MutuPaket } from '@/lib/quality';
import type { Mapping, Paket, Workspace } from '@/lib/types';
import { Dialog } from './ui';

export type FormatDialog = 'pdf' | 'siadu-word' | 'siadu-excel' | 'lain';
type Cakupan = 'ini' | 'semua' | 'pilih';

export default function EksporDialog({ awal, ws, indeksPaket, pilih, mutu, siadu, tutup, kabar }: {
  awal: FormatDialog; ws: Workspace; indeksPaket: number; pilih: number[]; mutu: (p: Paket) => MutuPaket; siadu: Mapping['siadu']; tutup: () => void; kabar: (p: string, g?: boolean) => void;
}) {
  const daftarFormat = Object.keys(LABEL_FORMAT) as FormatEkspor[];
  const [format, setFormatState] = useState<FormatEkspor>(awal === 'lain' ? 'word' : awal);
  const [mode, setMode] = useState<ModeIsi>('lengkap');
  const [cakupan, setCakupan] = useState<Cakupan>(pilih.length ? 'pilih' : 'ini');
  const [gabung, setGabung] = useState(true);
  const [acuan, setAcuan] = useState<'setuju' | 'keluarkan' | ''>('');
  const [proses, setProses] = useState(false);
  const [pesan, setPesan] = useState('');
  const setFormat = (f: FormatEkspor) => { setFormatState(f); const m = MODE_FORMAT[f]; if (m && !m.includes(mode)) setMode(m.includes('lengkap') ? 'lengkap' : m[0]); };

  const paketDipilih = (): Paket[] => {
    const ini = ws.paket[indeksPaket];
    if (cakupan === 'ini') return [ini];
    if (cakupan === 'pilih') return [{ ...ini, soal: pilih.map((n) => ini.soal[n - 1]).filter(Boolean) }];
    return ws.paket;
  };
  const siaduDipilih = FORMAT_SIADU.includes(format);
  const dasarPaket = paketDipilih();
  const paket = siaduDipilih && acuan === 'keluarkan' ? tanpaAcuan(dasarPaket) : dasarPaket;
  const jumlahAcuan = soalAcuan(dasarPaket).length;
  const jumlah = paket.reduce((a, p) => a + p.soal.length, 0);
  const gagal = paket.reduce((a, p) => a + mutu(p).gagal, 0);
  const perluKonfirmasi = siaduDipilih && jumlahAcuan > 0 && !acuan;
  const jalan = async () => {
    setProses(true); setPesan('Menyiapkan berkas…');
    try {
      const b = await buatBerkas({ format, mode, paket, peng: ws.pengaturan, gabung, siadu, setujuAcuan: acuan === 'setuju' });
      unduh(b.isi, b.nama, b.mime);
      setPesan('Berkas ' + b.nama + ' diunduh.');
      kabar(b.nama + ' diunduh.');
    } catch (e) { setPesan((e as Error).message); }
    finally { setProses(false); }
  };
  const mode2 = MODE_FORMAT[format];
  return (
    <Dialog judul="Unduh paket" tutup={tutup} kaki={<>
      <button type="button" className="btn" onClick={tutup}>Batal</button>
      <button type="button" className="btn btn-utama" disabled={proses || gagal > 0 || !jumlah || perluKonfirmasi} onClick={jalan}>{proses ? 'Menyiapkan…' : 'Unduh'}</button>
    </>}>
      <div className="pilihan" role="radiogroup" aria-label="Format">
        <div className="label-kecil">Format</div>
        {daftarFormat.map((f) => <label key={f}><input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} />{LABEL_FORMAT[f]}</label>)}
      </div>
      {mode2 && (
        <div className="pilihan" role="radiogroup" aria-label="Isi dokumen">
          <div className="label-kecil">Isi dokumen</div>
          {mode2.map((m) => <label key={m}><input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />{LABEL_MODE[m]}</label>)}
        </div>
      )}
      <div className="pilihan" role="radiogroup" aria-label="Cakupan">
        <div className="label-kecil">Cakupan</div>
        <label><input type="radio" name="cakupan" checked={cakupan === 'ini'} onChange={() => setCakupan('ini')} />Paket yang dibuka ({ws.paket[indeksPaket].id})</label>
        {pilih.length > 0 && <label><input type="radio" name="cakupan" checked={cakupan === 'pilih'} onChange={() => setCakupan('pilih')} />Soal terpilih saja ({pilih.length} soal, nomor diurutkan ulang)</label>}
        {ws.paket.length > 1 && <label><input type="radio" name="cakupan" checked={cakupan === 'semua'} onChange={() => setCakupan('semua')} />Semua paket ({ws.paket.length})</label>}
      </div>
      {cakupan === 'semua' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={gabung} onChange={(e) => setGabung(e.target.checked)} />Satu berkas{siaduDipilih ? ' (nomor soal berlanjut)' : ' (tiap paket mulai di halaman baru)'}. Matikan untuk ZIP per paket.</label>
      )}
      {siaduDipilih && jumlahAcuan > 0 && (
        <div className="kotak-info" role="group" aria-label="Konfirmasi soal acuan sumber">
          <b>{jumlahAcuan} soal berasal dari bank acuan LatihUKP.</b>
          <p style={{ margin: '4px 0 8px', fontSize: 13 }}>Bank itu acuan internal: isinya salinan situs pihak ketiga yang belum diverifikasi dan hak pakainya untuk produksi belum jelas (PRD K2).</p>
          <div className="pilihan">
            <label><input type="radio" name="acuan" checked={acuan === 'keluarkan'} onChange={() => setAcuan('keluarkan')} />Keluarkan soal acuan, ekspor soal baru/orisinal saja ({dasarPaket.reduce((a, p) => a + p.soal.length, 0) - jumlahAcuan} soal)</label>
            <label><input type="radio" name="acuan" checked={acuan === 'setuju'} onChange={() => setAcuan('setuju')} />Saya mengerti dan tetap menyertakan soal acuan (untuk penggunaan internal)</label>
          </div>
        </div>
      )}
      <p className="kecil redup" style={{ margin: 0 }}>
        {jumlah} soal. {format === 'csv' || format === 'json' ? 'Berkas ini memuat kunci; jangan dibagikan ke peserta.' : ''}
        {siaduDipilih ? ' Category/Lesson/Chapter: ' + siadu.category + ' / ' + siadu.lesson + ' / ' + siadu.chapter + '.' : ''}
      </p>
      {gagal > 0 && <div className="kotak-galat" role="alert">{gagal} soal gagal pemeriksaan struktur atau hitung ulang dan menahan ekspor. Perbaiki atau ganti nomornya dulu.</div>}
      {pesan && <div role="status" className="kecil">{pesan}</div>}
    </Dialog>
  );
}
