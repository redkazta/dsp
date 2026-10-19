$ErrorActionPreference = 'Stop'

$imgRoot = 'C:\Users\Angel\Desktop\DSP\storefront\public\img'
$srcRoot = 'C:\Users\Angel\Desktop\DSP\storefront\public\img-src'

foreach ($dir in @($imgRoot, $srcRoot)) {
  if (Test-Path -LiteralPath $dir) {
    Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object { $_.Extension -in '.jpg', '.jpeg', '.png', '.webp' } | ForEach-Object {
      $rel = $_.FullName.Substring($dir.Length + 1)
      Write-Output ('  ' + $rel)
    }
    Write-Output ''
  }
}

if (Test-Path -LiteralPath $srcRoot) { Remove-Item -LiteralPath $srcRoot -Recurse -Force }
Write-Output 'img-src eliminada'
