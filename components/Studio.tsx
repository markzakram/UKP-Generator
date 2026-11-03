'use client';
import { useCallback, useEffect, useState } from 'react';
import { hariIni, labelTingkat, NAMA_APLIKASI, pengaturanAwal } from '@/lib/config';
import { bacaCadanganLengkap, buatCadanganLengkap, cadanganLengkapKah, rencanaGabung } from '@/lib/cadangan';
import { muatDataBrowser } from '@/lib/data';
import { buatPaket, GalatPersediaan } from '@/lib/generate';
import { rakitLatihan } from '@/lib/remedial';
import { daftarDeckMateri, daftarSesiUji, daftarWorkspace, hapusWorkspace, simpanDeckMateri, simpanSesiUji, simpanWorkspace } from '@/lib/storage';
import type { DataUkp, Kode, Pengaturan, Tingkat, Workspace } from '@/lib/types';
import { tanggal } from '@/lib/util';
import { bacaCadangan, buatCadangan, buatWorkspace } from '@/lib/workspace';
import { MIME, unduh } from '@/lib/export/unduh';
import { slug } from '@/lib/export/common';
import AturPaket from './AturPaket';
import HasilPaket from './HasilPaket';
import Pustaka from './Pustaka';
import Riwayat from './Riwayat';
import UjiPeserta from './UjiPeserta';
import TabMateri, { type FokusMateri } from './materi/TabMateri';
import { IkonLembar, Toast } from './ui';

export type Tab = 'atur' | 'hasil' | 'uji' | 'materi' | 'pustaka' | 'riwayat';
const KUNCI_PENGATURAN = 'ukp-studio-pengaturan-v1';

function bacaPengaturan(): Pengaturan {
  const awal = pengaturanAwal();
  try {
    const simpan = JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) ?? 'null') as Partial<Pengaturan> | null;
    // Tanggal acuan selalu hari ini saat aplikasi dibuka (PRD K7); pengaturan lain dipertahankan.
    return simpan ? { ...awal, ...simpan, tanggalAcuan: awal.tanggalAcuan, kuota: null } : awal;
  } catch { return awal; }
}

export default function Studio() {
  const [data, setData] = useState<DataUkp | null>(null);
  const [galatData, setGalatData] = useState('');
  const [tab, setTab] = useState<Tab>('atur');
  // Dinaikkan setelah impor cadangan lengkap supaya tab Materi memuat ulang deck dari IndexedDB.
  const [versiMateri, setVersiMateri] = useState(0);
  // Subtema yang dibuka dari saran remedial (R8); dipakai sekali saat tab Materi dimuat.
  const [fokusMateri, setFokusMateri] = useState<FokusMateri | null>(null);
  const [peng, setPengState] = useState<Pengaturan>(pengaturanAwal);
  const [ws, setWsState] = useState<Workspace | null>(null);
  const [daftar, setDaftar] = useState<Workspace[]>([]);
  const [toast, setToast] = useState<{ pesan: string; galat?: boolean } | null>(null);
  const [galatBuat, setGalatBuat] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);

  const kabar = useCallback((pesan: string, galat?: boolean) => setToast({ pesan, galat }), []);
  const tutupToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    setPengState(bacaPengaturan());
    muatDataBrowser().then(setData).catch((e: Error) => setGalatData(e.message));
    daftarWorkspace().then((w) => {
      setDaftar(w);
      if (w[0]) { setWsState(w[0]); setTab('hasil'); }
    }).catch((e: Error) => kabar(e.message, true));
  }, [kabar]);

  const setPeng = useCallback((p: Pengaturan) => {
    setPengState(p);
    try { localStorage.setItem(KUNCI_PENGATURAN, JSON.stringify({ ...p, kuota: null })); } catch { /* penyimpanan lokal opsional */ }
  }, []);

  const setWs = useCallback((w: Workspace) => {
    setWsState(w);
    setDaftar((d) => [w, ...d.filter((x) => x.id !== w.id)]);
    simpanWorkspace(w).catch((e: Error) => kabar(e.message, true));
  }, [kabar]);

  const buat = useCallback(() => {
    if (!data) return;
    try {
      const hasil = buatPaket(data, peng);
      const baru = buatWorkspace(peng, hasil.paket);
      setGalatBuat([]);
      setWs(baru);
      setTab('hasil');
      const nGeser = hasil.geser.reduce((a, g) => a + Number(g.match(/: (\d+) soal/)?.[1] ?? 0), 0);
      kabar(hasil.paket.length + ' paket × ' + peng.jumlahSoal + ' soal dibuat.' + (nGeser ? ` ${nGeser} soal diisi dari kesulitan lain karena stoknya habis: ${hasil.geser.slice(0, 3).join('; ')}${hasil.geser.length > 3 ? '; …' : ''}.` : ''));
    } catch (e) {
      if (e instanceof GalatPersediaan) setGalatBuat(e.detail);
      else setGalatBuat([(e as Error).message]);
    }
  }, [data, peng, setWs, kabar]);

  // Materi ↔ latihan (R8): paket latihan jenis subtema sebagai workspace baru; pengaturan tryout di Atur paket tidak diubah.
  const latihan = useCallback((subtema: string[], tingkat: Tingkat) => {
    if (!data) return;
    try {
      const { peng: p, hasil } = rakitLatihan(data, peng, subtema, tingkat, 'LATIHAN-' + Date.now().toString(36).toUpperCase());
      setWs(buatWorkspace(p, hasil.paket));
      setTab('hasil');
      kabar(`Paket latihan ${p.jumlahSoal} soal dibuat untuk ${subtema.length === 1 ? subtema[0].replace('::', ' · ') : subtema.length + ' subtema'} (${labelTingkat(tingkat)}).`);
    } catch (e) { kabar(e instanceof GalatPersediaan ? 'Stok soal belum cukup untuk paket latihan 5 soal: ' + e.detail.slice(0, 2).join(' ') : (e as Error).message, true); }
  }, [data, peng, setWs, kabar]);
  const bukaMateri = useCallback((kode: Kode, subtema: string, tingkat: Tingkat) => {
    setFokusMateri({ kode, subtema, tingkat });
    setVersiMateri((v) => v + 1);
    setTab('materi');
  }, []);
  const selesaiFokus = useCallback(() => setFokusMateri(null), []);

  const unduhCadangan = () => {
    if (!ws) return kabar('Belum ada paket untuk dicadangkan.', true);
    unduh(new TextEncoder().encode(JSON.stringify(buatCadangan(ws), null, 2)), 'cadangan-' + slug(ws.judul) + '.json', MIME.json);
    kabar('Cadangan diunduh.');
  };
  // Cadangan lengkap (R12): semua paket, deck materi beserta telaah, dan sesi uji peserta di browser ini.
  const unduhCadanganLengkap = async () => {
    try {
      const [workspaces, materi, sesiUji] = await Promise.all([daftarWorkspace(), daftarDeckMateri(), daftarSesiUji<{ id: string }>()]);
      const c = buatCadanganLengkap({ workspaces, materi, sesiUji }, new Date().toISOString());
      unduh(new TextEncoder().encode(JSON.stringify(c)), 'ukp-studio-cadangan-lengkap-' + hariIni() + '.json', MIME.json);
      kabar(`Cadangan lengkap diunduh: ${workspaces.length} paket, ${materi.length} deck materi, ${sesiUji.length} sesi uji.`);
    } catch (e) { kabar((e as Error).message, true); }
  };
  const imporCadangan = async (file: File) => {
    try {
      const teks = await file.text();
      if (cadanganLengkapKah(teks)) {
        const c = bacaCadanganLengkap(teks);
        const [ws0, materi0, sesi0] = await Promise.all([daftarWorkspace(), daftarDeckMateri(), daftarSesiUji<{ id: string }>()]);
        const gw = rencanaGabung(ws0, c.workspaces, (w) => w.diperbarui);
        const gm = rencanaGabung(materi0, c.materi, (d) => d.diperbarui);
        const gs = rencanaGabung(sesi0, c.sesiUji);
        await Promise.all([...gw.simpan.map(simpanWorkspace), ...gm.simpan.map(simpanDeckMateri), ...gs.simpan.map(simpanSesiUji)]);
        const daftarBaru = await daftarWorkspace();
        setDaftar(daftarBaru);
        if (!ws && daftarBaru[0]) setWsState(daftarBaru[0]);
        setVersiMateri((v) => v + 1);
        kabar(`Cadangan lengkap digabung: paket ${gw.baru} baru, ${gw.diganti} diperbarui; deck materi ${gm.baru} baru, ${gm.diganti} diperbarui; sesi uji ${gs.baru} baru. ${gw.tetap + gm.tetap + gs.tetap} data di browser ini lebih baru atau sama, jadi dibiarkan.`);
        return;
      }
      const w = bacaCadangan(teks);
      setWs(w); setTab('hasil'); kabar('Cadangan ' + w.judul + ' dipulihkan.');
    } catch (e) { kabar((e as Error).message, true); }
  };
  const hapus = async (id: string) => {
    await hapusWorkspace(id);
    const sisa = daftar.filter((w) => w.id !== id);
    setDaftar(sisa);
    if (ws?.id === id) { setWsState(sisa[0] ?? null); if (!sisa[0]) setTab('atur'); }
    kabar('Paket dihapus dari browser ini.');
  };

  const navs: { id: Tab; label: string }[] = [
    { id: 'atur', label: 'Atur paket' },
    { id: 'hasil', label: 'Hasil paket' },
    { id: 'uji', label: 'Uji peserta' },
    { id: 'materi', label: 'Materi' },
    { id: 'pustaka', label: 'Pustaka' },
    { id: 'riwayat', label: 'Riwayat' },
  ];

  return (
    <>
      <header className="topbar">
        <div className="brand"><IkonLembar />{NAMA_APLIKASI}</div>
        <nav aria-label="Navigasi utama" className="nav">
          {navs.map((n) => <button key={n.id} type="button" aria-current={tab === n.id ? 'page' : undefined} onClick={() => setTab(n.id)} disabled={(n.id === 'hasil' || n.id === 'uji') && !ws}>{n.label}</button>)}
        </nav>
        <div className="topbar-kanan">
          <span className="mono kecil redup" title="Tanggal acuan aturan">aturan per {peng.tanggalAcuan}</span>
          <div className="menu">
            <button type="button" className="btn btn-kecil" aria-expanded={menu} onClick={() => setMenu(!menu)}>Cadangan</button>
            {menu && (
              <div className="menu-isi" onMouseLeave={() => setMenu(false)}>
                <button type="button" onClick={() => { setMenu(false); unduhCadangan(); }}>Unduh cadangan paket ini</button>
                <button type="button" onClick={() => { setMenu(false); unduhCadanganLengkap(); }}>Unduh cadangan lengkap (semua paket dan materi)</button>
                <label>Impor cadangan (paket atau lengkap)<input type="file" accept="application/json,.json" className="tersembunyi" onChange={(e) => { setMenu(false); const f = e.target.files?.[0]; if (f) imporCadangan(f); e.target.value = ''; }} /></label>
              </div>
            )}
          </div>
        </div>
      </header>
      {galatData && <div className="halaman"><div className="kotak-galat">{galatData}</div></div>}
      {!data && !galatData && <div className="halaman"><p className="redup">Memuat bank soal…</p></div>}
      {data && tab === 'atur' && <AturPaket data={data} peng={peng} setPeng={setPeng} buat={buat} galat={galatBuat} kabar={kabar} />}
      {data && tab === 'hasil' && ws && <HasilPaket data={data} ws={ws} setWs={setWs} kabar={kabar} />}
      {data && tab === 'uji' && ws && <UjiPeserta data={data} ws={ws} kabar={kabar} bukaMateri={bukaMateri} latihan={latihan} />}
      {data && tab === 'materi' && <TabMateri key={versiMateri} data={data} tanggalAcuan={peng.tanggalAcuan} kabar={kabar} fokus={fokusMateri} selesaiFokus={selesaiFokus} latihan={latihan} />}
      {data && tab === 'pustaka' && <Pustaka data={data} tanggalAcuan={peng.tanggalAcuan} />}
      {data && tab === 'riwayat' && <Riwayat ws={ws} daftar={daftar} buka={(w) => { setWsState(w); setTab('hasil'); }} hapus={hapus} setWs={setWs} kabar={kabar} data={data} />}
      {toast && <Toast pesan={toast.pesan} galat={toast.galat} tutup={tutupToast} />}
      <footer className="tersembunyi">{NAMA_APLIKASI} · aturan per {tanggal(peng.tanggalAcuan)}</footer>
    </>
  );
}
