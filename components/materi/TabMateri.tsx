'use client';
// Tab Materi (desain B+ Materi, PRD-Materi bagian 19): cakupan deck, naskah sebagai tabel slide,
// pratinjau yang sama dengan .pptx, isian per pola, pemeriksaan, dan unduhan dengan konfirmasi Draf internal.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { periksaTataLetak } from '@/lib/materi/cek';
import { aturSlide, bacaNaskah, buatDeck, idDeck, kembalikanSlide, suntingSlide, tandaiTelaah, urungkan, type DeckMateri } from '@/lib/materi/deck';
import type { SlideJadi } from '@/lib/materi/kotak';
import { adaTeksAcuan, NAMA_POLA, type AsalBlok, type SlideNaskah } from '@/lib/materi/naskah';
import { tulisPptx } from '@/lib/materi/pptx';
import { diujiDi, labelTingkat, singkatTingkat, TINGKAT } from '@/lib/config';
import { berlakuPada, daftarSubtema, PENGATURAN_MATERI_AWAL, susunNaskah, teksSlide, type Kepadatan, type SumberSoalMateri } from '@/lib/materi/susun';
import { tataLetak } from '@/lib/materi/tata-letak';
import { cariJebakan } from '@/lib/quality';
import { daftarDeckMateri, hapusDeckMateri, simpanDeckMateri } from '@/lib/storage';
import type { CekMutu, DataUkp, Kode, Tingkat } from '@/lib/types';
import { MIME, unduh, zip } from '@/lib/export/unduh';
import { slug } from '@/lib/export/common';
import { DaftarMutu, Dialog, Segmented } from '../ui';
import IsianSlide from './IsianSlide';
import PratinjauSlide from './PratinjauSlide';

type Saring = 'semua' | 'belum' | 'draf' | 'telaah';
/** Lingkup susun: satu atau beberapa subtema, semua subtema satu materi (kode), atau semua subtema satu tingkat. */
type Lingkup = 'subtema' | 'materi' | 'tingkat';

/** Subtema dalam lingkup, urut materi; "baru" = hanya subtema yang mulai diuji di tingkat itu. */
function subtemaLingkup(data: DataUkp, tanggalAcuan: string, l: Lingkup, k: Kode, t: Tingkat, baru: boolean) {
  const subs = daftarSubtema(data, t, tanggalAcuan);
  const urut = data.mapping.materi.flatMap((m) => subs.filter((s) => s.kode === m.kode));
  return l === 'tingkat' ? urut.filter((s) => !baru || s.tingkat === t) : urut.filter((s) => s.kode === k);
}
const ASAL: Record<AsalBlok, { teks: string; kelas: string }> = {
  acuan: { teks: 'Teks acuan', kelas: 'tag tag-acuan' },
  tulis: { teks: 'Ditulis ulang', kelas: 'tag tag-tulis' },
  orisinal: { teks: 'Orisinal', kelas: 'tag tag-baru' },
  model: { teks: 'Model', kelas: 'tag tag-baru' },
  otomatis: { teks: 'Otomatis', kelas: 'tag' }
};
const STATUS = { belum: { teks: 'Belum disusun', kelas: 'tag' }, draf: { teks: 'Draf internal', kelas: 'tag tag-acuan' }, telaah: { teks: 'Ditelaah', kelas: 'tag tag-tulis' } };

let dasarCache: Promise<Uint8Array> | null = null;
const muatDasar = () => (dasarCache ??= fetch('/materi/dasar.pptx').then((r) => {
  if (!r.ok) throw new Error('Paket dasar materi tidak dapat dimuat. Jalankan npm run materi:dasar.');
  return r.arrayBuffer();
}).then((b) => new Uint8Array(b)).catch((e) => { dasarCache = null; throw e; }));

const namaBerkas = (d: DeckMateri, ext: string) => `materi-${slug(d.naskah.kode ?? 'impor')}-${slug(d.naskah.subtema ?? d.judul)}.${ext}`;
const sekarang = () => new Date().toISOString();

function ringkasTata(js: SlideJadi[], sembunyi?: boolean): { teks: string; kelas: string } {
  if (sembunyi) return { teks: 'disembunyikan', kelas: 'redup' };
  const lap = js.flatMap((j) => j.laporan);
  if (lap.some((l) => l.jenis === 'dipotong' || l.jenis === 'label-panjang')) return { teks: 'label dipotong', kelas: 'st-catatan' };
  if (js.length > 1) return { teks: `dipecah → ${js.length} slide`, kelas: 'st-catatan' };
  const kecil = lap.find((l) => l.jenis === 'diperkecil');
  if (kecil) return { teks: 'diperkecil · ' + (kecil.pesan.match(/(\d+) pt/)?.[1] ?? '') + ' pt', kelas: 'redup' };
  return { teks: 'muat', kelas: 'st-lolos' };
}

export default function TabMateri({ data, tanggalAcuan, kabar }: { data: DataUkp; tanggalAcuan: string; kabar: (p: string, galat?: boolean) => void }) {
  const [tingkat, setTingkat] = useState<Tingkat>(PENGATURAN_MATERI_AWAL.tingkat);
  const [kode, setKode] = useState<Kode>('PP');
  const [lingkup, setLingkup] = useState<Lingkup>('subtema');
  const [hanyaBaru, setHanyaBaru] = useState(false);
  const [cek, setCek] = useState<Set<string>>(new Set());
  const [saring, setSaring] = useState<Saring>('semua');
  const [kepadatan, setKepadatan] = useState<Kepadatan>(PENGATURAN_MATERI_AWAL.kepadatan);
  const [sumberSoal, setSumberSoal] = useState<SumberSoalMateri>('baru');
  const [jumlahSoal, setJumlahSoal] = useState(PENGATURAN_MATERI_AWAL.jumlahSoal);
  const [jumlahKuis, setJumlahKuis] = useState(PENGATURAN_MATERI_AWAL.jumlahKuis);
  const [decks, setDecks] = useState<Record<string, DeckMateri>>({});
  const [aktif, setAktif] = useState<string | null>(null);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [keJadi, setKeJadi] = useState(0);
  const [besar, setBesar] = useState(false);
  const [dialog, setDialog] = useState<null | { jenis: 'k2'; daftar: DeckMateri[] } | { jenis: 'timpa'; ids: string[] }>(null);
  const [sibuk, setSibuk] = useState(false);
  const imporRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    daftarDeckMateri().then((d) => {
      setDecks(Object.fromEntries(d.map((x) => [x.id, x])));
      const terbaru = [...d].sort((a, b) => b.diperbarui.localeCompare(a.diperbarui))[0];
      if (terbaru) { setAktif(terbaru.id); if (terbaru.naskah.kode) setKode(terbaru.naskah.kode as Kode); }
    }).catch((e: Error) => kabar(e.message, true));
  }, [kabar]);

  const subs = useMemo(() => daftarSubtema(data, tingkat, tanggalAcuan), [data, tingkat, tanggalAcuan]);
  const materi = useMemo(() => data.mapping.materi.map((m) => ({ kode: m.kode, nama: m.nama, subtema: subs.filter((s) => s.kode === m.kode) })).filter((m) => m.subtema.length), [data, subs]);
  const statusSub = useCallback((id: string) => (decks[id] ? decks[id].status : 'belum') as Saring, [decks]);
  const daftar = useMemo(() => subtemaLingkup(data, tanggalAcuan, lingkup, kode, tingkat, hanyaBaru)
    .map((s) => ({ ...s, id: idDeck(s.kode, s.subtema), status: statusSub(idDeck(s.kode, s.subtema)) })), [data, tanggalAcuan, lingkup, kode, tingkat, hanyaBaru, statusSub]);
  const hitung = (st: Saring) => daftar.filter((s) => st === 'semua' || s.status === st).length;
  const tampil = daftar.filter((s) => saring === 'semua' || s.status === saring);
  const dicentang = daftar.filter((s) => cek.has(s.id));
  const tabDeck = (dicentang.length ? dicentang.map((s) => decks[s.id]).filter(Boolean) : Object.values(decks).filter((d) => lingkup === 'tingkat' || d.naskah.kode === kode || !d.naskah.kode))
    .sort((a, b) => a.judul.localeCompare(b.judul));
  const nBaru = subs.filter((s) => s.tingkat === tingkat).length;

  // Ganti lingkup, materi, tingkat, atau saringan "hanya baru". Lingkup materi dan tingkat langsung mencentang
  // semua subtemanya; lingkup subtema mulai kosong saat materi atau lingkup berganti.
  const atur = (p: { l?: Lingkup; k?: Kode; t?: Tingkat; baru?: boolean }) => {
    const l = p.l ?? lingkup, t = p.t ?? tingkat, baru = p.baru ?? hanyaBaru;
    const adaKode = daftarSubtema(data, t, tanggalAcuan).map((s) => s.kode);
    const k = adaKode.includes(p.k ?? kode) ? p.k ?? kode : adaKode[0] ?? kode;
    setLingkup(l); setTingkat(t); setHanyaBaru(baru); setKode(k);
    if (l !== 'subtema') setCek(new Set(subtemaLingkup(data, tanggalAcuan, l, k, t, baru).map((s) => idDeck(s.kode, s.subtema))));
    else if (l !== lingkup || k !== kode) setCek(new Set());
  };
  const deck = aktif ? decks[aktif] ?? null : null;

  const jadi = useMemo(() => (deck ? tataLetak(deck.naskah, { tandaDraf: deck.status !== 'telaah' }) : []), [deck]);
  const jadiPer = useMemo(() => {
    const m = new Map<string, SlideJadi[]>();
    for (const j of jadi) m.set(j.asal, [...(m.get(j.asal) ?? []), j]);
    return m;
  }, [jadi]);
  const masalahTata = useMemo(() => periksaTataLetak(jadi), [jadi]);
  const slides = deck?.naskah.slides ?? [];
  const slide = slides.find((s) => s.id === dipilih) ?? slides[0] ?? null;
  const jadiSlide = slide ? jadiPer.get(slide.id) ?? [] : [];
  const jadiTampil = jadiSlide[Math.min(keJadi, Math.max(0, jadiSlide.length - 1))];

  useEffect(() => { setKeJadi(0); }, [dipilih, aktif]);

  const simpanDeck = useCallback((d: DeckMateri) => {
    setDecks((x) => ({ ...x, [d.id]: d }));
    simpanDeckMateri(d).catch((e: Error) => kabar(e.message, true));
  }, [kabar]);

  const susun = (ids: string[], timpa: boolean) => {
    const sudahDisunting = ids.filter((id) => decks[id] && decks[id].riwayat.length > 0);
    if (sudahDisunting.length && !timpa) { setDialog({ jenis: 'timpa', ids }); return; }
    setSibuk(true);
    // Jeda satu tik supaya tombol sempat menampilkan status sibuk sebelum puluhan deck disusun.
    setTimeout(() => {
      let dibuat = 0;
      const galat: string[] = [];
      try {
        for (const id of ids) {
          const s = subs.find((x) => idDeck(x.kode, x.subtema) === id);
          if (!s) continue;
          try {
            const peng = { ...PENGATURAN_MATERI_AWAL, kode: s.kode, subtema: s.subtema, tingkat, kepadatan, sumberSoal, jumlahSoal, jumlahKuis, tanggalAcuan, dibuat: sekarang() };
            simpanDeck(buatDeck(susunNaskah(data, peng), peng, peng.dibuat));
            dibuat++;
          } catch (e) { galat.push(s.subtema + ': ' + (e as Error).message); }
        }
        if (ids[0]) { setAktif(ids[0]); setDipilih(null); }
        if (galat.length) kabar(galat.join(' · '), true);
        else kabar(`${dibuat} deck disusun.`);
      } finally { setSibuk(false); }
    }, 0);
  };

  const ubahDeck = (f: (d: DeckMateri) => DeckMateri) => { if (deck) simpanDeck(f(deck)); };

  const unduhDeck = async (daftar: DeckMateri[], setuju: boolean) => {
    if (!daftar.length) return kabar('Belum ada deck untuk diunduh.', true);
    const draf = daftar.filter((d) => adaTeksAcuan(d.naskah) && d.status !== 'telaah');
    if (draf.length && !setuju) { setDialog({ jenis: 'k2', daftar }); return; }
    setSibuk(true);
    try {
      const dasar = await muatDasar();
      // Lebih dari satu materi: satu folder per kode di dalam .zip.
      const perFolder = new Set(daftar.map((d) => d.naskah.kode ?? 'impor')).size > 1;
      const berkas = daftar.map((d) => ({ nama: (perFolder ? (d.naskah.kode ?? 'impor') + '/' : '') + namaBerkas(d, 'pptx'), isi: tulisPptx(d.naskah, dasar, { ditelaah: d.status === 'telaah' }).berkas }));
      const namaZip = lingkup === 'tingkat' ? `materi-tingkat-${tingkat.toLowerCase()}${hanyaBaru && tingkat !== 'A' ? '-tambahan' : ''}` : `materi-${slug(kode)}`;
      if (berkas.length === 1) unduh(berkas[0].isi, namaBerkas(daftar[0], 'pptx'), MIME.pptx);
      // .pptx sudah terkompresi, jadi .zip cukup menyimpan tanpa kompresi ulang.
      else unduh(await zip(Object.fromEntries(berkas.map((b) => [b.nama, b.isi])), 0), `${namaZip}-${berkas.length}-deck.zip`, MIME.zip);
      kabar(`${berkas.length} deck diunduh${draf.length ? `; ${draf.length} bertanda Draf internal` : ''}.`);
    } catch (e) { kabar((e as Error).message, true); }
    finally { setSibuk(false); }
  };

  const unduhNaskah = () => {
    if (!deck) return;
    unduh(new TextEncoder().encode(JSON.stringify(deck.naskah, null, 2)), namaBerkas(deck, 'json').replace(/^materi-/, 'naskah-'), MIME.json);
  };
  const imporNaskah = async (f: File) => {
    try {
      const naskah = bacaNaskah(await f.text());
      const d = buatDeck(naskah, null, sekarang());
      simpanDeck(d); setAktif(d.id); setDipilih(null);
      kabar(`Naskah "${naskah.judul}" diimpor (${naskah.slides.length} slide).`);
    } catch (e) { kabar((e as Error).message, true); }
  };

  // Pemeriksaan slide terpilih.
  const cekSlide = useMemo<CekMutu[]>(() => {
    if (!slide || !deck) return [];
    const hasil: CekMutu[] = [];
    const lap = jadiSlide.flatMap((j) => j.laporan);
    const potong = lap.filter((l) => l.jenis === 'dipotong' || l.jenis === 'label-panjang');
    if (slide.sembunyi) hasil.push({ id: 'tata', level: 'info', judul: 'Tata letak', ket: 'slide disembunyikan, tidak ikut berkas' });
    else if (potong.length) hasil.push({ id: 'tata', level: 'peringatan', judul: 'Tata letak', ket: potong.map((l) => l.pesan).join('; ') });
    else hasil.push({ id: 'tata', level: 'lolos', judul: 'Tata letak', ket: jadiSlide.length > 1 ? `semua teks muat, dipecah menjadi ${jadiSlide.length} slide` : 'semua teks muat, huruf ≥ batas minimum' });
    const aturan = (slide.sumber ?? []).filter((x) => /^R-/.test(x)).map((id) => data.aturan.find((a) => a.id === id)).filter(Boolean);
    if (aturan.length) {
      const lewat = aturan.filter((a) => !berlakuPada(a!, deck.naskah.tanggalAcuan));
      hasil.push(lewat.length ? { id: 'berlaku', level: 'peringatan', judul: 'Aturan berlaku', ket: lewat.map((a) => a!.id).join(', ') + ' tidak berlaku pada ' + deck.naskah.tanggalAcuan } : { id: 'berlaku', level: 'lolos', judul: 'Aturan berlaku', ket: aturan.map((a) => a!.id).join(', ') + ' berlaku pada ' + deck.naskah.tanggalAcuan });
    }
    const lama = cariJebakan(teksSlide(slide), { kode: (deck.naskah.kode ?? 'KUP') as Kode, soal: '', kasus: null }, data.jebakan);
    hasil.push(lama.length ? { id: 'lama', level: 'peringatan', judul: 'Ketentuan lama', ket: lama.map((j) => j.pesan).join('; ') } : { id: 'lama', level: 'lolos', judul: 'Ketentuan lama', ket: 'tidak ada pola aturan lama' });
    const asal = slide.asal ?? 'otomatis';
    hasil.push({ id: 'asal', level: asal === 'acuan' && deck.status !== 'telaah' ? 'info' : 'lolos', judul: 'Asal teks', ket: asal === 'acuan' ? (deck.status === 'telaah' ? 'teks acuan, deck sudah ditelaah' : 'teks LatihUKP apa adanya; sunting untuk menjadikannya Ditulis ulang') : ASAL[asal].teks });
    return hasil;
  }, [slide, deck, jadiSlide, data]);

  // Pintasan J/K pindah slide, P perbesar (di luar kolom isian).
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (dialog || !deck || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      const i = slides.findIndex((s) => s.id === slide?.id);
      if (e.key === 'j' && i < slides.length - 1) setDipilih(slides[i + 1].id);
      else if (e.key === 'k' && i > 0) setDipilih(slides[i - 1].id);
      else if (e.key === 'p') setBesar((b) => !b);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [dialog, deck, slides, slide]);

  const nAcuan = slides.filter((s) => !s.sembunyi && s.asal === 'acuan').length;
  const nAturan = new Set(slides.flatMap((s) => (s.sumber ?? []).filter((x) => /^R-/.test(x)))).size;
  const deckDipilih = dicentang.map((s) => decks[s.id]).filter(Boolean);
  const totalSlide = deckDipilih.reduce((t, d) => t + tataLetak(d.naskah).length, 0);
  const nDraf = deckDipilih.filter((d) => adaTeksAcuan(d.naskah) && d.status !== 'telaah').length;
  const asliAda = !!(slide && deck?.asli.slides.some((s) => s.id === slide.id) && JSON.stringify(deck.asli.slides.find((s) => s.id === slide.id)) !== JSON.stringify(slide));

  return (
    <>
      <div className="halaman tata-materi">
        <aside className="panel kiri" aria-labelledby="mt-cakupan">
          <div className="panel-kepala"><h2 id="mt-cakupan" className="sub-judul" style={{ margin: 0 }}>Cakupan deck</h2></div>
          <div className="panel-isi">
            <Segmented label="Tingkat" nilai={tingkat} ubah={(t) => atur({ t })} pilihan={TINGKAT.map((t) => ({ nilai: t, label: singkatTingkat(t), judul: labelTingkat(t) }))} />
            <Segmented label="Lingkup" nilai={lingkup} ubah={(l) => atur({ l })} pilihan={[{ nilai: 'subtema', label: 'Subtema', judul: 'Pilih subtema satu per satu' }, { nilai: 'materi', label: 'Materi (kode)', judul: 'Semua subtema satu materi' }, { nilai: 'tingkat', label: 'Tingkat', judul: 'Semua subtema dalam cakupan tingkat' }]} />
            {lingkup !== 'tingkat' && (
              <div className="form">
                <label>Materi
                  <select value={kode} onChange={(e) => atur({ k: e.target.value as Kode })}>
                    {materi.map((m) => <option key={m.kode} value={m.kode}>{m.kode} · {m.nama} · {m.subtema.filter((s) => decks[idDeck(s.kode, s.subtema)]).length}/{m.subtema.length} disusun</option>)}
                  </select>
                </label>
              </div>
            )}
            {lingkup === 'tingkat' && tingkat !== 'A' && (
              <label className="cek"><input type="checkbox" checked={hanyaBaru} onChange={(e) => atur({ baru: e.target.checked })} style={{ width: 16, height: 16 }} />Hanya subtema baru di Tingkat {tingkat} ({nBaru}, {diujiDi(tingkat)})</label>
            )}
            <fieldset className="tanpa-bingkai">
              <legend className="label-kecil">Subtema (satu deck per subtema)</legend>
              <div className="chips" role="group" aria-label="Saring status subtema" style={{ marginBottom: 6 }}>
                {(['semua', 'belum', 'draf', 'telaah'] as Saring[]).map((st) => (
                  <button key={st} type="button" className="chip chip-kecil" aria-pressed={saring === st} onClick={() => setSaring(st)}>{st === 'semua' ? 'Semua' : st === 'belum' ? 'Belum' : st === 'draf' ? 'Draf' : 'Ditelaah'} {hitung(st)}</button>
                ))}
              </div>
              <div className="kecil" style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                <button type="button" className="btn-teks" disabled={dicentang.length === daftar.length} onClick={() => setCek(new Set(daftar.map((s) => s.id)))}>Pilih semua ({daftar.length})</button>
                <button type="button" className="btn-teks" disabled={!dicentang.length} onClick={() => setCek(new Set())}>Kosongkan</button>
              </div>
              <div className="daftar-subtema">
                {tampil.map((s, i) => (
                  <Fragment key={s.id}>
                    {lingkup === 'tingkat' && (i === 0 || tampil[i - 1].kode !== s.kode) && (
                      <div className="grup-subtema">{s.kode} · {data.mapping.materi.find((m) => m.kode === s.kode)?.nama}</div>
                    )}
                    <label>
                      <input type="checkbox" checked={cek.has(s.id)} onChange={() => setCek((c) => { const n = new Set(c); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} />
                      <span>
                        <span>{s.subtema}</span>
                        <span className="meta"><span className={STATUS[s.status === 'semua' ? 'belum' : s.status].kelas}>{STATUS[s.status === 'semua' ? 'belum' : s.status].teks}</span> <span className="mono redup">{diujiDi(s.tingkat)} · {s.aturan} aturan{s.kuis ? ' · kuis' : ''}{s.model + s.orisinal ? ' · soal baru' : ''}</span></span>
                      </span>
                    </label>
                  </Fragment>
                ))}
                {!tampil.length && <p className="redup kecil" style={{ margin: 8 }}>Tidak ada subtema dengan status ini.</p>}
              </div>
            </fieldset>
            <Segmented label="Kepadatan" nilai={kepadatan} ubah={setKepadatan} pilihan={[{ nilai: 'ringkas', label: 'Ringkas' }, { nilai: 'standar', label: 'Standar' }, { nilai: 'lengkap', label: 'Lengkap' }]} />
            <div className="form" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 120px' }}>Contoh soal
                <select value={jumlahSoal} onChange={(e) => setJumlahSoal(Number(e.target.value))}>
                  <option value={0}>Tanpa</option><option value={1}>1 soal</option><option value={2}>2 soal</option>
                </select>
              </label>
              <label style={{ flex: '1 1 120px' }}>Kuis B/S
                <select value={jumlahKuis} onChange={(e) => setJumlahKuis(Number(e.target.value))}>
                  <option value={0}>Tanpa</option><option value={3}>3 butir</option><option value={5}>5 butir</option>
                </select>
              </label>
              <label style={{ flex: '1 1 100%' }}>Sumber contoh soal
                <select value={sumberSoal} onChange={(e) => setSumberSoal(e.target.value as SumberSoalMateri)}>
                  <option value="baru">Model &amp; orisinal (bawaan)</option>
                  <option value="bank">Boleh bank acuan LatihUKP (Draf internal)</option>
                </select>
              </label>
            </div>
            <p className="kecil redup" style={{ margin: 0 }}>Aturan per <span className="mono">{tanggalAcuan}</span> (tanggal acuan di bilah atas).</p>
            <button type="button" className="btn btn-besar" style={{ background: 'var(--tinta)', color: '#fff', borderColor: 'var(--tinta)' }} disabled={!dicentang.length || sibuk} onClick={() => susun(dicentang.map((s) => s.id), false)}>{sibuk ? 'Memproses…' : `Susun naskah · ${dicentang.length} deck`}</button>
            <button type="button" className="btn btn-kecil" onClick={() => imporRef.current?.click()}>Impor naskah .json</button>
            <input ref={imporRef} type="file" accept="application/json,.json" className="tersembunyi" onChange={(e) => { const f = e.target.files?.[0]; if (f) imporNaskah(f); e.target.value = ''; }} />
          </div>
        </aside>

        <main className="tengah">
          {!deck && (
            <div className="kotak-info">
              <b>Belum ada deck terbuka.</b> Centang subtema di panel kiri lalu tekan <b>Susun naskah</b>. Naskah bisa disunting, dipratinjau, lalu diunduh sebagai .pptx bergaya template materi.
            </div>
          )}
          {deck && (
            <>
              <div className="baris-tab">
                {tabDeck.length > 6 ? (
                  // Banyak deck (lingkup materi/tingkat): pilihan deck sebagai daftar, bukan deretan tab.
                  <label className="form pilih-deck">Deck ({tabDeck.length})
                    <select value={deck.id} onChange={(e) => { setAktif(e.target.value); setDipilih(null); }}>
                      {!tabDeck.some((d) => d.id === deck.id) && <option value={deck.id}>{deck.judul}</option>}
                      {tabDeck.map((d) => <option key={d.id} value={d.id}>{d.naskah.kode ? d.naskah.kode + ' · ' : ''}{d.judul} · {STATUS[d.status].teks}</option>)}
                    </select>
                  </label>
                ) : (
                  <div role="tablist" aria-label="Deck tersusun" className="tab-deck">
                    {tabDeck.map((d) => (
                      <button key={d.id} type="button" role="tab" aria-selected={d.id === deck.id} onClick={() => { setAktif(d.id); setDipilih(null); }}>
                        {d.judul} <span className={STATUS[d.status].kelas}>{STATUS[d.status].teks}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="aksi-tab">
                  <button type="button" className="btn btn-kecil" disabled={!deck.riwayat.length} onClick={() => ubahDeck(urungkan)} title="Kembalikan versi sebelumnya">Urungkan ({deck.riwayat.length})</button>
                  <button type="button" className="btn btn-kecil" onClick={() => ubahDeck((d) => tandaiTelaah(d, d.status !== 'telaah', sekarang()))}>{deck.status === 'telaah' ? 'Kembalikan ke draf' : 'Tandai deck ditelaah'}</button>
                  <button type="button" className="btn btn-kecil" aria-pressed={besar} onClick={() => setBesar(!besar)} style={besar ? { background: 'var(--tinta)', color: '#fff' } : undefined}>{besar ? 'Kembali ke tabel' : 'Perbesar pratinjau'}</button>
                  <button type="button" className="btn btn-kecil" onClick={() => { hapusDeckMateri(deck.id).catch(() => undefined); setDecks((x) => { const n = { ...x }; delete n[deck.id]; return n; }); setAktif(null); kabar('Deck dihapus dari browser ini.'); }}>Hapus deck</button>
                </div>
              </div>

              <div className="strip strip-angka" aria-label="Ringkasan deck">
                <div><span className="angka">{jadi.length}</span>slide deck ini</div>
                <div><span className="angka" style={{ color: masalahTata.length ? 'var(--merah)' : 'var(--hijau)' }}>{masalahTata.length}</span>teks meluap</div>
                <div><span className="angka">{[...jadiPer.values()].filter((j) => j.length > 1).length}</span>bagian dipecah</div>
                <div><span className="angka">{nAcuan} / {slides.filter((s) => !s.sembunyi).length - nAcuan}</span>teks acuan / lainnya</div>
                <div><span className="angka">{nAturan}</span>aturan · per {deck.naskah.tanggalAcuan}</div>
                <div><span className="angka">{slides.filter((s) => s.pola === 'P12').length} · {slides.filter((s) => s.pola === 'P11').length}</span>contoh soal · kuis</div>
              </div>

              {!!deck.naskah.catatan?.length && (
                <details className="panel">
                  <summary className="panel-kepala" style={{ borderRadius: 6 }}><b>Catatan penyusun ({deck.naskah.catatan.length})</b><span className="redup kecil">aturan yang dikeluarkan, label yang dipendekkan, ketentuan lama</span></summary>
                  <ul className="kecil" style={{ margin: 0, padding: '10px 16px 10px 32px' }}>{deck.naskah.catatan.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </details>
              )}

              {besar && (
                <div className="film" aria-label="Deretan slide">
                  {jadi.map((j, i) => (
                    <button key={i} type="button" aria-current={slide?.id === j.asal && jadiTampil === j ? 'true' : undefined} onClick={() => { setDipilih(j.asal); setKeJadi(jadiPer.get(j.asal)?.indexOf(j) ?? 0); }}>
                      <PratinjauSlide slide={j} label={`Slide ${i + 1}: ${j.judul}`} />
                      <span className="kecil redup"><b className="mono">{i + 1}</b> {NAMA_POLA[j.pola]}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="dua-kolom">
                {!besar && (
                  <div className="utama kotak-tabel">
                    <table className="lembar">
                      <thead><tr><th>No</th><th>Tampil</th><th>Bagian</th><th>Pola</th><th>Judul slide</th><th>Sumber</th><th>Asal</th><th>Tata letak</th></tr></thead>
                      <tbody>
                        {slides.map((s, i) => {
                          const t = ringkasTata(jadiPer.get(s.id) ?? [], s.sembunyi);
                          const pilih = slide?.id === s.id;
                          return (
                            <tr key={s.id} className={'baris-klik' + (pilih ? ' pilih' : '')} onClick={() => setDipilih(s.id)} style={s.sembunyi ? { opacity: 0.55 } : undefined}>
                              <td className="mono" style={{ borderLeft: '3px solid ' + (pilih ? 'var(--aksen)' : 'transparent'), fontWeight: 600 }}>{i + 1}</td>
                              <td><input type="checkbox" aria-label={'Tampilkan slide ' + (i + 1)} checked={!s.sembunyi} onClick={(e) => e.stopPropagation()} onChange={() => ubahDeck((d) => aturSlide(d, { jenis: 'sembunyi', id: s.id }, sekarang()))} /></td>
                              <td className="redup" style={{ whiteSpace: 'nowrap' }}>{s.bagian ?? '—'}</td>
                              <td className="mono kecil" style={{ whiteSpace: 'nowrap' }}>{s.pola} {NAMA_POLA[s.pola]}</td>
                              <td><button type="button" className="btn-teks" style={{ color: 'var(--tinta)', padding: 0, textAlign: 'left', fontWeight: pilih ? 600 : 400 }} onClick={() => setDipilih(s.id)}>{s.judul}</button></td>
                              <td className="mono kecil redup" style={{ whiteSpace: 'nowrap' }}>{(s.sumber ?? []).slice(0, 2).join(', ')}{(s.sumber?.length ?? 0) > 2 ? '…' : ''}</td>
                              <td style={{ whiteSpace: 'nowrap' }}><span className={ASAL[s.asal ?? 'otomatis'].kelas}>{ASAL[s.asal ?? 'otomatis'].teks}</span></td>
                              <td className={'kecil ' + t.kelas} style={{ whiteSpace: 'nowrap' }}>{t.teks}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="kecil redup" style={{ padding: '8px 12px', borderTop: '1px solid var(--garis-muda)' }}>J/K pindah slide · P perbesar · centang Tampil untuk menyembunyikan slide dari berkas</div>
                  </div>
                )}
                {besar && jadiTampil && <div className="utama"><PratinjauSlide slide={jadiTampil} /></div>}

                {slide && (
                  <aside className="samping panel" aria-label={'Slide ' + (slides.indexOf(slide) + 1)}>
                    <div className="panel-kepala">
                      <span className="mono" style={{ fontWeight: 700 }}>Slide {slides.indexOf(slide) + 1}</span>
                      <span className="tag">{slide.pola} {NAMA_POLA[slide.pola]}</span>
                      <span className={ASAL[slide.asal ?? 'otomatis'].kelas}>{ASAL[slide.asal ?? 'otomatis'].teks}</span>
                    </div>
                    <div className="panel-isi">
                      {!besar && jadiTampil && <PratinjauSlide slide={jadiTampil} />}
                      {jadiSlide.length > 1 && (
                        <div className="kecil" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button type="button" className="btn btn-kecil" disabled={keJadi === 0} onClick={() => setKeJadi(keJadi - 1)}>‹</button>
                          <span>Bagian {Math.min(keJadi, jadiSlide.length - 1) + 1} dari {jadiSlide.length} (dipecah otomatis)</span>
                          <button type="button" className="btn btn-kecil" disabled={keJadi >= jadiSlide.length - 1} onClick={() => setKeJadi(keJadi + 1)}>›</button>
                        </div>
                      )}
                      <IsianSlide slide={slide} nav={deck.naskah.nav} simpan={(baru) => ubahDeck((d) => suntingSlide(d, slide.id, () => baru, sekarang()))} />
                      <section aria-label="Pemeriksaan slide ini">
                        <h3 className="sub-judul">Pemeriksaan slide ini</h3>
                        <DaftarMutu cek={cekSlide} />
                      </section>
                      {jadiTampil?.catatan && <div className="langkah-mono" style={{ whiteSpace: 'pre-line', padding: '8px 10px' }}><b>Catatan pembicara</b>{'\n'}{jadiTampil.catatan}</div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" className="btn btn-kecil" onClick={() => ubahDeck((d) => aturSlide(d, { jenis: 'naik', id: slide.id }, sekarang()))}>Naik</button>
                        <button type="button" className="btn btn-kecil" onClick={() => ubahDeck((d) => aturSlide(d, { jenis: 'turun', id: slide.id }, sekarang()))}>Turun</button>
                        <button type="button" className="btn btn-kecil" onClick={() => ubahDeck((d) => aturSlide(d, { jenis: 'gandakan', id: slide.id }, sekarang()))}>Gandakan</button>
                        <button type="button" className="btn btn-kecil" disabled={!asliAda} onClick={() => ubahDeck((d) => kembalikanSlide(d, slide.id, sekarang()))}>Kembalikan teks acuan</button>
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <div className="bawah">
        <div className="bawah-isi">
          <div className="mono kecil" style={{ color: 'var(--abu-2)' }}>{dicentang.length} subtema dipilih · {deckDipilih.length} deck tersusun · {totalSlide} slide · {nDraf} deck bertanda Draf internal</div>
          <div className="kanan">
            <button type="button" className="btn" disabled={!deck} onClick={unduhNaskah}>Naskah .json</button>
            <button type="button" className="btn" disabled={!deck || sibuk} onClick={() => deck && unduhDeck([deck], false)}>Unduh deck ini .pptx</button>
            <button type="button" className="btn btn-utama btn-besar" disabled={!deckDipilih.length || sibuk} onClick={() => unduhDeck(deckDipilih, false)}>{sibuk ? 'Memproses…' : `Unduh ${deckDipilih.length} deck${deckDipilih.length > 1 ? ' (.zip)' : ''}`}</button>
          </div>
        </div>
      </div>

      {dialog?.jenis === 'k2' && (
        <Dialog judul="Deck memuat teks acuan LatihUKP" tutup={() => setDialog(null)} kaki={<>
          <button type="button" className="btn" onClick={() => setDialog(null)}>Batal</button>
          <button type="button" className="btn btn-utama" onClick={() => { const d = dialog.daftar; setDialog(null); unduhDeck(d, true); }}>Unduh sebagai Draf internal</button>
        </>}>
          <p style={{ margin: 0 }}>{dialog.daftar.filter((d) => adaTeksAcuan(d.naskah) && d.status !== 'telaah').length} deck masih memuat slide berasal <b>teks acuan</b> LatihUKP yang belum ditulis ulang atau ditelaah (PRD-Materi KM2).</p>
          <ul className="kecil" style={{ margin: 0 }}>
            <li>Berkas diberi tanda <b>Draf internal</b> di properti berkas dan catatan pembicara.</li>
            <li>Jangan bagikan ke peserta sebelum slide acuan ditulis ulang, atau deck ditandai <b>Ditelaah</b>.</li>
          </ul>
        </Dialog>
      )}
      {dialog?.jenis === 'timpa' && (
        <Dialog judul="Susun ulang deck yang sudah disunting?" tutup={() => setDialog(null)} kaki={<>
          <button type="button" className="btn" onClick={() => { const ids = dialog.ids.filter((id) => !decks[id]?.riwayat.length); setDialog(null); if (ids.length) susun(ids, true); }}>Lewati yang disunting</button>
          <button type="button" className="btn btn-utama" onClick={() => { const ids = dialog.ids; setDialog(null); susun(ids, true); }}>Susun ulang semua</button>
        </>}>
          <p style={{ margin: 0 }}>{dialog.ids.filter((id) => decks[id]?.riwayat.length).length} deck sudah disunting. Menyusun ulang mengganti suntingan dengan naskah baru dari data.</p>
        </Dialog>
      )}
    </>
  );
}
