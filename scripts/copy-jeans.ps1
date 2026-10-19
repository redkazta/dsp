$ErrorActionPreference = 'Stop'

$zipRoot = 'C:\Users\Angel\Downloads'
$zip = Get-ChildItem -LiteralPath $zipRoot -Directory | Where-Object { $_.Name -like 'D*P-2026*' } | Select-Object -First 1
$origin = Join-Path $zip.FullName 'D$P'
$jeansSrc = Get-ChildItem -LiteralPath $origin -Directory | Where-Object { $_.Name -like '*JEANS*' } | Select-Object -First 1

$dst = 'C:\Users\Angel\Desktop\DSP\storefront\public\img-src\JEANS'

if (-not $jeansSrc) { throw 'No se encontro la carpeta de jeans en Downloads' }
if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

foreach ($dir in Get-ChildItem -LiteralPath $jeansSrc.FullName -Directory) {
  $target = Join-Path $dst $dir.Name
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Get-ChildItem -LiteralPath $dir.FullName -File -Include *.jpg, *.jpeg, *.png, *.webp | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $target $_.Name) -Force
    Write-Output ('copiada ' + $dir.Name + '\' + $_.Name)
  }
}
