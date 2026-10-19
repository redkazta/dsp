$ErrorActionPreference = 'Stop'

$src = 'C:\Users\Angel\Downloads\Camisas V3 (showroom)-20261019T231940Z-1-001\Camisas V3 (showroom)'
$dst = 'C:\Users\Angel\Desktop\DSP\storefront\public\img-src\Camisas V3 (showroom)'

if (-not (Test-Path -LiteralPath $src)) { throw "No existe: $src" }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

Get-ChildItem -LiteralPath $src -File -Include *.jpg, *.jpeg, *.png, *.webp | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force
  Write-Output ('copiada ' + $_.Name)
}
