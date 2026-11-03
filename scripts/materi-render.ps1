# Uji render deck materi di PowerPoint (khusus Windows dengan PowerPoint terpasang).
# Membuka setiap .pptx di folder dan subfolder (gagal = berkas perlu diperbaiki), lalu membandingkan ukuran teks hasil render
# PowerPoint (BoundHeight/BoundWidth) dengan kotak teksnya. Opsional: ekspor PNG setiap slide.
# Pakai: powershell -ExecutionPolicy Bypass -File scripts/materi-render.ps1 output/materi-uji [-Gambar]
param(
  [Parameter(Mandatory = $true)][string]$Folder,
  [switch]$Gambar,
  [double]$Toleransi = 1.5
)
$ErrorActionPreference = 'Stop'
$Folder = (Resolve-Path $Folder).Path
$berkas = Get-ChildItem -Path $Folder -Filter *.pptx -Recurse | Sort-Object Name
if (-not $berkas) { Write-Output "Error: tidak ada .pptx di $Folder"; exit 1 }
$pp = New-Object -ComObject PowerPoint.Application
$laporan = @()
$totalKotak = 0; $totalMeluap = 0; $gagalBuka = 0
foreach ($f in $berkas) {
  try {
    $pres = $pp.Presentations.Open($f.FullName, $true, $false, $false)
  } catch {
    $gagalBuka++
    $laporan += [pscustomobject]@{ deck = $f.Name; slide = 0; kotak = ''; masalah = 'gagal dibuka: ' + $_.Exception.Message }
    continue
  }
  $fontAsing = @($pres.Fonts | Where-Object { $_.Name -and $_.Name.Trim() -and $_.Name -ne 'Poppins' } | ForEach-Object { $_.Name })
  if ($Gambar) { $dir = Join-Path $Folder ('png\' + $f.BaseName); New-Item -ItemType Directory -Force $dir | Out-Null }
  foreach ($s in $pres.Slides) {
    foreach ($sh in $s.Shapes) {
      if (-not $sh.HasTextFrame) { continue }
      $tr = $sh.TextFrame2.TextRange
      if ($tr.Text.Trim().Length -eq 0) { continue }
      $totalKotak++
      $bh = $tr.BoundHeight; $bw = $tr.BoundWidth
      # BoundWidth ikut menghitung spasi di ujung baris yang dibungkus (tidak tampil), jadi lebar diberi
      # kelonggaran satu spasi pada ukuran huruf kotak. Luapan sebenarnya terlihat pada tinggi.
      $pt = $tr.Characters(1, 1).Font.Size
      $longgarLebar = [math]::Max($Toleransi, 0.3 * $pt)
      if ($bh -gt $sh.Height + $Toleransi -or $bw -gt $sh.Width + $longgarLebar) {
        $totalMeluap++
        $laporan += [pscustomobject]@{ deck = $f.Name; slide = $s.SlideIndex; kotak = $sh.Name; masalah = ('teks {0:N1} x {1:N1} pt, kotak {2:N1} x {3:N1} pt' -f $bw, $bh, $sh.Width, $sh.Height) }
      }
    }
    if ($Gambar) { $s.Export((Join-Path $dir ('s{0:D2}.png' -f $s.SlideIndex)), 'PNG', 1600, 900) }
  }
  if ($fontAsing.Count) { $laporan += [pscustomobject]@{ deck = $f.Name; slide = 0; kotak = ''; masalah = 'font lain dipakai: ' + ($fontAsing -join ', ') } }
  $pres.Close()
}
$pp.Quit()
$keluar = Join-Path $Folder 'render-laporan.json'
ConvertTo-Json -InputObject @($laporan) -Depth 3 | Out-File -Encoding utf8 $keluar
Write-Output ("RINGKASAN -> {0} deck dibuka, {1} gagal dibuka, {2} kotak teks diperiksa, {3} meluap (toleransi {4} pt)" -f ($berkas.Count - $gagalBuka), $gagalBuka, $totalKotak, $totalMeluap, $Toleransi)
Write-Output "BERKAS -> $keluar"
foreach ($l in $laporan | Select-Object -First 15) { Write-Output ("  {0} slide {1} {2}: {3}" -f $l.deck, $l.slide, $l.kotak, $l.masalah) }
if ($gagalBuka -or $totalMeluap -or ($laporan | Where-Object { $_.masalah -like 'font lain*' })) { exit 1 }
