import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Poppins } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-plex-mono' });
// Poppins hanya untuk pratinjau slide materi (font template deck).
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', variable: '--font-poppins' });

export const metadata: Metadata = {
  title: 'UKP Studio — Generator Soal dan Materi UKP',
  description: 'Susun, periksa, dan ekspor paket soal serta deck materi Uji Kompetensi Perpajakan Tingkat A, B, dan C.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className={plexSans.variable + ' ' + plexMono.variable + ' ' + poppins.variable}><body>{children}</body></html>;
}
