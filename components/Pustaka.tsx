'use client';
import { useMemo, useState } from 'react';
import { diujiDi, HURUF, KESULITAN, LABEL_KESULITAN, TINGKAT, ujianUntuk, URUTAN_KODE } from '@/lib/config';
import { tingkatAturan, tingkatSoal } from '@/lib/data';
import { dariModel, seimbangkanKunci } from '@/lib/generate';
import { kapasitasModel, kondisiTersedia, MODELS } from '@/lib/models';
import { cekSoal } from '@/lib/quality';
import { dariBank } from '@/lib/soal';
import type { BankSoal, DataUkp, Kode, Soal, Tingkat } from '@/lib/types';
import { rng } from '@/lib/util';
import { DaftarMutu } from './ui';

type Sub = 'bank' | 'aturan' | 'kartu' | 'model' | 'info';

export default function Pustaka({ data, tanggalAcuan }: { data: DataUkp; tanggalAcuan: string }) {
  const [sub, setSub] = useState<Sub>('bank');
  const tabs: [Sub, string][] = [['bank', 'Bank acuan (' + data.bank.length + ')'], ['aturan', 'Kartu aturan (' + data.aturan.length + ')'], ['kartu', 'Hafalan & rumus (' + data.materi.kartu.length + ')'], ['model', 'Model soal baru (' + MODELS.length + ')'], ['info', 'Info ujian']];
  return (
    <div className="halaman">
      <div className="judul-hal"><div><h1>Pustaka</h1><p>Bahan acuan internal dari LatihUKP (belum diverifikasi independen; bukan soal resmi BPPK/DJP) dan model generator soal baru.</p></div></div>
      <div role="tablist" aria-label="Bagian pustaka" className="seg" style={{ alignSelf: 'flex-start' }}>
        {tabs.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}>{l}</button>)}
      </div>
      {sub === 'bank' && <BankAcuan data={data} tanggalAcuan={tanggalAcuan} />}
      {sub === 'aturan' && <KartuAturan data={data} />}
      {sub === 'kartu' && <KartuHafal data={data} />}
      {sub === 'model' && <PratinjauModel data={data} tanggalAcuan={tanggalAcuan} />}
      {sub === 'info' && <InfoUjian data={data} />}
    </div>
  );
}

export function TampilSoal({ s, cek }: { s: Soal; cek?: ReturnType<typeof cekSoal> }) {
  return (
    <div className="panel-isi">
      {s.kasus && <div className="kasus"><div className="sub-judul">Kasus</div>{s.kasus}</div>}
      <p style={{ margin: 0, fontSize: 15 }}>{s.soal}</p>
      <ol className="opsi-daftar">{HURUF.map((h) => <li key={h} className={h === s.kunci ? 'kunci' : ''}><span className="huruf">{h}</span><span style={{ flex: 1 }}>{s.opsi[h]}</span>{h === s.kunci && <b className="kecil">KUNCI</b>}</li>)}</ol>
      {cek && <DaftarMutu cek={cek} />}
      <p style={{ margin: 0, fontSize: 13 }}><b>Inti.</b> {s.inti}</p>
      {s.langkah.length > 0 && <ol className="langkah-mono mono">{s.langkah.map((l, i) => <li key={i}>{l}</li>)}</ol>}
      {HURUF.filter((h) => h !== s.kunci && s.kenapaSalah[h]).map((h) => <p key={h} style={{ margin: 0, fontSize: 13 }}><b className="mono">{h}</b> {s.kenapaSalah[h]}</p>)}
      {s.dasarHukum.length > 0 && <p style={{ margin: 0, fontSize: 13 }}><b>Dasar hukum.</b> {s.dasarHukum.join('; ')}</p>}
      {s.poinIngat && <div className="poin"><b>Poin ingat.</b> {s.poinIngat}</div>}
    </div>
  );
}

function BankAcuan({ data, tanggalAcuan }: { data: DataUkp; tanggalAcuan: string }) {
  const [kode, setKode] = useState<Kode | ''>('');
  const [tingkat, setTingkat] = useState<Tingkat | ''>('');
  const [sulit, setSulit] = useState('');
  const [cari, setCari] = useState('');
  const [batas, setBatas] = useState(60);
  const [aktif, setAktif] = useState<BankSoal | null>(null);
  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return [...data.bank, ...data.orisinal].filter((b) => (!kode || b.kode === kode) && (!tingkat || tingkatSoal(b, data.mapping) === tingkat) && (!sulit || b.kesulitan === sulit)
      && (!q || (b.id + ' ' + b.subtopik + ' ' + b.subtema + ' ' + b.soal + ' ' + (b.kasus ?? '')).toLowerCase().includes(q)));
  }, [data, kode, tingkat, sulit, cari]);
  const s = aktif ? dariBank(aktif, data) : null;
  const pilihGaya = { border: '1px solid var(--garis)', borderRadius: 6, padding: '6px 8px', minHeight: 36 };
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select aria-label="Materi" value={kode} onChange={(e) => setKode(e.target.value as Kode)} style={pilihGaya}><option value="">Semua materi</option>{URUTAN_KODE.map((k) => <option key={k}>{k}</option>)}</select>
        <select aria-label="Tingkat" value={tingkat} onChange={(e) => setTingkat(e.target.value as Tingkat)} style={pilihGaya}><option value="">Semua tingkat</option>{TINGKAT.map((t) => <option key={t} value={t}>Diuji di {ujianUntuk(t)}</option>)}</select>
        <select aria-label="Kesulitan" value={sulit} onChange={(e) => setSulit(e.target.value)} style={pilihGaya}><option value="">Semua kesulitan</option>{KESULITAN.map((d) => <option key={d} value={d}>{LABEL_KESULITAN[d]}</option>)}</select>
        <input type="search" aria-label="Cari" placeholder="id, subtopik, atau teks" value={cari} onChange={(e) => { setCari(e.target.value); setBatas(60); }} style={{ ...pilihGaya, flex: '1 1 220px' }} />
        <span className="kecil redup">{hasil.length} soal</span>
      </div>
      <div className="dua-kolom">
        <div className="utama kotak-tabel" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="lembar">
            <thead style={{ position: 'sticky', top: 0 }}><tr><th>Id</th><th>Kode</th><th>Subtema</th><th>Subtopik</th><th>Diuji di</th><th>Kesulitan</th></tr></thead>
            <tbody>
              {hasil.slice(0, batas).map((b) => (
                <tr key={b.id} className={'baris-klik' + (aktif?.id === b.id ? ' pilih' : '')} onClick={() => setAktif(b)}>
                  <td className="mono">{b.id}</td><td className="mono">{b.kode}</td><td>{b.subtema}{b.subtemaDasar === 'kemiripan' && <span className="redup" title="Subtema ditebak dari kemiripan teks"> ≈</span>}</td>
                  <td className="redup">{b.subtopik}</td><td className="mono" style={{ whiteSpace: 'nowrap' }}>{ujianUntuk(tingkatSoal(b, data.mapping))}</td><td>{LABEL_KESULITAN[b.kesulitan]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasil.length > batas && <div style={{ padding: 10 }}><button type="button" className="btn" onClick={() => setBatas(batas + 100)}>Tampilkan 100 lagi</button></div>}
        </div>
        <aside className="samping panel" aria-label="Detail soal bank">
          {s ? <><div className="panel-kepala"><b className="mono">{aktif!.id}</b><span className="tag tag-acuan">Acuan sumber</span><span className="tag">{s.kode} · {s.subtema}</span></div><TampilSoal s={s} cek={cekSoal(s, { data, tanggalAcuan })} /></>
            : <div className="panel-isi redup">Pilih soal untuk melihat isinya.</div>}
        </aside>
      </div>
    </>
  );
}

function KartuAturan({ data }: { data: DataUkp }) {
  const [kode, setKode] = useState<Kode>('KUP');
  const aturan = data.aturan.filter((a) => a.kode === kode);
  const subtema = [...new Set(aturan.map((a) => a.subtema))];
  return (
    <>
      <div className="chips">{URUTAN_KODE.map((k) => <button key={k} type="button" className="chip" aria-pressed={kode === k} onClick={() => setKode(k)}>{k}</button>)}</div>
      {subtema.map((st) => (
        <section key={st}>
          <h2 style={{ fontSize: 15, margin: '6px 0' }}>{st}</h2>
          <div className="daftar-kartu">
            {aturan.filter((a) => a.subtema === st).map((a) => (
              <article key={a.id} className="kartu">
                <h3><span className="mono redup">{a.id}</span> {a.judul}</h3>
                <p style={{ margin: 0, fontSize: 13 }}>{a.pokok}</p>
                {a.tarifDpp && <p style={{ margin: 0, fontSize: 13 }}><b>Tarif/DPP.</b> {a.tarifDpp}</p>}
                {a.tenggat && <p style={{ margin: 0, fontSize: 13 }}><b>Tenggat.</b> {a.tenggat}</p>}
                {a.jebakan.length > 0 && <p style={{ margin: 0, fontSize: 13 }}><b>Jebakan.</b> {a.jebakan.join(' ')}</p>}
                <p className="kecil redup" style={{ margin: 0 }}>{a.dasarHukum.join('; ')} · berlaku {a.berlaku.mulai ?? '—'} · {diujiDi(tingkatAturan(a, data.mapping))}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function KartuHafal({ data }: { data: DataUkp }) {
  return (
    <div className="daftar-kartu">
      {data.materi.kartu.map((k) => (
        <article key={k.id} className="kartu">
          <h3><span className="tag">{k.jenis}</span> <span className="mono redup">{k.kode}</span> {k.judul}</h3>
          <ul>{k.isi.map((x, i) => <li key={i}>{x}</li>)}</ul>
          {k.jebakan && <p style={{ margin: 0, fontSize: 13 }}><b>Jebakan.</b> {k.jebakan}</p>}
          <p className="kecil redup" style={{ margin: 0 }}>{k.dasar}{k.sejak ? ' · sejak ' + k.sejak : ''}</p>
        </article>
      ))}
    </div>
  );
}

function PratinjauModel({ data, tanggalAcuan }: { data: DataUkp; tanggalAcuan: string }) {
  const [id, setId] = useState(MODELS[0]?.id ?? '');
  const [kondisi, setKondisi] = useState('');
  const [seed, setSeed] = useState('PRATINJAU-1');
  const m = MODELS.find((x) => x.id === id);
  if (!m) return <p className="redup">Belum ada model soal baru.</p>;
  const ctx = { data, tanggalAcuan };
  let s: Soal | null = null, galat = '';
  // Tampilkan seperti di paket: opsi angka diurutkan naik, opsi lain diacak.
  try { s = seimbangkanKunci([dariModel(m.buat(rng(seed + '|' + m.id), ctx, kondisi || undefined), m, data)], rng(seed + '|urutan'))[0]; } catch (e) { galat = (e as Error).message; }
  const gaya = { border: '1px solid var(--garis)', borderRadius: 6, padding: '6px 8px', minHeight: 36 };
  return (
    <div className="dua-kolom">
      <div className="utama kotak-tabel">
        <table className="lembar">
          <thead><tr><th>Model</th><th>Materi · subtema</th><th>Diuji di</th><th title="Kondisi yang bisa dibuat pada tanggal acuan / semua kondisi">Kondisi</th><th className="kanan">Kapasitas</th></tr></thead>
          <tbody>
            {MODELS.map((x) => (
              <tr key={x.id} className={'baris-klik' + (x.id === id ? ' pilih' : '')} onClick={() => { setId(x.id); setKondisi(''); }}>
                <td><b>{x.nama}</b><div className="kecil redup">{x.ringkas}</div></td><td>{x.kode} · {x.subtema}</td><td className="mono" style={{ whiteSpace: 'nowrap' }}>{ujianUntuk(tingkatSoal(x, data.mapping))}</td>
                <td className="mono">{kondisiTersedia(x, ctx).length}/{x.kondisi.length}</td><td className="kanan mono">{kapasitasModel(x, ctx)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="samping panel" aria-label="Pratinjau model">
        <div className="panel-kepala" style={{ gap: 8 }}>
          <b>{m.nama}</b>
          <select aria-label="Kondisi" value={kondisi} onChange={(e) => setKondisi(e.target.value)} style={gaya}><option value="">Kondisi acak</option>{m.kondisi.map((k) => <option key={k}>{k}</option>)}</select>
          <input aria-label="Seed pratinjau" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ ...gaya, width: 140 }} className="mono" />
          <button type="button" className="btn btn-kecil" onClick={() => setSeed('PRATINJAU-' + Math.floor(Math.random() * 1e6))}>Acak angka</button>
        </div>
        {galat ? <div className="panel-isi"><div className="kotak-galat">{galat}</div></div> : s && <TampilSoal s={s} cek={cekSoal(s, ctx)} />}
      </aside>
    </div>
  );
}

function InfoUjian({ data }: { data: DataUkp }) {
  const info = data.materi.topik.find((t) => t.id === '_info');
  if (!info) return null;
  return (
    <div className="panel"><div className="panel-isi">
      <p className="kecil redup" style={{ margin: 0 }}>{info.eyebrow} · ringkasan riset sumber, belum diverifikasi ulang terhadap dokumen BPPK.</p>
      {info.bagian.map((b) => (
        <section key={b.judul}>
          <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>{b.judul}</h2>
          {b.poin && <ul style={{ margin: 0, paddingLeft: 18 }}>{b.poin.map((p) => <li key={p}>{p}</li>)}</ul>}
          {b.tabel && (
            <div className="kotak-tabel"><table className="lembar"><thead><tr>{b.tabel[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{b.tabel.slice(1).map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
          )}
          {b.link && <ul style={{ margin: 0, paddingLeft: 18 }}>{b.link.map(([t, u]) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{t}</a></li>)}</ul>}
        </section>
      ))}
    </div></div>
  );
}
