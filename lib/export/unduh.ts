// Unduhan di browser. Satu berkas langsung, banyak berkas dibungkus ZIP.
export const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  html: 'text/html;charset=utf-8',
  zip: 'application/zip',
  png: 'image/png',
} as const;

export function unduh(isi: Uint8Array | Blob, nama: string, mime: string) {
  const blob = isi instanceof Blob ? isi : new Blob([isi as Uint8Array<ArrayBuffer>], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function zip(berkas: Record<string, Uint8Array>): Promise<Uint8Array> {
  const { zipSync } = await import('fflate');
  return zipSync(berkas);
}
