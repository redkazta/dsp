$ErrorActionPreference = 'Stop'

$src = 'C:\Users\Angel\Downloads\D$P-20261019T205438Z-1-001\D$P'
$dst = 'C:\Users\Angel\Desktop\DSP\storefront\public\img\_incoming'

if (-not (Test-Path -LiteralPath $src)) { throw "No existe: $src" }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

# Limpia restos de intentos previos
Get-ChildItem -LiteralPath $dst -Recurse -File | Remove-Item -Force
Get-ChildItem -LiteralPath $dst -Recurse -Directory | Remove-Item -Recurse -Force

$files = Get-ChildItem -LiteralPath $src -Recurse -File -Include *.jpg, *.jpeg, *.png, *.webp
Write-Output ("archivos origen: " + $files.Count)

foreach ($f in $files) {
  $rel = $f.FullName.Substring($src.Length).TrimStart('\')
  $target = Join-Path $dst $rel
  $parent = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Copy-Item -LiteralPath $f.FullName -Destination $target -Force
  Write-Output ("OK  $rel")
}

Write-Output ("copiados: " + (Get-ChildItem -LiteralPath $dst -Recurse -File).Count)
