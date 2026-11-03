'use client';
import { useCallback, useEffect, useState } from 'react';
import { NAMA_APLIKASI, pengaturanAwal } from '@/lib/config';
import { muatDataBrowser } from '@/lib/data';
import { buatPaket, GalatPersediaan } from '@/lib/generate';
import { daftarWorkspace, hapusWorkspace, simpanWorkspace } from '@/lib/storage';
import type { DataUkp, Pengaturan, Workspace } from '@/lib/types';
import { tanggal } from '@/lib/util';
import { bacaCadangan, buatCadangan, buatWorkspace } from '@/lib/workspace';
import { MIME, unduh } from '@/lib/export/unduh';
import { slug } from '@/lib/export/common';
import AturPaket from './AturPaket';
import HasilPaket from './HasilPaket';
import Pustaka from './Pustaka';
import Riwayat from './Riwayat';
import UjiPeserta from './UjiPeserta';
import TabMateri from './materi/TabMateri';
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
      kabar(hasil.paket.length + ' paket × ' + peng.jumlahSoal + ' soal dibuat.');
    } catch (e) {
      if (e instanceof GalatPersediaan) setGalatBuat(e.detail);
      else setGalatBuat([(e as Error).message]);
    }
  }, [data, peng, setWs, kabar]);

  const unduhCadangan = () => {
    if (!ws) return kabar('Belum ada paket untuk dicadangkan.', true);
    unduh(new TextEncoder().encode(JSON.stringify(buatCadangan(ws), null, 2)), 'cadangan-' + slug(ws.judul) + '.json', MIME.json);
    kabar('Cadangan diunduh.');
  };
  const imporCadangan = async (file: File) => {
    try {
      const w = bacaCadangan(await file.text());
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
                <button type="button" onClick={() => { setMenu(false); unduhCadangan(); }}>Unduh cadangan JSON</button>
                <label>Impor cadangan JSON<input type="file" accept="application/json,.json" className="tersembunyi" onChange={(e) => { setMenu(false); const f = e.target.files?.[0]; if (f) imporCadangan(f); e.target.value = ''; }} /></label>
              </div>
            )}
          </div>
        </div>
      </header>
      {galatData && <div className="halaman"><div className="kotak-galat">{galatData}</div></div>}
      {!data && !galatData && <div className="halaman"><p className="redup">Memuat bank soal…</p></div>}
      {data && tab === 'atur' && <AturPaket data={data} peng={peng} setPeng={setPeng} buat={buat} galat={galatBuat} kabar={kabar} />}
      {data && tab === 'hasil' && ws && <HasilPaket data={data} ws={ws} setWs={setWs} kabar={kabar} />}
      {data && tab === 'uji' && ws && <UjiPeserta ws={ws} kabar={kabar} />}
      {data && tab === 'materi' && <TabMateri data={data} tanggalAcuan={peng.tanggalAcuan} kabar={kabar} />}
      {data && tab === 'pustaka' && <Pustaka data={data} tanggalAcuan={peng.tanggalAcuan} />}
      {data && tab === 'riwayat' && <Riwayat ws={ws} daftar={daftar} buka={(w) => { setWsState(w); setTab('hasil'); }} hapus={hapus} setWs={setWs} kabar={kabar} data={data} />}
      {toast && <Toast pesan={toast.pesan} galat={toast.galat} tutup={tutupToast} />}
      <footer className="tersembunyi">{NAMA_APLIKASI} · aturan per {tanggal(peng.tanggalAcuan)}</footer>
    </>
  );
}
