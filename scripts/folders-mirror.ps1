$ErrorActionPreference = 'Stop'

$src = 'C:\Users\Angel\Desktop\DSP\storefront\public\img'
$tmp = 'C:\Users\Angel\Desktop\DSP\storefront\public\img-src'

# 1. Guarda los originales de Downloads como fuente de verdad (con sus carpetas)
$zip = Get-ChildItem -LiteralPath 'C:\Users\Angel\Downloads' -Directory | Where-Object { $_.Name -like 'D*P-2026*' } | Select-Object -First 1
if (-not $zip) { throw 'No se encontro la carpeta de origen en Downloads' }

$origin = Join-Path $zip.FullName 'D$P'
if (-not (Test-Path -LiteralPath $origin)) { throw "No existe $origin" }

if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Get-ChildItem -LiteralPath $origin -Recurse -File -Include *.jpg, *.jpeg, *.png, *.webp | ForEach-Object {
  $rel = $_.FullName.Substring($origin.Length).TrimStart('\')
  $dest = Join-Path $tmp $rel
  $parent = Split-Path -Parent $dest
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
}

Write-Output '--- copiado a public/img-src ---'
Get-ChildItem -LiteralPath $tmp -Recurse -File | ForEach-Object {
  Write-Output ('  ' + $_.FullName.Substring($tmp.Length + 1))
}
