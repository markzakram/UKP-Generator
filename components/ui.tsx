'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import type { CekMutu } from '@/lib/types';

export function Segmented<T extends string>({ label, nilai, pilihan, ubah }: { label: string; nilai: T; pilihan: { nilai: T; label: string; nonaktif?: boolean; judul?: string }[]; ubah: (v: T) => void }) {
  return (
    <div>
      <div className="label-kecil">{label}</div>
      <div role="group" aria-label={label} className="seg">
        {pilihan.map((p) => (
          <button key={p.nilai} type="button" aria-pressed={nilai === p.nilai} disabled={p.nonaktif} title={p.judul} onClick={() => ubah(p.nilai)}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Toast({ pesan, galat, tutup }: { pesan: string; galat?: boolean; tutup: () => void }) {
  useEffect(() => { const t = setTimeout(tutup, galat ? 8000 : 4000); return () => clearTimeout(t); }, [pesan, galat, tutup]);
  return <div role="status" aria-live="polite" className={'toast' + (galat ? ' galat' : '')}>{pesan}</div>;
}

export function Dialog({ judul, tutup, children, kaki }: { judul: string; tutup: () => void; children: ReactNode; kaki?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sebelum = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button, select, textarea')?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); sebelum?.focus?.(); };
  }, [tutup]);
  return (
    <div className="latar" onMouseDown={(e) => { if (e.target === e.currentTarget) tutup(); }}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={judul}>
        <div className="dialog-kepala"><h2>{judul}</h2><button type="button" className="btn btn-kecil" onClick={tutup} aria-label="Tutup dialog">Tutup</button></div>
        <div className="dialog-isi">{children}</div>
        {kaki && <div className="dialog-kaki">{kaki}</div>}
      </div>
    </div>
  );
}

const IKON: Record<CekMutu['level'], string> = { lolos: '✓', info: 'i', peringatan: '!', gagal: '×' };
export function DaftarMutu({ cek, aksi }: { cek: CekMutu[]; aksi?: (c: CekMutu) => void }) {
  return (
    <ul className="mutu">
      {cek.map((c) => (
        <li key={c.id + c.ket}>
          <span className={'ikon ikon-' + c.level} aria-label={c.level}>{IKON[c.level]}</span>
          <span style={{ flex: 1 }}><b>{c.judul}.</b> {c.ket}</span>
          {c.aksi && aksi && <button type="button" className="btn btn-kecil" onClick={() => aksi(c)}>{c.aksi === 'urutkan' ? 'Urutkan' : 'Adaptasi'}</button>}
        </li>
      ))}
    </ul>
  );
}

export function IkonLembar() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aksen)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>
  );
}
export function IkonCentang({ warna = 'var(--hijau)' }: { warna?: string }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={warna} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}
