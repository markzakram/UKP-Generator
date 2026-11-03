'use client';
// Tab Materi (desain B+ Materi, PRD-Materi bagian 19): cakupan deck, naskah sebagai tabel slide,
// pratinjau yang sama dengan .pptx, isian per pola, pemeriksaan, dan unduhan dengan konfirmasi Draf internal.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { periksaTataLetak } from '@/lib/materi/cek';
import { aturSlide, bacaNaskah, buatDeck, idDeck, idGabungan, kembalikanSlide, suntingSlide, tandaiTelaah, telaahSlide, terapkanLembarTelaah, urungkan, type DeckMateri } from '@/lib/materi/deck';
import { bacaLembarTelaah, LABEL_TELAAH, lembarTelaah, perluTelaah, ringkasTelaah } from '@/lib/materi/telaah';
import type { SlideJadi } from '@/lib/materi/kotak';
import { adaTeksAcuan, NAMA_POLA, type AsalBlok, type SlideNaskah } from '@/lib/materi/naskah';
import { tulisPptx } from '@/lib/materi/pptx';
import { naskahHandout } from '@/lib/materi/handout';
import { diujiDi, labelTingkat, singkatTingkat, TINGKAT } from '@/lib/config';
import { berlakuPada, daftarSubtema, PENGATURAN_MATERI_AWAL, susunNaskah, susunNaskahMateri, teksSlide, type Kepadatan, type SumberSoalMateri } from '@/lib/materi/susun';
import { tataLetak } from '@/lib/materi/tata-letak';
import { lembarSilabus, namaBerkasSilabus, PILIHAN_MENIT_PERTEMUAN, ringkasSilabus, susunSilabus, type Silabus } from '@/lib/materi/silabus';
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
/** Label status deck: Draf internal hanya bila masih ada teks acuan yang belum ditelaah (KM2); selain itu Belum ditelaah. */
const statusDeck = (d?: DeckMateri) => (!d ? STATUS.belum : d.status === 'telaah' ? STATUS.telaah : adaTeksAcuan(d.naskah) ? STATUS.draf : { teks: 'Belum ditelaah', kelas: 'tag' });

let dasarCache: Promise<Uint8Array> | null = null;
const muatDasar = () => (dasarCache ??= fetch('/materi/dasar.pptx').then((r) => {
  if (!r.ok) throw new Error('Paket dasar materi tidak dapat dimuat. Jalankan npm run materi:dasar.');
  return r.arrayBuffer();
}).then((b) => new Uint8Array(b)).catch((e) => { dasarCache = null; throw e; }));

type FormatEkspor = 'pptx' | 'json' | 'keduanya';
const LABEL_FORMAT: Record<FormatEkspor, string> = { pptx: '.pptx', json: 'naskah .json', keduanya: '.pptx + naskah .json' };

const namaBerkas = (d: DeckMateri, ext: string) => d.id.startsWith('gabung:')
  ? `materi-${slug(d.naskah.kode ?? 'impor')}-tingkat-${(d.naskah.tingkat ?? '').toLowerCase()}${d.id.endsWith('+baru') ? '-tambahan' : ''}.${ext}`
  : `materi-${slug(d.naskah.kode ?? 'impor')}-${slug(d.naskah.subtema ?? d.judul)}.${ext}`;
const namaNaskah = (d: DeckMateri) => namaBerkas(d, 'json').replace(/^materi-/, 'naskah-');
type IsiEkspor = 'lengkap' | 'handout';
const sekarang = () => new Date().toISOString();
/** Subtema deck (KODE::Subtema) untuk paket latihan: deck subtema satu, deck gabungan semua yang digabung. */
const subtemaDeck = (d: DeckMateri) => {
  const k = d.pengaturan?.kode ?? d.naskah.kode;
  const sub = d.pengaturan?.gabung ?? (d.pengaturan?.subtema ? [d.pengaturan.subtema] : []);
  return k ? sub.map((s) => k + '::' + s) : [];
};
const KUNCI_PENELAAH = 'ukp-materi-penelaah';

function ringkasTata(js: SlideJadi[], sembunyi?: boolean): { teks: string; kelas: string } {
  if (sembunyi) return { teks: 'disembunyikan', kelas: 'redup' };
  const lap = js.flatMap((j) => j.laporan);
  if (lap.some((l) => l.jenis === 'dipotong' || l.jenis === 'label-panjang')) return { teks: 'label dipotong', kelas: 'st-catatan' };
  if (js.length > 1) return { teks: `dipecah → ${js.length} slide`, kelas: 'st-catatan' };
  const kecil = lap.find((l) => l.jenis === 'diperkecil');
  if (kecil) return { teks: 'diperkecil · ' + (kecil.pesan.match(/(\d+) pt/)?.[1] ?? '') + ' pt', kelas: 'redup' };
  return { teks: 'muat', kelas: 'st-lolos' };
}

/** Subtema yang dibuka dari saran remedial Uji peserta (R8). */
export interface FokusMateri { kode: Kode; subtema: string; tingkat: Tingkat }

export default function TabMateri({ data, tanggalAcuan, kabar, fokus, selesaiFokus, latihan }: {
  data: DataUkp; tanggalAcuan: string; kabar: (p: string, galat?: boolean) => void;
  fokus?: FokusMateri | null; selesaiFokus?: () => void; latihan?: (subtema: string[], tingkat: Tingkat) => void;
}) {
  const [tingkat, setTingkat] = useState<Tingkat>(fokus?.tingkat ?? PENGATURAN_MATERI_AWAL.tingkat);
  const [kode, setKode] = useState<Kode>(fokus?.kode ?? 'PP');
  const [lingkup, setLingkup] = useState<Lingkup>('subtema');
  const [hanyaBaru, setHanyaBaru] = useState(false);
  const [menitPertemuan, setMenitPertemuan] = useState(90);
  const [silabus, setSilabus] = useState<Silabus | null>(null);
  const [bentuk, setBentuk] = useState<'subtema' | 'materi'>('subtema');
  const [cek, setCek] = useState<Set<string>>(() => new Set(fokus ? [idDeck(fokus.kode, fokus.subtema)] : []));
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
  const [dialog, setDialog] = useState<null | { jenis: 'k2'; daftar: DeckMateri[]; format: FormatEkspor } | { jenis: 'timpa'; ids: string[] }>(null);
  const [formatEkspor, setFormatEkspor] = useState<FormatEkspor>('pptx');
  const [isiEkspor, setIsiEkspor] = useState<IsiEkspor>('lengkap');
  const [saringSlide, setSaringSlide] = useState<'semua' | 'belum' | 'ubah'>('semua');
  const [penelaah, setPenelaah] = useState(() => { try { return typeof window === 'undefined' ? '' : localStorage.getItem(KUNCI_PENELAAH) ?? ''; } catch { return ''; } });
  const imporTelaahRef = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const imporRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    daftarDeckMateri().then((d) => {
      setDecks(Object.fromEntries(d.map((x) => [x.id, x])));
      // Dibuka dari saran remedial: deck subtema itu (bila sudah ada) dan centangnya; selain itu deck terbaru.
      const idFokus = fokus ? idDeck(fokus.kode, fokus.subtema) : null;
      if (idFokus) { if (d.some((x) => x.id === idFokus)) setAktif(idFokus); selesaiFokus?.(); return; }
      const terbaru = [...d].sort((a, b) => b.diperbarui.localeCompare(a.diperbarui))[0];
      if (terbaru) { setAktif(terbaru.id); if (terbaru.naskah.kode) setKode(terbaru.naskah.kode as Kode); }
    }).catch((e: Error) => kabar(e.message, true));
    // Hanya saat dimuat: fokus dipakai sekali.
  }, [kabar]);

  const subs = useMemo(() => daftarSubtema(data, tingkat, tanggalAcuan), [data, tingkat, tanggalAcuan]);
  const materi = useMemo(() => data.mapping.materi.map((m) => ({ kode: m.kode, nama: m.nama, subtema: subs.filter((s) => s.kode === m.kode) })).filter((m) => m.subtema.length), [data, subs]);
  const statusSub = useCallback((id: string) => (decks[id] ? decks[id].status : 'belum') as Saring, [decks]);
  const daftar = useMemo(() => subtemaLingkup(data, tanggalAcuan, lingkup, kode, tingkat, hanyaBaru)
    .map((s) => ({ ...s, id: idDeck(s.kode, s.subtema), status: statusSub(idDeck(s.kode, s.subtema)) })), [data, tanggalAcuan, lingkup, kode, tingkat, hanyaBaru, statusSub]);
  const hitung = (st: Saring) => daftar.filter((s) => st === 'semua' || s.status === st).length;
  const tampil = daftar.filter((s) => saring === 'semua' || s.status === saring);
  const dicentang = daftar.filter((s) => cek.has(s.id));
  // Bentuk "materi": subtema yang dicentang digabung menjadi satu deck per materi untuk tingkat ini.
  const gabung = bentuk === 'materi';
  const tambahan = lingkup === 'tingkat' && hanyaBaru && tingkat !== 'A';
  const kodeDari = (idSub: string) => idSub.split('|')[0] as Kode;
  const target = (idSub: string) => (gabung ? idGabungan(kodeDari(idSub), tingkat, tambahan) : idSub);
  const idDipilih = [...new Set(dicentang.map((s) => target(s.id)))];
  const deckDipilih = idDipilih.map((id) => decks[id]).filter(Boolean);
  const tabDeck = (deckDipilih.length ? deckDipilih : Object.values(decks).filter((d) => (gabung
    ? d.id.startsWith('gabung:') && (lingkup === 'tingkat' || d.naskah.kode === kode)
    : !d.id.startsWith('gabung:') && (lingkup === 'tingkat' || d.naskah.kode === kode || !d.naskah.kode))))
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

  /** Susun deck untuk `ids` (id subtema yang dicentang): per subtema atau satu deck gabungan per materi. */
  const bangunDeck = (ids: string[]) => {
    const hasil: DeckMateri[] = [];
    const galat: string[] = [];
    const dasar = { ...PENGATURAN_MATERI_AWAL, tingkat, kepadatan, sumberSoal, jumlahSoal, jumlahKuis, tanggalAcuan };
    const simpan = (d: DeckMateri) => { simpanDeck(d); hasil.push(d); };
    if (gabung) {
      for (const k of [...new Set(ids.map(kodeDari))]) {
        const daftarSub = subs.filter((x) => x.kode === k && ids.includes(idDeck(x.kode, x.subtema))).map((x) => x.subtema);
        try {
          const peng = { ...dasar, kode: k, subtema: '', gabung: daftarSub, dibuat: sekarang() };
          simpan(buatDeck(susunNaskahMateri(data, peng, daftarSub), peng, peng.dibuat, idGabungan(k, tingkat, tambahan)));
        } catch (e) { galat.push(k + ': ' + (e as Error).message); }
      }
    } else {
      for (const id of ids) {
        const s = subs.find((x) => idDeck(x.kode, x.subtema) === id);
        if (!s) continue;
        try {
          const peng = { ...dasar, kode: s.kode, subtema: s.subtema, dibuat: sekarang() };
          simpan(buatDeck(susunNaskah(data, peng), peng, peng.dibuat));
        } catch (e) { galat.push(s.subtema + ': ' + (e as Error).message); }
      }
    }
    return { hasil, galat };
  };

  const susun = (ids: string[], timpa: boolean) => {
    const sudahDisunting = [...new Set(ids.map(target))].filter((id) => decks[id] && decks[id].riwayat.length > 0);
    if (sudahDisunting.length && !timpa) { setDialog({ jenis: 'timpa', ids }); return; }
    setSibuk(true);
    // Jeda satu tik supaya tombol sempat menampilkan status sibuk sebelum puluhan deck disusun.
    setTimeout(() => {
      try {
        const { hasil, galat } = bangunDeck(ids);
        if (ids[0]) { setAktif(target(ids[0])); setDipilih(null); }
        if (galat.length) kabar(galat.join(' · '), true);
        else kabar(`${hasil.length} deck disusun.`);
      } finally { setSibuk(false); }
    }, 0);
  };

  const ubahDeck = (f: (d: DeckMateri) => DeckMateri) => { if (deck) simpanDeck(f(deck)); };

  /**
   * Unduh deck dalam format terpilih. Satu berkas langsung; lebih dari satu berkas dibungkus .zip
   * (folder per kode bila lebih dari satu materi). .pptx bertek acuan meminta konfirmasi Draf internal (KM2).
   */
  const unduhDeck = async (daftar: DeckMateri[], setuju: boolean, format: FormatEkspor = formatEkspor) => {
    if (!daftar.length) return kabar('Belum ada deck untuk diunduh.', true);
    const pakaiPptx = format !== 'json';
    const draf = pakaiPptx ? daftar.filter((d) => adaTeksAcuan(d.naskah) && d.status !== 'telaah') : [];
    if (draf.length && !setuju) { setDialog({ jenis: 'k2', daftar, format }); return; }
    setSibuk(true);
    try {
      const dasar = pakaiPptx ? await muatDasar() : new Uint8Array();
      const semuaGabung = daftar.every((d) => d.id.startsWith('gabung:'));
      const perFolder = !semuaGabung && new Set(daftar.map((d) => d.naskah.kode ?? 'impor')).size > 1;
      const berkas: { nama: string; isi: Uint8Array; mime: string }[] = [];
      for (const d of daftar) {
        const folder = perFolder ? (d.naskah.kode ?? 'impor') + '/' : '';
        // Handout peserta (R9): rangkuman, rumus, dan kuis tanpa catatan pembicara; naskah .json tetap lengkap.
        if (pakaiPptx) berkas.push(isiEkspor === 'handout'
          ? { nama: folder + namaBerkas(d, 'pptx').replace(/\.pptx$/, '-handout.pptx'), isi: tulisPptx(naskahHandout(d.naskah), dasar, { ditelaah: d.status === 'telaah', tanpaCatatan: true }).berkas, mime: MIME.pptx }
          : { nama: folder + namaBerkas(d, 'pptx'), isi: tulisPptx(d.naskah, dasar, { ditelaah: d.status === 'telaah' }).berkas, mime: MIME.pptx });
        if (format !== 'pptx') berkas.push({ nama: folder + namaNaskah(d), isi: new TextEncoder().encode(JSON.stringify(d.naskah, null, 2)), mime: MIME.json });
      }
      const namaZip = (lingkup === 'tingkat' ? `materi-tingkat-${tingkat.toLowerCase()}${tambahan ? '-tambahan' : ''}` : `materi-${slug(kode)}`)
        + (semuaGabung ? '-per-materi' : '') + `-${daftar.length}-deck` + (format === 'json' ? '-naskah' : '');
      if (berkas.length === 1) unduh(berkas[0].isi, berkas[0].nama.split('/').pop() ?? berkas[0].nama, berkas[0].mime);
      // .pptx sudah terkompresi, jadi .zip cukup menyimpan tanpa kompresi ulang.
      else unduh(await zip(Object.fromEntries(berkas.map((b) => [b.nama, b.isi])), pakaiPptx ? 0 : 6), namaZip + '.zip', MIME.zip);
      kabar(`${daftar.length} deck diunduh (${pakaiPptx && isiEkspor === 'handout' ? 'handout peserta, ' : ''}${LABEL_FORMAT[format]}${berkas.length > 1 ? ', .zip' : ''})${draf.length ? `; ${draf.length} bertanda Draf internal` : ''}.`);
    } catch (e) { kabar((e as Error).message, true); }
    finally { setSibuk(false); }
  };

  // Ekspor dari panel Cakupan: deck terpilih yang belum tersusun disusun dulu, lalu semua diunduh sekaligus.
  // Deck yang sudah ada (termasuk yang disunting) diunduh apa adanya.
  const nBelum = idDipilih.filter((id) => !decks[id]).length;
  const ekspor = () => {
    if (!idDipilih.length) return;
    setSibuk(true);
    setTimeout(() => {
      let siap: DeckMateri[] = [];
      try {
        const idBelum = dicentang.filter((s) => !decks[target(s.id)]).map((s) => s.id);
        const { hasil, galat } = idBelum.length ? bangunDeck(idBelum) : { hasil: [] as DeckMateri[], galat: [] as string[] };
        if (galat.length) kabar(galat.join(' · '), true);
        siap = idDipilih.map((id) => decks[id] ?? hasil.find((d) => d.id === id)).filter((d): d is DeckMateri => !!d);
        if (!aktif && siap[0]) setAktif(siap[0].id);
      } finally { setSibuk(false); }
      unduhDeck(siap, false);
    }, 0);
  };
  const labelEkspor = `${nBelum ? 'Susun & unduh' : 'Unduh'} ${idDipilih.length} deck${idDipilih.length * (formatEkspor === 'keduanya' ? 2 : 1) > 1 ? ' (.zip)' : ''}`;
  const nKode = new Set(dicentang.map((s) => s.kode)).size;
  const mb = Math.round(idDipilih.length * (formatEkspor === 'json' ? 0.05 : gabung ? 2.8 : 2.4));
  const ringkasEkspor = !idDipilih.length ? 'Centang subtema dulu.'
    : `${idDipilih.length} deck ${LABEL_FORMAT[formatEkspor]} → ${idDipilih.length * (formatEkspor === 'keduanya' ? 2 : 1) > 1 ? `satu .zip${!gabung && nKode > 1 ? `, ${nKode} folder per kode` : ''}` : 'satu berkas'}, sekitar ${mb < 1 ? '< 1' : mb} MB.`
      + (nBelum ? ` ${nBelum} deck belum tersusun dan akan disusun dulu.` : '');

  const unduhNaskah = () => {
    if (!deck) return;
    unduh(new TextEncoder().encode(JSON.stringify(deck.naskah, null, 2)), namaNaskah(deck), MIME.json);
  };
  const rt = deck ? ringkasTelaah(deck.naskah) : null;
  const tandaiSlide = (status: 'sesuai' | 'ubah' | null, catatan?: string) => {
    if (!deck || !slide) return;
    const lama = slide.telaah;
    ubahDeck((d) => telaahSlide(d, slide.id, status ? { status, catatan: (catatan ?? lama?.catatan) || undefined, oleh: penelaah || undefined, waktu: sekarang() } : null, sekarang()));
  };
  const unduhLembarTelaah = () => {
    const daftar = deckDipilih.length ? deckDipilih : deck ? [deck] : [];
    if (!daftar.length) return kabar('Belum ada deck untuk ditelaah.', true);
    unduh(lembarTelaah(daftar), `telaah-${daftar.length === 1 ? namaBerkas(daftar[0], 'xlsx').replace(/^materi-/, '') : `${daftar.length}-deck.xlsx`}`, MIME.xlsx);
    kabar(`Lembar telaah ${daftar.length} deck diunduh. Isi kolom Status dan Catatan, lalu impor kembali.`);
  };
  const imporLembarTelaah = async (f: File) => {
    try {
      const baris = bacaLembarTelaah(new Uint8Array(await f.arrayBuffer()));
      const hasil = terapkanLembarTelaah(decks, baris, sekarang());
      hasil.decks.forEach(simpanDeck);
      kabar(`Lembar telaah diimpor: ${hasil.diterapkan} slide diperbarui di ${hasil.decks.length} deck, ${hasil.dilewati} baris dilewati (kosong, sama, atau deck tidak ada di browser ini).`);
    } catch (e) { kabar((e as Error).message, true); }
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

  // Silabus per tingkat (R7): deck gabungan per materi; deck gabungan yang sudah disunting di browser ikut dipakai.
  const unduhSilabus = () => {
    try {
      const s = susunSilabus(data, { tingkat, hanyaBaru: tambahan, menitPertemuan, deck: { ...PENGATURAN_MATERI_AWAL, kepadatan, sumberSoal, jumlahSoal, jumlahKuis, tanggalAcuan, dibuat: sekarang() } },
        (k) => decks[idGabungan(k, tingkat, tambahan)]?.naskah);
      setSilabus(s);
      unduh(lembarSilabus(s), namaBerkasSilabus(s), MIME.xlsx);
      kabar('Silabus diunduh. ' + ringkasSilabus(s) + '.');
    } catch (e) { kabar((e as Error).message, true); }
  };
  const nAcuan = slides.filter((s) => !s.sembunyi && s.asal === 'acuan').length;
  const nAturan = new Set(slides.flatMap((s) => (s.sumber ?? []).filter((x) => /^R-/.test(x)))).size;
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
            <Segmented label="Lingkup" nilai={lingkup} ubah={(l) => atur({ l })} pilihan={[{ nilai: 'subtema', label: 'Subtema', judul: 'Pilih subtema satu per satu' }, { nilai: 'materi', label: 'Materi', judul: 'Semua subtema satu materi (kode)' }, { nilai: 'tingkat', label: 'Tingkat', judul: 'Semua subtema dalam cakupan tingkat' }]} />
            <Segmented label="Bentuk deck" nilai={bentuk} ubah={setBentuk} pilihan={[{ nilai: 'subtema', label: 'Per subtema', judul: 'Satu deck per subtema' }, { nilai: 'materi', label: 'Per materi', judul: 'Subtema yang dicentang digabung menjadi satu deck per materi untuk tingkat ini' }]} />
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
              <legend className="label-kecil">Subtema ({gabung ? 'digabung jadi satu deck per materi' : 'satu deck per subtema'})</legend>
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
                        <span className="meta"><span className={statusDeck(decks[s.id]).kelas}>{statusDeck(decks[s.id]).teks}</span> <span className="mono redup">{diujiDi(s.tingkat)} · {s.aturan} aturan{s.kuis ? ' · kuis' : ''}{s.model + s.orisinal ? ' · soal baru' : ''}</span></span>
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
            <button type="button" className="btn btn-besar" style={{ background: 'var(--tinta)', color: '#fff', borderColor: 'var(--tinta)' }} disabled={!dicentang.length || sibuk} onClick={() => susun(dicentang.map((s) => s.id), false)}>{sibuk ? 'Memproses…' : `Susun naskah · ${idDipilih.length} deck`}</button>
            <section className="ekspor-materi" aria-labelledby="mt-ekspor">
              <h3 id="mt-ekspor" className="label-kecil" style={{ margin: 0 }}>Ekspor</h3>
              <Segmented label="Format" nilai={formatEkspor} ubah={setFormatEkspor} pilihan={[{ nilai: 'pptx', label: '.pptx', judul: 'Deck PowerPoint' }, { nilai: 'json', label: '.json', judul: 'Naskah .json (bisa diimpor lagi)' }, { nilai: 'keduanya', label: 'Keduanya', judul: '.pptx dan naskah .json' }]} />
              <Segmented label="Isi .pptx" nilai={isiEkspor} ubah={setIsiEkspor} pilihan={[{ nilai: 'lengkap', label: 'Deck lengkap', judul: 'Semua slide beserta catatan pembicara' }, { nilai: 'handout', label: 'Handout peserta', judul: 'Versi ringkas untuk peserta: rangkuman, rumus, dan kuis, tanpa catatan pembicara' }]} />
              <p className="kecil redup" style={{ margin: 0 }}>{ringkasEkspor}{isiEkspor === 'handout' ? ' Handout: rangkuman, rumus, dan kuis tanpa catatan pembicara. PDF lewat CLI --pdf (Windows dengan PowerPoint).' : ''}</p>
              <button type="button" className="btn btn-utama btn-besar" disabled={!idDipilih.length || sibuk} onClick={ekspor}>{sibuk ? 'Memproses…' : labelEkspor}</button>
            </section>
            <section className="ekspor-materi" aria-labelledby="mt-silabus">
              <h3 id="mt-silabus" className="label-kecil" style={{ margin: 0 }}>Silabus {labelTingkat(tingkat)}{tambahan ? ' · subtema baru' : ''}</h3>
              <div className="form"><label>Durasi per pertemuan
                <select value={menitPertemuan} onChange={(e) => { setMenitPertemuan(Number(e.target.value)); setSilabus(null); }}>
                  {PILIHAN_MENIT_PERTEMUAN.map((m) => <option key={m} value={m}>{m} menit ({(m / 45).toFixed(1).replace('.', ',').replace(/,0$/, '')} JP)</option>)}
                </select>
              </label></div>
              <p className="kecil redup" style={{ margin: 0 }}>{silabus && silabus.tingkat === tingkat && silabus.menitPertemuan === menitPertemuan ? ringkasSilabus(silabus) : 'Deck gabungan per materi; durasi dihitung dari jumlah slide menurut kepadatan, contoh soal, dan kuis di atas.'}</p>
              <button type="button" className="btn btn-besar" disabled={sibuk} onClick={unduhSilabus}>Unduh silabus .xlsx</button>
            </section>
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
                      {tabDeck.map((d) => <option key={d.id} value={d.id}>{d.naskah.kode ? d.naskah.kode + ' · ' : ''}{d.judul} · {statusDeck(d).teks}</option>)}
                    </select>
                  </label>
                ) : (
                  <div role="tablist" aria-label="Deck tersusun" className="tab-deck">
                    {tabDeck.map((d) => (
                      <button key={d.id} type="button" role="tab" aria-selected={d.id === deck.id} onClick={() => { setAktif(d.id); setDipilih(null); }}>
                        {d.judul} <span className={statusDeck(d).kelas}>{statusDeck(d).teks}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="aksi-tab">
                  <button type="button" className="btn btn-kecil" disabled={!deck.riwayat.length} onClick={() => ubahDeck(urungkan)} title="Kembalikan versi sebelumnya">Urungkan ({deck.riwayat.length})</button>
                  <button type="button" className="btn btn-kecil" title={rt ? `${rt.sesuai} dari ${rt.perlu} slide ditelaah sesuai` : undefined} onClick={() => ubahDeck((d) => tandaiTelaah(d, d.status !== 'telaah', sekarang()))}>{deck.status === 'telaah' ? 'Kembalikan ke draf' : `Tandai deck ditelaah${rt && !rt.lengkap ? ` (${rt.sesuai}/${rt.perlu})` : ''}`}</button>
                  {latihan && subtemaDeck(deck).length > 0 && <button type="button" className="btn btn-kecil" title="Rakit paket latihan (20 soal, turun bila stok kurang) dari subtema deck ini, lalu buka di Hasil paket" onClick={() => latihan(subtemaDeck(deck), (deck.pengaturan?.tingkat ?? deck.naskah.tingkat ?? tingkat) as Tingkat)}>Buat latihan{subtemaDeck(deck).length > 1 ? ` (${subtemaDeck(deck).length} subtema)` : ''}</button>}
                  <button type="button" className="btn btn-kecil" onClick={unduhLembarTelaah} title="Lembar Excel untuk penelaah di luar aplikasi; deck yang dicentang, atau deck ini">Lembar telaah .xlsx</button>
                  <button type="button" className="btn btn-kecil" onClick={() => imporTelaahRef.current?.click()}>Impor lembar telaah</button>
                  <input ref={imporTelaahRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="tersembunyi" onChange={(e) => { const f = e.target.files?.[0]; if (f) imporLembarTelaah(f); e.target.value = ''; }} />
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
                {rt && <div><span className="angka" style={{ color: rt.lengkap ? 'var(--hijau)' : rt.ubah ? 'var(--merah)' : undefined }}>{rt.sesuai} / {rt.perlu}</span>slide ditelaah{rt.ubah ? ` · ${rt.ubah} perlu diubah` : ''}</div>}
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
                    {rt && (
                      <div className="chips" role="group" aria-label="Saring slide menurut telaah" style={{ padding: '8px 12px', borderBottom: '1px solid var(--garis-muda)' }}>
                        {([['semua', `Semua ${slides.length}`], ['belum', `Belum ditelaah ${rt.belum}`], ['ubah', `Perlu diubah ${rt.ubah}`]] as const).map(([k, l]) => (
                          <button key={k} type="button" className="chip chip-kecil" aria-pressed={saringSlide === k} onClick={() => setSaringSlide(k)}>{l}</button>
                        ))}
                      </div>
                    )}
                    <table className="lembar">
                      <thead><tr><th>No</th><th>Tampil</th><th>Bagian</th><th>Pola</th><th>Judul slide</th><th>Sumber</th><th>Asal</th><th>Tata letak</th></tr></thead>
                      <tbody>
                        {slides.map((s, i) => {
                          if (saringSlide === 'belum' && !(perluTelaah(s) && !s.telaah)) return null;
                          if (saringSlide === 'ubah' && s.telaah?.status !== 'ubah') return null;
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
                              <td style={{ whiteSpace: 'nowrap' }}><span className={ASAL[s.asal ?? 'otomatis'].kelas}>{ASAL[s.asal ?? 'otomatis'].teks}</span>{s.telaah && <> <span className={s.telaah.status === 'sesuai' ? 'tag tag-tulis' : 'tag tag-salah'} title={s.telaah.catatan}>{s.telaah.status === 'sesuai' ? '✓ Sesuai' : 'Perlu diubah'}</span></>}</td>
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
                      <IsianSlide slide={slide} nav={slide.nav ?? deck.naskah.nav} simpan={(baru) => ubahDeck((d) => suntingSlide(d, slide.id, () => baru, sekarang()))} />
                      {perluTelaah(slide) && (
                        <section aria-label="Telaah slide ini" className="telaah-slide">
                          <h3 className="sub-judul" style={{ margin: 0 }}>Telaah slide ini</h3>
                          <div className="seg" role="group" aria-label="Hasil telaah">
                            <button type="button" aria-pressed={slide.telaah?.status === 'sesuai'} onClick={() => tandaiSlide(slide.telaah?.status === 'sesuai' ? null : 'sesuai')}>✓ Sesuai</button>
                            <button type="button" aria-pressed={slide.telaah?.status === 'ubah'} onClick={() => tandaiSlide(slide.telaah?.status === 'ubah' ? null : 'ubah')}>Perlu diubah</button>
                          </div>
                          <label className="form">Catatan penelaah
                            <textarea key={slide.id + (slide.telaah?.waktu ?? '')} rows={2} defaultValue={slide.telaah?.catatan ?? ''} placeholder="Apa yang perlu diperbaiki, atau dasar hukum yang dicek" onBlur={(e) => { const v = e.target.value.trim(); if (v !== (slide.telaah?.catatan ?? '')) tandaiSlide(slide.telaah?.status ?? 'ubah', v); }} />
                          </label>
                          <label className="form">Nama penelaah
                            <input value={penelaah} onChange={(e) => { setPenelaah(e.target.value); try { localStorage.setItem(KUNCI_PENELAAH, e.target.value); } catch { /* penyimpanan browser tidak tersedia */ } }} placeholder="Dipakai untuk telaah berikutnya" />
                          </label>
                          {slide.telaah && <p className="kecil redup" style={{ margin: 0 }}>{LABEL_TELAAH[slide.telaah.status]}{slide.telaah.oleh ? ` · ${slide.telaah.oleh}` : ''} · {new Date(slide.telaah.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}. Menyunting isi slide menghapus hasil telaah.</p>}
                        </section>
                      )}
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
            <button type="button" className="btn" disabled={!deck || sibuk} onClick={() => deck && unduhDeck([deck], false, 'pptx')}>Unduh deck ini .pptx</button>
            <button type="button" className="btn btn-utama btn-besar" disabled={!idDipilih.length || sibuk} onClick={ekspor}>{sibuk ? 'Memproses…' : labelEkspor}</button>
          </div>
        </div>
      </div>

      {dialog?.jenis === 'k2' && (
        <Dialog judul="Deck memuat teks acuan LatihUKP" tutup={() => setDialog(null)} kaki={<>
          <button type="button" className="btn" onClick={() => setDialog(null)}>Batal</button>
          <button type="button" className="btn btn-utama" onClick={() => { const { daftar: d, format } = dialog; setDialog(null); unduhDeck(d, true, format); }}>Unduh sebagai Draf internal</button>
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
          <button type="button" className="btn" onClick={() => { const ids = dialog.ids.filter((id) => !decks[target(id)]?.riwayat.length); setDialog(null); if (ids.length) susun(ids, true); }}>Lewati yang disunting</button>
          <button type="button" className="btn btn-utama" onClick={() => { const ids = dialog.ids; setDialog(null); susun(ids, true); }}>Susun ulang semua</button>
        </>}>
          <p style={{ margin: 0 }}>{new Set(dialog.ids.map(target).filter((id) => decks[id]?.riwayat.length)).size} deck sudah disunting. Menyusun ulang mengganti suntingan dengan naskah baru dari data.</p>
        </Dialog>
      )}
    </>
  );
}
