# Ekspor PDF deck materi lewat PowerPoint (khusus Windows dengan PowerPoint terpasang).
# Setiap .pptx di folder dan subfolder disimpan sebagai .pdf di sebelahnya. Dipanggil oleh npm run materi -- --pdf,
# atau langsung: powershell -ExecutionPolicy Bypass -File scripts/materi-pdf.ps1 output/materi-a
param([Parameter(Mandatory = $true)][string]$Folder)
$ErrorActionPreference = 'Stop'
$Folder = (Resolve-Path $Folder).Path
$berkas = Get-ChildItem -Path $Folder -Filter *.pptx -Recurse | Sort-Object FullName
if (-not $berkas) { Write-Output "Error: tidak ada .pptx di $Folder"; exit 1 }
$pp = New-Object -ComObject PowerPoint.Application
$jadi = 0; $gagal = @()
try {
  foreach ($f in $berkas) {
    $pdf = [System.IO.Path]::ChangeExtension($f.FullName, '.pdf')
    try {
      $pres = $pp.Presentations.Open($f.FullName, $true, $false, $false)
      $pres.SaveAs($pdf, 32)  # ppSaveAsPDF
      $pres.Close()
      $jadi++
      Write-Output "BERKAS -> $pdf"
    } catch {
      $gagal += $f.Name + ': ' + $_.Exception.Message
    }
  }
} finally {
  $pp.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp)
}
Write-Output ("RINGKASAN -> {0} PDF dari {1} .pptx{2}" -f $jadi, $berkas.Count, $(if ($gagal.Count) { ', ' + $gagal.Count + ' gagal' } else { '' }))
foreach ($g in $gagal) { Write-Output "Error: $g" }
if ($gagal.Count) { exit 1 }
