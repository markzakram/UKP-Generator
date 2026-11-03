'use client';
import { useEffect, useState } from 'react';
import { HURUF, LABEL_KESULITAN } from '@/lib/config';
import { teksSalin } from '@/lib/salin';
import { terapkanUrutan, urutanAngka } from '@/lib/soal';
import type { CekMutu, DataUkp, Huruf, Soal, Workspace } from '@/lib/types';
import { gantiSoal, suntingSoal } from '@/lib/workspace';
import { DaftarMutu } from './ui';

export default function DetailSoal({ data, ws, setWs, indeksPaket, nomor, soal: s, soalSebelum, cek, peserta, ganti, kabar, aksiLain, unduh }: {
  data: DataUkp; ws: Workspace; setWs: (w: Workspace) => void; indeksPaket: number; nomor: number; soal: Soal; soalSebelum?: Soal; cek: CekMutu[];
  peserta: boolean; ganti: () => void; kabar: (p: string, g?: boolean) => void; aksiLain?: (c: CekMutu) => void; unduh?: () => void;
}) {
  const [sunting, setSunting] = useState(false);
  useEffect(() => setSunting(false), [s.uid]);
  const tampilKasus = !!s.kasus && (!soalSebelum || soalSebelum.kasusId !== s.kasusId || soalSebelum.kasus !== s.kasus);
  const aturan = s.ruleIds.map((id) => data.aturan.find((a) => a.id === id)).filter(Boolean);

  const aksi = (c: CekMutu) => {
    if (c.aksi === 'urutkan') {
      const soalBaru = ws.paket[indeksPaket].soal.map((x) => (x.uid === s.uid ? terapkanUrutan(x, urutanAngka(x)) : x));
      setWs(gantiSoal(ws, indeksPaket, soalBaru, 'Urutkan opsi soal ' + nomor));
      kabar('Opsi soal ' + nomor + ' diurutkan naik.');
    } else aksiLain?.(c);
  };
  const salin = async () => {
    const teks = teksSalin(s, nomor, !peserta, tampilKasus);
    try { await navigator.clipboard.writeText(teks); kabar('Soal ' + nomor + ' disalin.'); }
    catch { kabar('Browser menolak akses clipboard. Gunakan ekspor PDF/Word.', true); }
  };

  return (
    <>
      <div className="panel-kepala">
        <span className="mono" style={{ fontWeight: 700, fontSize: 15, marginRight: 4 }}>Soal {nomor}</span>
        <span className="tag">{s.kode} · {s.subtema}</span>
        <span className="tag">{LABEL_KESULITAN[s.kesulitan]}{s.bloom ? ' · ' + s.bloom : ''}</span>
        <span className={'tag ' + (s.asal === 'model' ? 'tag-baru' : s.asal === 'orisinal' ? '' : 'tag-acuan')}>{s.asal === 'model' ? 'Soal baru · ' + s.modelId : s.asal === 'adaptasi' ? 'Adaptasi · ' + s.sumberId : s.asal === 'orisinal' ? 'Orisinal · ' + s.sumberId : 'Acuan sumber · ' + s.sumberId}</span>
        {s.disunting && <span className="tag">revisi {s.revisi}</span>}
      </div>
      {sunting ? <Editor s={s} batal={() => setSunting(false)} simpan={(ubah) => { setWs(suntingSoal(ws, indeksPaket, s.uid, ubah)); setSunting(false); kabar('Soal ' + nomor + ' disimpan sebagai revisi baru.'); }} /> : (
        <div className="panel-isi">
          {tampilKasus && <div className="kasus"><div className="sub-judul">Kasus</div>{s.kasus}</div>}
          {!tampilKasus && s.kasus && <div className="kecil redup">Lanjutan kasus pada soal sebelumnya.</div>}
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{s.soal}</p>
          <ol className="opsi-daftar">
            {HURUF.map((h) => (
              <li key={h} className={!peserta && h === s.kunci ? 'kunci' : ''}>
                <span className="huruf">{h}</span><span style={{ flex: 1 }}>{s.opsi[h]}</span>
                {!peserta && h === s.kunci && <span className="kecil" style={{ fontWeight: 700, color: 'var(--aksen-tua)' }}>KUNCI</span>}
              </li>
            ))}
          </ol>
          {!peserta && (
            <>
              <section aria-label="Mutu otomatis"><h3 className="sub-judul">Mutu otomatis</h3><DaftarMutu cek={cek} aksi={aksi} /></section>
              <section aria-label="Pembahasan">
                <h3 className="sub-judul">Pembahasan</h3>
                <p style={{ margin: '0 0 8px', fontSize: 13 }}><b>Inti.</b> {s.inti}</p>
                {s.langkah.length > 0 && <ol className="langkah-mono mono">{s.langkah.map((l, i) => <li key={i}>{l}</li>)}</ol>}
                {HURUF.some((h) => h !== s.kunci && s.kenapaSalah[h]) && (
                  <dl style={{ margin: '8px 0', display: 'grid', gridTemplateColumns: '18px 1fr', gap: '4px 8px', fontSize: 13 }}>
                    {HURUF.filter((h) => h !== s.kunci && s.kenapaSalah[h]).map((h) => [<dt key={h + 't'} className="mono" style={{ fontWeight: 700 }}>{h}</dt>, <dd key={h + 'd'} style={{ margin: 0 }}>{s.kenapaSalah[h]}</dd>])}
                  </dl>
                )}
                {s.dasarHukum.length > 0 && <div style={{ fontSize: 13, color: 'var(--abu-2)', marginBottom: 6 }}><b style={{ color: 'var(--tinta)' }}>Dasar hukum.</b> {s.dasarHukum.join('; ')}</div>}
                {s.poinIngat && <div className="poin"><b>Poin ingat.</b> {s.poinIngat}</div>}
                {(s.catatanAturan || aturan.length > 0) && (
                  <details style={{ marginTop: 8, fontSize: 13 }}>
                    <summary className="redup">Catatan penelaah (tidak dicetak di naskah)</summary>
                    {s.catatanAturan && <p style={{ margin: '6px 0' }}><b>Riwayat aturan.</b> {s.catatanAturan}</p>}
                    {aturan.map((a) => a && <p key={a.id} style={{ margin: '6px 0' }}><b className="mono">{a.id}</b> {a.judul} <span className="redup">(berlaku {a.berlaku.mulai ?? '—'}{a.berlaku.sampai ? ' s.d. ' + a.berlaku.sampai : ''})</span></p>)}
                  </details>
                )}
              </section>
            </>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
            <button type="button" className="btn" style={{ flex: '1 1 100px' }} onClick={() => setSunting(true)}>Sunting</button>
            <button type="button" className="btn" style={{ flex: '1 1 100px' }} onClick={salin}>Salin soal</button>
            {unduh && <button type="button" className="btn" style={{ flex: '1 1 100px' }} onClick={unduh} title={s.kasusId ? 'Seluruh blok kasus ikut diunduh' : undefined}>Unduh soal ini</button>}
            <button type="button" className="btn btn-utama" style={{ flex: '1 1 130px' }} onClick={ganti}>Ganti nomor ini</button>
          </div>
        </div>
      )}
    </>
  );
}

type Ubah = Parameters<typeof suntingSoal>[3];
function Editor({ s, batal, simpan }: { s: Soal; batal: () => void; simpan: (u: Ubah) => void }) {
  const [f, setF] = useState({
    kasus: s.kasus ?? '', soal: s.soal, opsi: { ...s.opsi }, kunci: s.kunci, inti: s.inti,
    langkah: s.langkah.join('\n'), kenapaSalah: { ...s.kenapaSalah }, dasarHukum: s.dasarHukum.join('\n'), poinIngat: s.poinIngat ?? '',
  });
  const baris = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
  return (
    <form className="panel-isi form" onSubmit={(e) => {
      e.preventDefault();
      simpan({ kasus: s.kasusId ? f.kasus : s.kasus, soal: f.soal, opsi: f.opsi, kunci: f.kunci, inti: f.inti, langkah: baris(f.langkah),
        kenapaSalah: Object.fromEntries(HURUF.filter((h) => h !== f.kunci && f.kenapaSalah[h]?.trim()).map((h) => [h, f.kenapaSalah[h]!.trim()])), dasarHukum: baris(f.dasarHukum), poinIngat: f.poinIngat || null });
    }}>
      <p className="kecil redup" style={{ margin: 0 }}>Menyimpan membuat revisi baru{s.modelId ? ' dan membatalkan bukti hitung model' : ''}.</p>
      {s.kasusId && <label>Kasus<textarea value={f.kasus} onChange={(e) => setF({ ...f, kasus: e.target.value })} rows={5} /></label>}
      <label>Batang soal<textarea value={f.soal} onChange={(e) => setF({ ...f, soal: e.target.value })} rows={4} /></label>
      {HURUF.map((h) => <label key={h}>Opsi {h}<input value={f.opsi[h]} onChange={(e) => setF({ ...f, opsi: { ...f.opsi, [h]: e.target.value } })} /></label>)}
      <label>Kunci<select value={f.kunci} onChange={(e) => setF({ ...f, kunci: e.target.value as Huruf })}>{HURUF.map((h) => <option key={h}>{h}</option>)}</select></label>
      <label>Inti pembahasan<textarea value={f.inti} onChange={(e) => setF({ ...f, inti: e.target.value })} /></label>
      <label>Langkah (satu per baris)<textarea value={f.langkah} onChange={(e) => setF({ ...f, langkah: e.target.value })} rows={4} /></label>
      {HURUF.filter((h) => h !== f.kunci).map((h) => <label key={h}>Mengapa opsi {h} salah<textarea value={f.kenapaSalah[h] ?? ''} onChange={(e) => setF({ ...f, kenapaSalah: { ...f.kenapaSalah, [h]: e.target.value } })} rows={2} /></label>)}
      <label>Dasar hukum (satu per baris)<textarea value={f.dasarHukum} onChange={(e) => setF({ ...f, dasarHukum: e.target.value })} rows={3} /></label>
      <label>Poin ingat<input value={f.poinIngat} onChange={(e) => setF({ ...f, poinIngat: e.target.value })} /></label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={batal}>Batal</button>
        <button type="submit" className="btn btn-utama">Simpan revisi</button>
      </div>
    </form>
  );
}
