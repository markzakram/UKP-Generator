// Penguji kecil: cek(nama, kondisi, detail). Keluar dengan kode 1 bila ada yang gagal.
let lulus = 0;
const gagal: string[] = [];
let bagianAktif = '';

export function bagian(nama: string) {
  bagianAktif = nama;
  console.log('\n## ' + nama);
}
export function cek(nama: string, kondisi: unknown, detail?: unknown) {
  if (kondisi) { lulus++; return true; }
  const pesan = bagianAktif + ' · ' + nama + (detail === undefined ? '' : ' → ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 600)));
  gagal.push(pesan);
  console.log('  GAGAL ' + pesan);
  return false;
}
export function selesai(judul: string) {
  console.log('\n' + judul + ': ' + lulus + ' cek lulus, ' + gagal.length + ' gagal.');
  if (gagal.length) {
    console.log(gagal.map((g) => ' - ' + g).join('\n'));
    process.exit(1);
  }
}
