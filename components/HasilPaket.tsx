'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HURUF } from '@/lib/config';
import { posisiKunci } from '@/lib/generate';
import { cekPaket, levelSoal } from '@/lib/quality';
import { gantiNomor } from '@/lib/replace';
import { teksSalin } from '@/lib/salin';
import type { DataUkp, Soal, Workspace } from '@/lib/types';
import { denganPerubahan, gantiSoal } from '@/lib/workspace';
import { adaptasiNomor } from '@/lib/adaptasi';
import DetailSoal from './DetailSoal';
import EksporDialog, { type FormatDialog } from './EksporDialog';

type Filter = 'semua' | 'catatan' | 'gagal' | 'baru' | 'kasus';

export default function HasilPaket({ data, ws, setWs, kabar }: { data: DataUkp; ws: Workspace; setWs: (w: Workspace) => void; kabar: (p: string, g?: boolean) => void }) {
  const [ip, setIp] = useState(0);
  const [cari, setCari] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [peserta, setPeserta] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [ekspor, setEksporState] = useState<FormatDialog | null>(null);
  const [nomorEkspor, setNomorEkspor] = useState<number[]>([]);
  const setEkspor = (f: FormatDialog | null, nomor?: number[]) => { setNomorEkspor(nomor ?? [...pilih].sort((a, b) => a - b)); setEksporState(f); };
  const salinTerpilih = async () => {
    const teks = [...pilih].sort((a, b) => a - b).map((n) => teksSalin(paket.soal[n - 1], n, !peserta, true)).join('\n\n');
    try { await navigator.clipboard.writeText(teks); kabar(pilih.size + ' soal disalin' + (peserta ? ' tanpa kunci.' : ' beserta kunci dan pembahasan.')); }
    catch { kabar('Browser menolak akses clipboard. Gunakan ekspor PDF/Word.', true); }
  };
  const paket = ws.paket[Math.min(ip, ws.paket.length - 1)];
  const peng = ws.pengaturan;
  const mutu = useMemo(() => cekPaket(paket, { data, tanggalAcuan: peng.tanggalAcuan }, ws.paket, peng.larangKembar), [paket, data, peng.tanggalAcuan, peng.larangKembar, ws.paket]);
  useEffect(() => { setAktif(0); setPilih(new Set()); }, [ip, ws.id]);

  const status = (s: Soal) => levelSoal(mutu.perSoal.get(s.uid) ?? []);
  const indeks = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return paket.soal.map((s, i) => i).filter((i) => {
      const s = paket.soal[i];
      if (filter === 'catatan' && status(s) !== 'catatan') return false;
      if (filter === 'gagal' && status(s) !== 'gagal') return false;
      if (filter === 'baru' && s.asal !== 'model') return false;
      if (filter === 'kasus' && !s.kasusId) return false;
      if (!q) return true;
      if (/^\d+$/.test(q)) return String(i + 1) === q;
      return (s.kode + ' ' + s.subtema + ' ' + s.soal + ' ' + (s.kasus ?? '')).toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paket, cari, filter, mutu]);

  // Pintasan J/K: pindah soal dalam hasil filter; tidak aktif saat mengetik atau dialog terbuka.
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (ekspor || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(t.tagName) || t.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k !== 'j' && k !== 'k') return;
      const pos = indeks.indexOf(aktif);
      const next = indeks[Math.max(0, Math.min(indeks.length - 1, (pos < 0 ? 0 : pos) + (k === 'j' ? 1 : -1)))];
      if (next !== undefined) { setAktif(next); document.getElementById('baris-' + next)?.scrollIntoView({ block: 'nearest' }); }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [indeks, aktif, ekspor]);

  const ganti = useCallback((nomor: number[]) => {
    const h = gantiNomor(data, peng, ws.paket, ip, nomor, peng.seed + '|ganti|' + Date.now());
    if (h.diganti) setWs(denganPerubahan(ws, h.paket, 'Ganti ' + h.diganti + ' nomor di ' + paket.id));
    kabar(h.ringkasan + (h.gagal.length ? ': ' + h.gagal.map((g) => 'no ' + g.nomor + ' ' + g.alasan).join('; ') : '.'), !h.diganti);
    setPilih(new Set());
  }, [data, peng, ws, ip, paket.id, setWs, kabar]);

  // Adaptasi identitas (nama badan/orang) soal acuan; soal kasus ikut seluruh bloknya.
  const adaptasiSoal = (nomor: number[]) => {
    const h = adaptasiNomor(paket.soal, nomor, data, peng.seed + '|adaptasi|' + ws.riwayat.length);
    if (!h.jumlah) return kabar('Tidak ada soal acuan sumber pada pilihan ini.', true);
    setWs(gantiSoal(ws, ip, h.soal, 'Adaptasi identitas ' + h.jumlah + ' soal'));
    kabar(h.jumlah + ' soal diadaptasi (nama badan/orang diganti). Tetap berstatus turunan sumber untuk K2.');
  };
  const kunci = posisiKunci(paket.soal);
  const baru = paket.soal.filter((s) => s.asal === 'model').length;
  const kasus = paket.soal.filter((s) => s.kasusId).length;
  const s = paket.soal[aktif];
  const isiFilter: [Filter, string][] = [['semua', 'Semua ' + paket.soal.length], ['catatan', 'Ada catatan ' + mutu.catatan], ['gagal', 'Menahan ekspor ' + mutu.gagal], ['baru', 'Soal baru ' + baru], ['kasus', 'Kasus ' + kasus]];

  return (
    <>
      <div className="halaman">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <h1 className="mono" style={{ margin: '0 12px 0 0', fontSize: 18 }}>{peng.seed}</h1>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} className="redup">Paket
            <select value={ip} onChange={(e) => setIp(+e.target.value)} style={{ fontWeight: 600, border: '1px solid var(--garis)', borderRadius: 6, padding: '6px 10px', minHeight: 36 }}>
              {ws.paket.map((p, i) => <option key={p.id} value={i}>{i + 1} dari {ws.paket.length}</option>)}
            </select>
          </label>
          <label style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} className="redup">Cari
            <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="nomor, materi, atau teks soal" style={{ flex: 1, border: '1px solid var(--garis)', borderRadius: 6, padding: '6px 10px', minHeight: 36, minWidth: 0 }} />
          </label>
          <div className="chips" role="group" aria-label="Filter soal">
            {isiFilter.map(([f, l]) => <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>)}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, minHeight: 36 }}>
            <input type="checkbox" checked={peserta} onChange={(e) => setPeserta(e.target.checked)} style={{ width: 16, height: 16 }} />Tampilan peserta
          </label>
          <button type="button" className="btn btn-kecil" title="Ganti nama badan dan orang pada soal acuan LatihUKP (terpilih, atau semua bila tidak ada yang dipilih)"
            onClick={() => adaptasiSoal(pilih.size ? [...pilih] : paket.soal.map((s, i) => (s.asal === 'bank' ? i + 1 : 0)).filter(Boolean))}>Adaptasi identitas {pilih.size ? 'terpilih' : 'semua acuan'}</button>
        </div>

        <div className="strip strip-angka">
          <div><span className="angka">{paket.soal.length}</span>soal {paket.id}</div>
          <div><span className="angka" style={{ color: 'var(--hijau)' }}>{mutu.lolos}</span>lolos semua cek</div>
          <div><span className="angka" style={{ color: 'var(--amber)' }}>{mutu.catatan}</span>ada catatan</div>
          <div><span className="angka" style={{ color: mutu.gagal ? 'var(--merah)' : undefined }}>{mutu.gagal}</span>menahan ekspor</div>
          <div><span className="angka">{HURUF.map((h) => h + kunci[h]).join(' ')}</span>posisi kunci</div>
          <div><span className="angka">{baru} / {paket.soal.length - baru}</span>soal baru / bank</div>
        </div>

        {mutu.paket.some((c) => c.level !== 'lolos') && (
          <div className={mutu.paket.some((c) => c.level === 'gagal') ? 'kotak-galat' : 'kotak-info'} role="status">
            <b>Catatan paket</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>{mutu.paket.filter((c) => c.level !== 'lolos').map((c) => <li key={c.id}>{c.judul}: {c.ket}</li>)}</ul>
          </div>
        )}

        <section aria-labelledby="peta-judul" className="panel" style={{ padding: '10px 14px 12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 18px', marginBottom: 8 }}>
            <h2 id="peta-judul" style={{ margin: 0, fontSize: 13 }}>Peta soal 1–{paket.soal.length}</h2>
            <span className="kecil redup">jingga tebal = ada catatan · merah = menahan ekspor · garis bawah = bagian kasus</span>
          </div>
          <div className="peta">
            {paket.soal.map((x, i) => {
              const st = status(x);
              const kelas = [i === aktif ? 'aktif' : '', st === 'catatan' ? 'catatan' : '', st === 'gagal' ? 'gagal' : '', x.kasusId ? 'kasus' : ''].join(' ');
              return <button key={x.uid} type="button" className={kelas} aria-label={'Soal ' + (i + 1) + (st !== 'lolos' ? ', ' + (st === 'gagal' ? 'menahan ekspor' : 'ada catatan') : '') + (x.kasusId ? ', bagian kasus' : '')} aria-current={i === aktif} onClick={() => setAktif(i)}>{i + 1}</button>;
            })}
          </div>
        </section>

        <div className="dua-kolom">
          <div className="utama kotak-tabel" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <table className="lembar" style={{ minWidth: 720 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr><th style={{ width: 28 }}><span className="tersembunyi">Pilih</span></th><th>No</th><th>Kode</th><th>Subtema</th><th>Tipe</th>{!peserta && <th>Kunci</th>}<th>Asal</th><th>Mutu</th></tr>
              </thead>
              <tbody>
                {indeks.map((i) => {
                  const x = paket.soal[i];
                  const st = status(x);
                  const c = (mutu.perSoal.get(x.uid) ?? []).filter((m) => m.level === 'peringatan' || m.level === 'gagal');
                  return (
                    <tr key={x.uid} id={'baris-' + i} className={'baris-klik' + (i === aktif ? ' pilih' : '')} onClick={() => setAktif(i)}>
                      <td style={{ borderLeft: '3px solid ' + (i === aktif ? 'var(--aksen)' : x.kasusId ? 'var(--garis)' : 'transparent') }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={'Pilih soal ' + (i + 1)} checked={pilih.has(i + 1)} onChange={(e) => { const n = new Set(pilih); if (e.target.checked) n.add(i + 1); else n.delete(i + 1); setPilih(n); }} style={{ width: 16, height: 16 }} />
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>{i + 1}</td>
                      <td className="mono">{x.kode}</td>
                      <td>{x.subtema}{x.kasusId && <span className="tag" style={{ marginLeft: 6 }}>kasus</span>}</td>
                      <td className="redup" style={{ whiteSpace: 'nowrap' }}>{x.tipe || '—'}</td>
                      {!peserta && <td className="mono" style={{ fontWeight: 700 }}>{x.kunci}</td>}
                      <td className="redup" style={{ whiteSpace: 'nowrap' }}>{x.asal === 'model' ? 'Model' : x.asal === 'adaptasi' ? 'Adaptasi' : x.asal === 'orisinal' ? 'Orisinal' : 'Bank'}</td>
                      <td className={'st-' + st}>{st === 'lolos' ? 'OK' : c.length === 1 ? c[0].ket : c.length + ' catatan'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="kecil redup" style={{ padding: '8px 12px', borderTop: '1px solid var(--garis-muda)' }}>Menampilkan {indeks.length} dari {paket.soal.length} · pintasan J/K untuk pindah soal</div>
          </div>
          {s && (
            <aside className="samping panel" aria-label={'Detail soal ' + (aktif + 1)}>
              <DetailSoal data={data} ws={ws} setWs={setWs} indeksPaket={ip} nomor={aktif + 1} soal={s} soalSebelum={paket.soal[aktif - 1]} cek={mutu.perSoal.get(s.uid) ?? []} peserta={peserta} ganti={() => ganti([aktif + 1])} kabar={kabar}
                aksiLain={(c) => { if (c.aksi === 'adaptasi') adaptasiSoal([aktif + 1]); }}
                unduh={() => setEkspor('pdf', paket.soal[aktif].kasusId ? paket.soal.map((x, i) => (x.kasusId === paket.soal[aktif].kasusId ? i + 1 : 0)).filter(Boolean) : [aktif + 1])} />
            </aside>
          )}
        </div>
      </div>
      <div className="bawah">
        <div className="bawah-isi">
          <div className="mono" style={{ fontSize: 13 }}>{pilih.size} dipilih · {mutu.catatan} catatan · {mutu.gagal} menahan ekspor</div>
          <div className="kanan">
            {pilih.size > 0 && <button type="button" className="btn" onClick={() => setPilih(new Set())}>Kosongkan</button>}
            <button type="button" className="btn" onClick={() => setPilih(new Set(indeks.map((i) => i + 1)))}>Pilih semua</button>
            <button type="button" className="btn" disabled={!pilih.size} onClick={() => ganti([...pilih])}>Ganti terpilih ({pilih.size})</button>
            <button type="button" className="btn" disabled={!pilih.size} onClick={salinTerpilih}>Salin terpilih</button>
            <button type="button" className="btn" onClick={() => setEkspor('pdf')}>PDF</button>
            <button type="button" className="btn" onClick={() => setEkspor('siadu-excel')}>Excel SiAdu</button>
            <button type="button" className="btn btn-utama" onClick={() => setEkspor('siadu-word')}>Word SiAdu</button>
            <button type="button" className="btn" onClick={() => setEkspor('lain')}>Format lainnya</button>
          </div>
        </div>
      </div>
      {ekspor && <EksporDialog awal={ekspor} ws={ws} indeksPaket={ip} pilih={nomorEkspor} mutu={(p) => cekPaket(p, { data, tanggalAcuan: peng.tanggalAcuan }, ws.paket, peng.larangKembar)} siadu={data.mapping.siadu} tutup={() => setEkspor(null)} kabar={kabar} />}
    </>
  );
}
