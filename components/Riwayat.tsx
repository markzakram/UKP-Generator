'use client';
import type { DataUkp, Workspace } from '@/lib/types';
import { pulihkan } from '@/lib/workspace';

export default function Riwayat({ ws, daftar, buka, hapus, setWs, kabar }: {
  ws: Workspace | null; daftar: Workspace[]; buka: (w: Workspace) => void; hapus: (id: string) => void; setWs: (w: Workspace) => void; kabar: (p: string, g?: boolean) => void; data: DataUkp;
}) {
  const waktu = (t: string) => new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="halaman">
      <div className="judul-hal"><div><h1>Riwayat</h1><p>Paket tersimpan di browser ini (IndexedDB). Unduh cadangan JSON sebelum membersihkan data browser atau pindah perangkat.</p></div></div>
      <section className="kotak-tabel" aria-label="Paket tersimpan">
        <table className="lembar">
          <thead><tr><th>Judul</th><th>Tingkat</th><th>Paket</th><th>Diperbarui</th><th>Versi</th><th /></tr></thead>
          <tbody>
            {daftar.length === 0 && <tr><td colSpan={6} className="redup">Belum ada paket.</td></tr>}
            {daftar.map((w) => (
              <tr key={w.id} className={w.id === ws?.id ? 'pilih' : ''}>
                <td><b>{w.judul}</b></td>
                <td className="mono">{w.pengaturan.tingkat}</td>
                <td className="mono">{w.paket.length} × {w.paket[0]?.soal.length ?? 0}</td>
                <td>{waktu(w.diperbarui)}</td>
                <td className="mono">{w.riwayat.length + 1}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-kecil" onClick={() => buka(w)}>Buka</button>{' '}
                  <button type="button" className="btn btn-kecil" onClick={() => { if (window.confirm('Hapus "' + w.judul + '" dari browser ini? Unduh cadangan dulu bila masih diperlukan.')) hapus(w.id); }}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {ws && (
        <section className="kotak-tabel" aria-label="Versi paket yang dibuka">
          <table className="lembar">
            <thead><tr><th colSpan={3}>Versi sebelumnya dari “{ws.judul}” (maks. 20)</th></tr></thead>
            <tbody>
              {ws.riwayat.length === 0 && <tr><td colSpan={3} className="redup">Belum ada perubahan setelah paket dibuat.</td></tr>}
              {ws.riwayat.map((s) => (
                <tr key={s.id}>
                  <td>{waktu(s.waktu)}</td>
                  <td>Sebelum: {s.keterangan}</td>
                  <td><button type="button" className="btn btn-kecil" onClick={() => { setWs(pulihkan(ws, s.id)); kabar('Versi dipulihkan sebagai versi baru.'); }}>Pulihkan</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
