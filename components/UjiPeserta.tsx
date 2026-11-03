'use client';
import { useEffect, useMemo, useState } from 'react';
import { diujiDi, HURUF } from '@/lib/config';
import { buatBerkas } from '@/lib/export/jalankan';
import { unduh } from '@/lib/export/unduh';
import { daftarSesiUji, simpanSesiUji } from '@/lib/storage';
import { BATAS_REMEDIAL, MIN_RESPONS_REMEDIAL, saranRemedial } from '@/lib/remedial';
import type { DataUkp, Kode, Tingkat, Workspace } from '@/lib/types';
import { bacaHasilUji, statistik, type SesiUji } from '@/lib/uji';

type SesiSimpan = SesiUji & { workspaceId: string };

export default function UjiPeserta({ data, ws, kabar, bukaMateri, latihan }: {
  data: DataUkp; ws: Workspace; kabar: (p: string, g?: boolean) => void;
  bukaMateri: (kode: Kode, subtema: string, tingkat: Tingkat) => void; latihan: (subtema: string[], tingkat: Tingkat) => void;
}) {
  const [ip, setIp] = useState(0);
  const [sesi, setSesi] = useState<SesiSimpan[]>([]);
  const paket = ws.paket[Math.min(ip, ws.paket.length - 1)];
  useEffect(() => { daftarSesiUji<SesiSimpan>().then((s) => setSesi(s.filter((x) => x.workspaceId === ws.id))).catch((e: Error) => kabar(e.message, true)); }, [ws.id, kabar]);
  const stat = useMemo(() => statistik(paket, sesi), [paket, sesi]);
  const remedial = useMemo(() => saranRemedial(data, paket, stat), [data, paket, stat]);
  const tingkat = ws.pengaturan.tingkat;

  const unduhUji = async () => {
    const b = await buatBerkas({ format: 'uji-html', mode: 'naskah', paket: [paket], peng: ws.pengaturan, gabung: true });
    unduh(b.isi, b.nama, b.mime);
    kabar(b.nama + ' diunduh. Bagikan ke peserta; berkas tidak memuat kunci.');
  };
  const impor = async (files: FileList) => {
    let baru = 0, lewat = 0;
    const ada = new Set(sesi.map((s) => s.id));
    const tambah: SesiSimpan[] = [];
    for (const f of Array.from(files)) {
      try {
        for (const s of bacaHasilUji(await f.text())) {
          if (ada.has(s.id)) { lewat++; continue; }
          const simpan = { ...s, workspaceId: ws.id };
          await simpanSesiUji(simpan);
          ada.add(s.id); tambah.push(simpan); baru++;
        }
      } catch (e) { kabar(f.name + ': ' + (e as Error).message, true); }
    }
    setSesi((x) => [...x, ...tambah]);
    kabar(baru + ' sesi diimpor' + (lewat ? ', ' + lewat + ' sudah ada (tidak dihitung ulang)' : '') + '.');
  };
  const persen = (x: number | null) => (x === null ? '—' : Math.round(x * 100) + '%');

  return (
    <div className="halaman">
      <div className="judul-hal">
        <div style={{ flex: '1 1 320px' }}><h1>Uji peserta</h1><p>Bagikan berkas uji HTML (tanpa kunci), kumpulkan berkas hasil JSON dari peserta, lalu impor di sini. Respons dipadankan dengan nomor revisi soal; respons atas versi lama tidak dicampur.</p></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} className="redup">Paket
          <select value={ip} onChange={(e) => setIp(+e.target.value)} style={{ fontWeight: 600, border: '1px solid var(--garis)', borderRadius: 6, padding: '6px 10px', minHeight: 36 }}>
            {ws.paket.map((p, i) => <option key={p.id} value={i}>{p.id}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn btn-utama" onClick={unduhUji}>Unduh berkas uji HTML {paket.id}</button>
        <label className="btn">Impor hasil JSON<input type="file" accept=".json,application/json" multiple className="tersembunyi" onChange={(e) => { if (e.target.files?.length) impor(e.target.files); e.target.value = ''; }} /></label>
      </div>
      <div className="strip strip-angka">
        <div><span className="angka">{stat.sesi}</span>sesi untuk {paket.id}</div>
        <div><span className="angka">{stat.sesiLengkap}</span>sesi cocok semua soal</div>
        <div><span className="angka">{stat.rataNilai === null ? '—' : String(stat.rataNilai).replace('.', ',')}</span>rata-rata nilai (0–100)</div>
        <div><span className="angka">{stat.sesiLengkap >= 30 ? 'aktif' : 'perlu ' + (30 - stat.sesiLengkap)}</span>daya beda (≥ 30 sesi)</div>
      </div>
      <p className="kecil redup" style={{ margin: 0 }}>Label empiris (mudah ≥ 0,80; sedang 0,40–0,79; sulit &lt; 0,40) dan daya beda baru dihitung pada ≥ 30 respons. Batas ini aturan awal proyek, bukan keputusan psikometrik final.</p>
      {stat.sesi > 0 && (
        <section className="panel" aria-labelledby="uji-remedial">
          <div className="panel-kepala"><h2 id="uji-remedial" className="sub-judul" style={{ margin: 0 }}>Saran remedial</h2>
            {remedial.length > 1 && <button type="button" className="btn btn-kecil" onClick={() => latihan(remedial.slice(0, 5).map((r) => r.kode + '::' + r.subtema), tingkat)}>Latihan {Math.min(5, remedial.length)} subtema terlemah</button>}
          </div>
          <div className="panel-isi">
            <p className="kecil redup" style={{ margin: 0 }}>Subtema dengan proporsi benar di bawah {Math.round(BATAS_REMEDIAL * 100)}% (minimal {MIN_RESPONS_REMEDIAL} respons), dari soal {paket.id}. Buka deck materinya untuk diulang, atau rakit paket latihan subtema itu.</p>
            {remedial.length ? (
              <div className="kotak-tabel"><table>
                <thead><tr><th>Subtema</th><th>Diuji di</th><th className="kanan">Soal</th><th className="kanan">Respons</th><th className="kanan">p benar</th><th>Nomor soal</th><th>Aksi</th></tr></thead>
                <tbody>{remedial.map((r) => (
                  <tr key={r.kode + r.subtema}>
                    <td><b>{r.kode}</b> · {r.subtema}</td><td className="kecil">{r.tingkat ? diujiDi(r.tingkat) : '—'}</td><td className="kanan">{r.soal}</td><td className="kanan">{r.respons}</td>
                    <td className="kanan" style={{ color: 'var(--merah)', fontWeight: 600 }}>{persen(r.p)}</td><td className="mono kecil">{r.nomor.join(', ')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="btn-teks" onClick={() => bukaMateri(r.kode, r.subtema, tingkat)}>Buka materi</button> · <button type="button" className="btn-teks" onClick={() => latihan([r.kode + '::' + r.subtema], tingkat)}>Latihan</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="kecil" style={{ margin: 0 }}>Belum ada subtema di bawah batas.</p>}
          </div>
        </section>
      )}
      <div className="kotak-tabel">
        <table className="lembar" style={{ minWidth: 820 }}>
          <thead><tr><th>No</th><th className="kanan">N</th><th className="kanan">p benar</th>{HURUF.map((h) => <th key={h} className="kanan">{h}</th>)}<th className="kanan">Kosong</th><th className="kanan">Rata detik</th><th>Pengecoh jarang</th><th className="kanan">Daya beda</th><th>Label</th><th>Catatan</th></tr></thead>
          <tbody className="mono" style={{ fontSize: 13 }}>
            {stat.butir.map((b) => {
              const kunci = paket.soal[b.nomor - 1].kunci;
              return (
                <tr key={b.uid}>
                  <td style={{ fontWeight: 600 }}>{b.nomor}</td><td className="kanan">{b.n}</td><td className="kanan">{persen(b.p)}</td>
                  {HURUF.map((h) => <td key={h} className="kanan" style={h === kunci ? { fontWeight: 700, background: 'var(--amber-bg)' } : undefined}>{b.frek[h]}</td>)}
                  <td className="kanan">{b.frek.kosong}</td><td className="kanan">{b.rataDetik ?? '—'}</td>
                  <td>{b.pengecohJarang.join(', ') || '—'}</td><td className="kanan">{b.dayaBeda === null ? '—' : String(b.dayaBeda).replace('.', ',')}</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>{b.labelEmpiris ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }} className="redup">{b.tidakCocok ? b.tidakCocok + ' respons versi lama' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
