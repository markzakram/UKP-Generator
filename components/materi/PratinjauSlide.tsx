'use client';
// Pratinjau slide dari kotak hasil tata letak (sama dengan isi .pptx), digambar di kanvas 1440 x 810 yang diskalakan.
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ASET_SVG, KANVAS, type Gradien, type Kotak, type SlideJadi } from '@/lib/materi/kotak';
import { LEKUK_BUTIR } from '@/lib/materi/metrik';

const hex = (h: string, alfa?: number) => {
  if (alfa == null || alfa >= 100) return '#' + h;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa / 100})`;
};
// DrawingML: 0° = kiri→kanan, 90° = atas→bawah; CSS: 90deg = kiri→kanan.
const gradien = (g: Gradien) => `linear-gradient(${g.sudut + 90}deg, ${hex(g.dari, g.alfa)}, ${hex(g.ke, g.alfa)})`;
const sumberAset = (aset: string) => `/materi/media/${aset}.${ASET_SVG.includes(aset as never) ? 'svg' : 'png'}`;

function KotakSlide({ k }: { k: Kotak }) {
  if (k.jenis === 'bentuk') {
    const gaya: CSSProperties = {
      position: 'absolute', left: k.x, top: k.y, width: k.w, height: k.h, borderRadius: k.radius ?? 0,
      background: k.gradien ? gradien(k.gradien) : k.isi ? hex(k.isi, k.alfa) : 'transparent',
      border: k.garis ? `${k.garis.tebal}px solid #${k.garis.warna}` : undefined, boxSizing: 'border-box',
      boxShadow: k.bayangan ? '0 5px 15px rgba(0,0,0,0.22)' : undefined
    };
    return <div style={gaya} />;
  }
  if (k.jenis === 'gambar') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={sumberAset(k.aset)} alt="" style={{ position: 'absolute', left: k.x, top: k.y, width: k.w, height: k.h, opacity: k.opasitas != null ? k.opasitas / 100 : 1 }} />;
  }
  if (k.jenis === 'garis') {
    return <div style={{ position: 'absolute', left: Math.min(k.x1, k.x2), top: Math.min(k.y1, k.y2), width: Math.max(1, Math.abs(k.x2 - k.x1)), height: Math.max(1, Math.abs(k.y2 - k.y1)), background: '#' + k.warna }} />;
  }
  const teksGradien: CSSProperties = k.gradien ? { backgroundImage: gradien(k.gradien), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: '#' + k.warna };
  return (
    <div style={{ position: 'absolute', left: k.x, top: k.y, width: k.w, height: k.h, display: 'flex', flexDirection: 'column', justifyContent: k.jangkar === 't' ? 'flex-start' : k.jangkar === 'b' ? 'flex-end' : 'center', fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: k.pt, lineHeight: `${k.pt * k.jarak}px`, textAlign: k.rata === 'ctr' ? 'center' : k.rata === 'r' ? 'right' : 'left', overflowWrap: 'anywhere' }}>
      {k.paragraf.map((p, i) => (
        <div key={i} style={{ marginTop: i ? k.pt * k.antarPar : 0, position: 'relative', paddingLeft: p.butir ? LEKUK_BUTIR * k.pt : 0, ...teksGradien }}>
          {p.butir && <span style={{ position: 'absolute', left: 0, color: '#' + k.warna }}>•</span>}
          {p.runs.map((r, j) => (
            <span key={j} style={{ fontWeight: (r.b ?? k.tebal) ? 700 : 400, fontStyle: (r.i ?? k.miring) ? 'italic' : 'normal', ...(r.warna ? { color: '#' + r.warna } : {}) }}>{r.t}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function PratinjauSlide({ slide, label }: { slide: SlideJadi; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ukur = () => setSkala(el.clientWidth / KANVAS.w);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="pratinjau-slide" role="img" aria-label={label ?? 'Pratinjau slide: ' + slide.judul}>
      {skala > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: KANVAS.w, height: KANVAS.h, transform: `scale(${skala})`, transformOrigin: '0 0', background: '#fff' }}>
          {slide.kotak.map((k, i) => <KotakSlide key={i} k={k} />)}
        </div>
      )}
    </div>
  );
}

export default memo(PratinjauSlide);
