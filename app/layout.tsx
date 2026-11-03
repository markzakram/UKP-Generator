import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'UKP Studio — Generator Soal UKP',
  description: 'Susun, periksa, dan ekspor paket soal Uji Kompetensi Perpajakan Tingkat A, B, dan C.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className={plexSans.variable + ' ' + plexMono.variable}><body>{children}</body></html>;
}
