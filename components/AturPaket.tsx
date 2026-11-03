'use client';
import { useMemo, useState } from 'react';
import { cekPersediaan, hitungKuota, hitungStok, totalBaris } from '@/lib/blueprint';
import { KESULITAN, TINGKAT, URUTAN_KODE } from '@/lib/config';
import { kodeBermodel } from '@/lib/models';
import type { BarisKuota, DataUkp, JenisPaket, Kesulitan, Kode, Pengaturan, SumberSoal, Tingkat } from '@/lib/types';
import { angka } from '@/lib/util';
import { IkonCentang, Segmented } from './ui';

const KUNCI_PRESET = 'ukp-studio-preset-v1';
type Preset = { nama: string; peng: Pengaturan };
const bacaPreset = (): Preset[] => { try { return JSON.parse(localStorage.getItem(KUNCI_PRESET) ?? '[]'); } catch { return []; } };

const CAKUPAN: Record<Tingkat, string> = { A: 'Tingkat A', B: 'Tingkat B', C: 'Tingkat C · A+B+C' };

export default function AturPaket({ data, peng, setPeng, buat, galat, kabar }: {
  data: DataUkp; peng: Pengaturan; setPeng: (p: Pengaturan) => void; buat: () => void; galat: string[]; kabar: (p: string, g?: boolean) => void;
}) {
  const [preset, setPreset] = useState<Preset[]>(() => (typeof window === 'undefined' ? [] : bacaPreset()));
  const ctx = useMemo(() => ({ data, tanggalAcuan: peng.tanggalAcuan }), [data, peng.tanggalAcuan]);
  const stok = useMemo(() => hitungStok(data, peng, ctx), [data, peng, ctx]);
  const baris = useMemo(() => peng.kuota ?? hitungKuota(data, peng, ctx), [data, peng, ctx]);
  const cek = useMemo(() => cekPersediaan(data, peng, baris, ctx), [data, peng, baris, ctx]);
  const bermodel = kodeBermodel();
  const nama = (k: Kode) => data.mapping.materi.find((m) => m.kode === k)?.nama ?? k;
  const ubah = (p: Partial<Pengaturan>, kuotaTetap = false) => setPeng({ ...peng, ...p, kuota: kuotaTetap ? peng.kuota : null });
  const ubahSel = (kode: Kode, kolom: Kesulitan | 'kasus', nilai: number) => {
    const baru: BarisKuota[] = baris.map((b) => (b.kode === kode ? { ...b, [kolom]: Math.max(0, Math.floor(nilai || 0)) } : b));
    setPeng({ ...peng, kuota: baru, jumlahSoal: baru.reduce((a, b) => a + totalBaris(b), 0) });
  };
  const total = baris.reduce((a, b) => a + totalBaris(b), 0);
  const perSulit = Object.fromEntries(KESULITAN.map((d) => [d, baris.reduce((a, b) => a + b[d], 0)])) as Record<Kesulitan, number>;
  const totalKasus = baris.reduce((a, b) => a + b.kasus, 0);
  const sumberLabel = (k: Kode) => (peng.sumber === 'bank' || !bermodel.includes(k) ? 'Bank acuan' : peng.sumber === 'baru' ? 'Soal baru' : 'Campuran');
  const stokBaris = (k: Kode) => Math.floor(KESULITAN.reduce((a, d) => a + stok.bank[k][d] + (peng.sumber === 'bank' ? 0 : stok.model[k][d]), 0));
  const subtemaSemua = data.mapping.materi.flatMap((m) => m.subtema.map((s) => m.kode + '::' + s));

  const simpanPreset = () => {
    const n = window.prompt('Nama preset:', peng.judul + ' ' + peng.tingkat);
    if (!n) return;
    const daftar = [{ nama: n, peng: { ...peng } }, ...preset.filter((p) => p.nama !== n)].slice(0, 20);
    setPreset(daftar);
    try { localStorage.setItem(KUNCI_PRESET, JSON.stringify(daftar)); } catch { /* opsional */ }
    kabar('Preset "' + n + '" disimpan di browser ini.');
  };
  const imporCsv = async (file: File) => {
    // Format: kode,mudah,sedang,sulit[,kasus] per baris; baris judul boleh ada.
    const baru: BarisKuota[] = [];
    for (const l of (await file.text()).split(/\r?\n/)) {
      const [k, m, s, u, ks] = l.split(/[,;\t]/).map((x) => x.trim());
      if (!URUTAN_KODE.includes(k as Kode)) continue;
      baru.push({ kode: k as Kode, mudah: +m || 0, sedang: +s || 0, sulit: +u || 0, kasus: +ks || 0 });
    }
    if (!baru.length) return kabar('CSV tidak berisi baris kode materi yang dikenal (KUP, OP, PP, PPN, BM, PBB, AKT, BDN, BTI, INT).', true);
    setPeng({ ...peng, materi: baru.map((b) => b.kode), kuota: baru, jumlahSoal: baru.reduce((a, b) => a + totalBaris(b), 0) });
    kabar('Blueprint diimpor: ' + baru.length + ' materi.');
  };

  return (
    <>
      <div className="halaman">
        <div className="judul-hal">
          <div style={{ flex: '1 1 320px' }}>
            <h1>Blueprint paket</h1>
            <p>Pilih tingkat dan jenis, lalu atur kuota di tabel. Sel kuning bisa disunting; total dan cek stok dihitung ulang otomatis.</p>
          </div>
          <div role="tablist" aria-label="Tingkat" className="seg">
            {TINGKAT.map((t) => <button key={t} type="button" role="tab" aria-selected={peng.tingkat === t} onClick={() => ubah({ tingkat: t, seed: peng.seed.replace(/UKP-[ABC]-/, 'UKP-' + t + '-') })}>{CAKUPAN[t]}</button>)}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 28px', alignItems: 'flex-end' }}>
          <Segmented<JenisPaket> label="Jenis paket" nilai={peng.jenis} ubah={(v) => ubah({ jenis: v, ...(v === 'tryout' ? { materi: [...URUTAN_KODE], jumlahSoal: 100, durasi: 180 } : {}) })}
            pilihan={[{ nilai: 'tryout', label: 'Tryout penuh' }, { nilai: 'materi', label: 'Per materi' }, { nilai: 'subtema', label: 'Per subtema' }, { nilai: 'jebakan', label: 'Drill jebakan aturan' }]} />
          <Segmented<SumberSoal> label="Sumber soal" nilai={peng.sumber} ubah={(v) => ubah({ sumber: v })}
            pilihan={[{ nilai: 'bank', label: 'Bank acuan' }, { nilai: 'baru', label: 'Soal baru', nonaktif: !bermodel.length, judul: bermodel.length ? undefined : 'Model soal baru belum tersedia' }, { nilai: 'campuran', label: 'Campuran' }]} />
          <p style={{ flex: '1 1 260px', margin: 0, fontSize: 13 }} className="redup">
            {bermodel.length ? 'Campuran: materi yang punya model hitungan (' + bermodel.join(', ') + ') memakai soal baru lebih dulu, sisanya dari bank acuan.' : 'Model soal baru belum dipasang; campuran sama dengan bank acuan.'}
            {peng.jenis === 'jebakan' && ' Drill jebakan hanya memakai soal yang pengecohnya memuat ketentuan lama.'}
          </p>
        </div>

        {peng.jenis === 'materi' && (
          <fieldset className="panel" style={{ padding: '10px 14px' }}>
            <legend className="label-kecil">Materi</legend>
            <div className="chips">
              {URUTAN_KODE.map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={peng.materi.includes(k)}
                  onClick={() => ubah({ materi: peng.materi.includes(k) ? peng.materi.filter((x) => x !== k) : URUTAN_KODE.filter((x) => x === k || peng.materi.includes(x)) })}>{k} · {nama(k)}</button>
              ))}
            </div>
          </fieldset>
        )}
        {peng.jenis === 'subtema' && (
          <fieldset className="panel" style={{ padding: '10px 14px' }}>
            <legend className="label-kecil">Subtema ({peng.subtema.length} dipilih)</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
              {data.mapping.materi.map((m) => (
                <details key={m.kode} open={peng.subtema.some((s) => s.startsWith(m.kode + '::'))}>
                  <summary><b className="mono">{m.kode}</b> {m.nama}</summary>
                  {m.subtema.map((s) => {
                    const id = m.kode + '::' + s;
                    return (
                      <label key={id} style={{ display: 'flex', gap: 6, fontSize: 13, padding: '2px 0 2px 16px' }}>
                        <input type="checkbox" checked={peng.subtema.includes(id)} onChange={(e) => {
                          const sub = e.target.checked ? subtemaSemua.filter((x) => x === id || peng.subtema.includes(x)) : peng.subtema.filter((x) => x !== id);
                          ubah({ subtema: sub, materi: URUTAN_KODE.filter((k) => sub.some((x) => x.startsWith(k + '::'))) });
                        }} />{s}
                      </label>
                    );
                  })}
                </details>
              ))}
            </div>
          </fieldset>
        )}

        <div className="strip">
          <label>Judul paket<input value={peng.judul} onChange={(e) => ubah({ judul: e.target.value }, true)} /></label>
          <label>Jumlah soal<input type="number" min={1} max={200} value={peng.jumlahSoal} onChange={(e) => ubah({ jumlahSoal: Math.max(1, +e.target.value || 1) })} /></label>
          <label>Durasi (menit)<input type="number" min={5} max={600} value={peng.durasi} onChange={(e) => ubah({ durasi: Math.max(1, +e.target.value || 1) }, true)} /></label>
          <label>Jumlah paket<input type="number" min={1} max={50} value={peng.jumlahPaket} onChange={(e) => ubah({ jumlahPaket: Math.min(50, Math.max(1, +e.target.value || 1)) })} /></label>
          <label>Seed<input value={peng.seed} onChange={(e) => ubah({ seed: e.target.value }, true)} /></label>
          <label>Tanggal acuan aturan<input type="date" value={peng.tanggalAcuan} onChange={(e) => e.target.value && ubah({ tanggalAcuan: e.target.value }, true)} /></label>
          <label>Urutan soal
            <select value={peng.urutan} onChange={(e) => ubah({ urutan: e.target.value as Pengaturan['urutan'] }, true)}>
              <option value="materi">Dikelompokkan per materi</option>
              <option value="acak">Acak (blok kasus tetap utuh)</option>
            </select>
          </label>
          <label className="cek"><input type="checkbox" checked={peng.larangKembar} onChange={(e) => ubah({ larangKembar: e.target.checked })} style={{ width: 16, height: 16 }} />Larang soal kembar antarpaket</label>
        </div>

        <div className="dua-kolom">
          <div className="utama kotak-tabel">
            <table className="lembar" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Kode</th><th>Materi</th><th>Sumber</th><th className="kanan">Stok</th>
                  <th className="kanan garis-kiri">Mudah</th><th className="kanan">Sedang</th><th className="kanan">Sulit</th>
                  <th className="kanan garis-kiri">Kasus</th><th className="kanan garis-kiri" style={{ color: 'var(--tinta)' }}>Kuota</th><th>Pakai stok</th>
                </tr>
              </thead>
              <tbody className="mono" style={{ fontSize: 13 }}>
                {baris.map((b) => (
                  <tr key={b.kode}>
                    <td style={{ fontWeight: 600 }}>{b.kode}</td>
                    <td style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }}>{nama(b.kode)}</td>
                    <td className="redup" style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>{sumberLabel(b.kode)}</td>
                    <td className="kanan redup">{angka(stokBaris(b.kode))}</td>
                    {KESULITAN.map((d, i) => (
                      <td key={d} className={'sel-sunting' + (i === 0 ? ' garis-kiri' : '')}>
                        <input type="number" min={0} aria-label={b.kode + ' ' + d} value={b[d]} onChange={(e) => ubahSel(b.kode, d, +e.target.value)} />
                      </td>
                    ))}
                    <td className="sel-sunting garis-kiri"><input type="number" min={0} aria-label={b.kode + ' kasus'} value={b.kasus} onChange={(e) => ubahSel(b.kode, 'kasus', +e.target.value)} /></td>
                    <td className="kanan garis-kiri" style={{ fontWeight: 700 }}>{totalBaris(b)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="bar"><div style={{ width: Math.min(100, cek.pakai[b.kode]) + '%', background: cek.pakai[b.kode] > 80 ? 'var(--merah)' : undefined }} /></div>
                        <span style={{ width: 40, textAlign: 'right' }} className="redup">{cek.pakai[b.kode]}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td /><td style={{ fontFamily: 'var(--font-sans)' }}>Total</td><td />
                  <td className="kanan">{angka(URUTAN_KODE.filter((k) => peng.materi.includes(k)).reduce((a, k) => a + stokBaris(k), 0))}</td>
                  <td className="kanan garis-kiri">{perSulit.mudah}</td><td className="kanan">{perSulit.sedang}</td><td className="kanan">{perSulit.sulit}</td>
                  <td className="kanan garis-kiri">{totalKasus}</td>
                  <td className="kanan garis-kiri" style={{ color: 'var(--aksen)' }}>{total}</td>
                  <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }} className="redup">{peng.kuota ? <button type="button" className="btn-teks" onClick={() => ubah({})}>Hitung ulang otomatis</button> : 'otomatis'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <aside className="samping panel" aria-label="Ringkasan blueprint" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, flexBasis: 300 }}>
            <div>
              <div className="label-kecil" style={{ margin: 0 }}>Ringkasan</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{total} × {peng.jumlahPaket} paket</div>
              <div className="redup" style={{ fontSize: 13 }}>{({ tryout: 'Tryout penuh', materi: 'Per materi', subtema: 'Per subtema', jebakan: 'Drill jebakan aturan' } as const)[peng.jenis]} · Tingkat {peng.tingkat} · {peng.durasi} menit</div>
            </div>
            <div>
              <div className="label-kecil">Sebaran kesulitan (%)</div>
              <div style={{ display: 'flex', height: 10, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: (perSulit.mudah / Math.max(1, total)) * 100 + '%', background: 'var(--kuning-garis)' }} />
                <div style={{ width: (perSulit.sedang / Math.max(1, total)) * 100 + '%', background: 'var(--aksen)' }} />
                <div style={{ width: (perSulit.sulit / Math.max(1, total)) * 100 + '%', background: 'var(--tinta)' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {KESULITAN.map((d) => (
                  <label key={d} style={{ flex: 1, fontSize: 12, color: 'var(--abu)' }}>{d}
                    <input type="number" min={0} max={100} value={peng.komposisi[d]} onChange={(e) => ubah({ komposisi: { ...peng.komposisi, [d]: Math.max(0, +e.target.value || 0) } })}
                      style={{ width: '100%', border: '1px solid var(--garis)', borderRadius: 6, padding: '4px 8px' }} className="mono" />
                  </label>
                ))}
              </div>
            </div>
            {cek.ok ? (
              <div className="kotak-ok">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--hijau)', marginBottom: 6 }}><IkonCentang />Cek persediaan lulus</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <li>Stok cukup untuk {peng.jumlahPaket} paket{peng.larangKembar ? ' tanpa kembar' : ''}</li>
                  {cek.palingKetat && <li>Paling ketat: {cek.palingKetat.kode}, {angka(cek.palingKetat.butuh)} dari {angka(cek.palingKetat.stok)} soal</li>}
                  <li>{totalKasus} soal kasus dirakit per blok, tidak dipecah</li>
                  <li>{bermodel.length ? 'Perkiraan soal baru: ' + cek.soalBaru + ' per paket' : 'Belum ada model soal baru'}</li>
                </ul>
              </div>
            ) : (
              <div className="kotak-galat" role="alert">
                <b>Cek persediaan belum lulus</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>{cek.pesan.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="btn" style={{ flex: '1 1 120px' }} onClick={simpanPreset}>Simpan preset</button>
              <label className="btn" style={{ flex: '1 1 120px' }}>Impor CSV<input type="file" accept=".csv,text/csv" className="tersembunyi" onChange={(e) => { const f = e.target.files?.[0]; if (f) imporCsv(f); e.target.value = ''; }} /></label>
            </div>
            {preset.length > 0 && (
              <label className="kecil redup">Muat preset
                <select style={{ width: '100%', marginTop: 4, border: '1px solid var(--garis)', borderRadius: 6, padding: 6 }} value="" onChange={(e) => { const p = preset.find((x) => x.nama === e.target.value); if (p) { setPeng({ ...p.peng, tanggalAcuan: peng.tanggalAcuan }); kabar('Preset "' + p.nama + '" dimuat.'); } }}>
                  <option value="">Pilih…</option>
                  {preset.map((p) => <option key={p.nama} value={p.nama}>{p.nama}</option>)}
                </select>
              </label>
            )}
          </aside>
        </div>
        {galat.length > 0 && (
          <div className="kotak-galat" role="alert"><b>Paket belum dibuat.</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{galat.map((g) => <li key={g}>{g}</li>)}</ul></div>
        )}
      </div>
      <div className="bawah">
        <div className="bawah-isi">
          <div className="mono" style={{ fontSize: 13 }}><b>{total}</b> soal × <b>{peng.jumlahPaket}</b> paket · <b>{peng.durasi}</b> menit · {peng.sumber} · seed <b>{peng.seed}</b></div>
          {cek.ok
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--hijau)', fontWeight: 600 }}><IkonCentang />Stok cukup</div>
            : <div className="st-gagal" style={{ fontSize: 13 }}>Stok kurang · lihat ringkasan</div>}
          <div className="kanan"><button type="button" className="btn btn-utama btn-besar" disabled={!cek.ok} onClick={buat}>Buat paket</button></div>
        </div>
      </div>
    </>
  );
}
