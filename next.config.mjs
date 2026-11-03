import os from 'node:os';

// next dev memblokir sumber dev dari alamat selain localhost. Izinkan IPv4 komputer ini supaya
// UKP Studio bisa dibuka dari perangkat satu jaringan kantor. Tidak berpengaruh ke build.
const ipKomputerIni = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && (a.family === 'IPv4' || a.family === 4) && !a.internal)
  .map((a) => a.address);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ipKomputerIni,
};
export default nextConfig;
