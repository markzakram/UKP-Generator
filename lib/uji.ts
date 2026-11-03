// Uji peserta: berkas HTML mandiri (tanpa kunci) → hasil JSON → statistik butir (PRD F10).
import { HURUF } from './config';
import type { Huruf, Paket, Pengaturan } from './types';
import { tampilkanKasus } from './export/common';

export interface JawabanUji { uid: string; checksum: string; jawab: Huruf | null; detik: number }
export interface SesiUji {
  format: 'ukp-studio-hasil-uji';
  versi: 1;
  id: string;
  paketId: string;
  seed: string;
  peserta: string;
  mulai: string;
  selesai: string;
  jawaban: JawabanUji[];
}

const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML mandiri untuk peserta. Tidak memuat kunci, pembahasan, atau asal soal. */
export function htmlUji(paket: Paket, peng: Pick<Pengaturan, 'judul' | 'tingkat' | 'durasi' | 'seed'>): string {
  const butir = paket.soal.map((s, i) => ({ uid: s.uid, checksum: s.checksum, kasus: tampilkanKasus(paket.soal, i) ? s.kasus : null, lanjutKasus: !!s.kasus && !tampilkanKasus(paket.soal, i), soal: s.soal, opsi: HURUF.map((h) => s.opsi[h]) }));
  const data = JSON.stringify({ paketId: paket.id, seed: peng.seed, judul: peng.judul + ' · Tingkat ' + peng.tingkat + ' · ' + paket.id, durasi: peng.durasi, butir }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(peng.judul)} · ${escHtml(paket.id)}</title>
<style>
:root{--tinta:#1f2328;--abu:#57606a;--garis:#d0d7de;--panel:#f6f8fa;--aksen:#b45309;--kuning:#fff8e6}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 system-ui,'Segoe UI',sans-serif;color:var(--tinta);background:#fff}
header{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--garis);background:var(--panel);position:sticky;top:0}
header h1{font-size:16px;margin:0;flex:1 1 240px}.waktu{font-family:ui-monospace,monospace;font-weight:700}
main{max-width:860px;margin:0 auto;padding:16px}
.kasus{background:var(--panel);border:1px solid var(--garis);border-radius:6px;padding:10px 12px;margin-bottom:12px}
.opsi{display:flex;flex-direction:column;gap:6px;margin:12px 0}
.opsi label{display:flex;gap:10px;padding:10px 12px;border:1px solid var(--garis);border-radius:6px;cursor:pointer}
.opsi label:has(input:checked){border-color:var(--aksen);background:var(--kuning)}
.nav{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,1fr));gap:4px;margin-top:16px}
.nav button{height:34px;border:1px solid var(--garis);border-radius:4px;background:#fff;font:12px ui-monospace,monospace;cursor:pointer}
.nav button.terjawab{background:#dafbe1;border-color:#1a7f37}.nav button.aktif{outline:2px solid var(--aksen)}
.tombol{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
button.btn{font:inherit;font-weight:600;padding:8px 16px;min-height:44px;border:1px solid var(--garis);border-radius:6px;background:var(--panel);cursor:pointer}
button.utama{background:var(--aksen);border-color:var(--aksen);color:#fff}
input[type=text]{font:inherit;padding:8px 10px;border:1px solid var(--garis);border-radius:6px;min-height:44px;width:min(360px,100%)}
.kecil{font-size:13px;color:var(--abu)}
</style></head><body>
<script type="application/json" id="data">${data}</script>
<header><h1 id="judul"></h1><span class="waktu" id="waktu" aria-live="off"></span></header>
<main id="isi"></main>
<script>
(function(){
var D=JSON.parse(document.getElementById('data').textContent),K='ukp-uji-'+D.paketId+'-'+D.seed,S;
try{S=JSON.parse(localStorage.getItem(K)||'null')}catch(e){}
if(!S)S={peserta:'',mulai:null,jawab:{},detik:{},aktif:0,selesai:false};
function simpan(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
var isi=document.getElementById('isi'),waktu=document.getElementById('waktu'),masuk=Date.now();
document.getElementById('judul').textContent=D.judul;
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
function catatWaktu(){var b=D.butir[S.aktif];if(!b)return;S.detik[b.uid]=(S.detik[b.uid]||0)+Math.round((Date.now()-masuk)/1000);masuk=Date.now()}
function sisa(){return Math.max(0,D.durasi*60-Math.floor((Date.now()-new Date(S.mulai).getTime())/1000))}
function mulaiLayar(){isi.innerHTML='<p>'+D.butir.length+' soal · '+D.durasi+' menit. Kunci dan pembahasan tidak ada di berkas ini.</p><label>Nama atau kode peserta<br><input type="text" id="nama" value="'+esc(S.peserta)+'"></label><div class="tombol"><button class="btn utama" id="mulai">Mulai</button></div>';
document.getElementById('mulai').onclick=function(){S.peserta=document.getElementById('nama').value.trim()||'Peserta';S.mulai=new Date().toISOString();simpan();tampil()}}
function tampil(){if(S.selesai)return akhir();var b=D.butir[S.aktif],h='';
if(b.kasus)h+='<div class="kasus"><b>Kasus</b><br>'+esc(b.kasus)+'</div>';else if(b.lanjutKasus)h+='<p class="kecil">Lanjutan kasus pada soal sebelumnya.</p>';
h+='<p><b>'+(S.aktif+1)+'.</b> '+esc(b.soal)+'</p><div class="opsi" role="radiogroup">';
['A','B','C','D'].forEach(function(x,i){h+='<label><input type="radio" name="j" value="'+x+'"'+(S.jawab[b.uid]===x?' checked':'')+'><b>'+x+'.</b> <span>'+esc(b.opsi[i])+'</span></label>'});
h+='</div><div class="tombol"><button class="btn" id="seb">Sebelumnya</button><button class="btn" id="ber">Berikutnya</button><button class="btn" id="hapus">Kosongkan jawaban</button><button class="btn utama" id="akhiri">Selesai dan unduh hasil</button></div><nav class="nav" aria-label="Nomor soal">';
D.butir.forEach(function(x,i){h+='<button class="'+(S.jawab[x.uid]?'terjawab ':'')+(i===S.aktif?'aktif':'')+'" data-i="'+i+'" aria-label="Soal '+(i+1)+'">'+(i+1)+'</button>'});
isi.innerHTML=h+'</nav>';
isi.querySelectorAll('input[name=j]').forEach(function(r){r.onchange=function(){S.jawab[b.uid]=r.value;simpan();tampil()}});
document.getElementById('seb').onclick=function(){pindah(S.aktif-1)};document.getElementById('ber').onclick=function(){pindah(S.aktif+1)};
document.getElementById('hapus').onclick=function(){delete S.jawab[b.uid];simpan();tampil()};
document.getElementById('akhiri').onclick=function(){if(confirm('Selesaikan uji dan unduh hasil?'))selesai()};
isi.querySelectorAll('.nav button').forEach(function(t){t.onclick=function(){pindah(+t.dataset.i)}})}
function pindah(i){if(i<0||i>=D.butir.length)return;catatWaktu();S.aktif=i;simpan();tampil()}
function selesai(){catatWaktu();S.selesai=true;S.akhir=new Date().toISOString();simpan();unduh();akhir()}
function hasil(){return{format:'ukp-studio-hasil-uji',versi:1,id:'sesi-'+D.paketId+'-'+new Date(S.mulai).getTime().toString(36)+'-'+Math.random().toString(36).slice(2,8),paketId:D.paketId,seed:D.seed,peserta:S.peserta,mulai:S.mulai,selesai:S.akhir||new Date().toISOString(),
jawaban:D.butir.map(function(b){return{uid:b.uid,checksum:b.checksum,jawab:S.jawab[b.uid]||null,detik:S.detik[b.uid]||0}})}}
function unduh(){var t=JSON.stringify(hasil(),null,1),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'application/json'}));a.download='hasil-uji-'+D.paketId+'-'+(S.peserta||'peserta').replace(/[^\\w-]+/g,'_')+'.json';document.body.appendChild(a);a.click();a.remove()}
function akhir(){var n=Object.keys(S.jawab).length;isi.innerHTML='<p>Uji selesai. '+n+' dari '+D.butir.length+' soal dijawab.</p><p>Kirim berkas <b>hasil-uji-…json</b> yang terunduh kepada penyusun soal. Nilai tidak ditampilkan di sini.</p><div class="tombol"><button class="btn" id="lagi">Unduh hasil lagi</button></div>';document.getElementById('lagi').onclick=unduh}
function detak(){if(!S.mulai||S.selesai){waktu.textContent='';return}var s=sisa();waktu.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');if(s<=0){alert('Waktu habis. Hasil diunduh.');selesai()}}
setInterval(detak,1000);if(S.mulai)tampil();else mulaiLayar();detak();
})();
</script></body></html>`;
}

/** Baca satu berkas hasil: objek sesi, larik sesi, atau { sessions: [...] }. */
export function bacaHasilUji(teks: string): SesiUji[] {
  let isi: unknown;
  try { isi = JSON.parse(teks); } catch { throw new Error('Berkas hasil bukan JSON yang valid.'); }
  const daftar = Array.isArray(isi) ? isi : (isi as { sessions?: unknown[] })?.sessions ?? [isi];
  const sesi = (daftar as SesiUji[]).filter((s) => s && s.format === 'ukp-studio-hasil-uji' && Array.isArray(s.jawaban));
  if (!sesi.length) throw new Error('Berkas tidak berisi hasil uji UKP Studio.');
  for (const s of sesi) for (const j of s.jawaban) if (j.jawab !== null && !HURUF.includes(j.jawab)) throw new Error('Jawaban tidak valid di sesi ' + s.id + '.');
  return sesi;
}

export interface StatButir {
  nomor: number;
  uid: string;
  n: number;
  benar: number;
  p: number | null;
  frek: Record<Huruf | 'kosong', number>;
  rataDetik: number | null;
  pengecohJarang: Huruf[];
  dayaBeda: number | null;
  labelEmpiris: 'mudah' | 'sedang' | 'sulit' | null;
  tidakCocok: number;
}
export interface StatPaket { sesi: number; sesiLengkap: number; rataNilai: number | null; butir: StatButir[] }

const korelasi = (x: number[], y: number[]) => {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
};

/**
 * Statistik per butir. Respons dipadankan dengan uid + checksum; respons atas versi soal lain dihitung "tidak cocok".
 * Label empiris dan daya beda baru dihitung pada ≥ 30 respons (aturan awal proyek, bukan keputusan psikometrik final).
 */
export function statistik(paket: Paket, semua: SesiUji[]): StatPaket {
  const sesi = semua.filter((s) => s.paketId === paket.id);
  const butir: StatButir[] = paket.soal.map((s, i) => {
    const frek = { A: 0, B: 0, C: 0, D: 0, kosong: 0 };
    let benar = 0, n = 0, detik = 0, tidakCocok = 0;
    for (const se of sesi) {
      const j = se.jawaban.find((x) => x.uid === s.uid);
      if (!j) continue;
      if (j.checksum !== s.checksum) { tidakCocok++; continue; }
      n++; detik += j.detik;
      if (j.jawab) { frek[j.jawab]++; if (j.jawab === s.kunci) benar++; } else frek.kosong++;
    }
    const p = n ? benar / n : null;
    const salah = HURUF.filter((h) => h !== s.kunci);
    return {
      nomor: i + 1, uid: s.uid, n, benar, p, frek, rataDetik: n ? Math.round(detik / n) : null,
      pengecohJarang: n >= 20 ? salah.filter((h) => frek[h] / n < 0.05) : [],
      dayaBeda: null, labelEmpiris: n >= 30 && p !== null ? (p >= 0.8 ? 'mudah' : p >= 0.4 ? 'sedang' : 'sulit') : null, tidakCocok,
    };
  });
  // Daya beda: korelasi skor butir dengan skor total butir lain, hanya sesi yang cocok untuk semua butir.
  const lengkap = sesi.filter((se) => paket.soal.every((s) => se.jawaban.some((j) => j.uid === s.uid && j.checksum === s.checksum)));
  const skor: number[][] = lengkap.map((se) => paket.soal.map((s) => (se.jawaban.find((j) => j.uid === s.uid)?.jawab === s.kunci ? 1 : 0)));
  if (lengkap.length >= 30) {
    butir.forEach((b, i) => {
      const x = skor.map((r) => r[i]), y = skor.map((r) => r.reduce((a, v, k) => (k === i ? a : a + v), 0));
      const k = korelasi(x, y);
      b.dayaBeda = k === null ? null : Math.round(k * 100) / 100;
    });
  }
  const rataNilai = skor.length ? Math.round((skor.reduce((a, r) => a + r.reduce((x, y) => x + y, 0), 0) / skor.length / paket.soal.length) * 1000) / 10 : null;
  return { sesi: sesi.length, sesiLengkap: lengkap.length, rataNilai, butir };
}
