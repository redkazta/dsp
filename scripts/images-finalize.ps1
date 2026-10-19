$ErrorActionPreference = 'Stop'

$incoming = 'C:\Users\Angel\Desktop\DSP\storefront\public\img\_incoming'
$imgRoot = 'C:\Users\Angel\Desktop\DSP\storefront\public\img'

# Carpetas (se resuelven por patron para no depender de acentos/UTF-8)
$camisas = Get-ChildItem -LiteralPath $incoming -Directory | Where-Object { $_.Name -like 'Camisas*' } | Select-Object -First 1
$jeansRoot = Get-ChildItem -LiteralPath $incoming -Directory | Where-Object { $_.Name -like '*JEANS*' } | Select-Object -First 1

$gris = (Get-ChildItem -LiteralPath $jeansRoot.FullName -Directory | Where-Object { $_.Name -like 'Gris*' } | Select-Object -First 1).FullName
$morado = (Get-ChildItem -LiteralPath $jeansRoot.FullName -Directory | Where-Object { $_.Name -like 'Morado*' } | Select-Object -First 1).FullName
$naranja = (Get-ChildItem -LiteralPath $jeansRoot.FullName -Directory | Where-Object { $_.Name -like 'Naranja*' } | Select-Object -First 1).FullName

Write-Output ("camisas: " + $camisas.FullName)
Write-Output ("jeans:   " + $jeansRoot.FullName)

# 1. Borra imagenes anteriores en /img
Get-ChildItem -LiteralPath $imgRoot -File | Where-Object { $_.Extension -in '.jpg', '.jpeg', '.png', '.webp' } | Remove-Item -Force

# 2. Playeras: DSP_1..DSP_7
for ($i = 1; $i -le 7; $i++) {
  $src = Join-Path $camisas.FullName ("DSP_{0}_sq.jpg" -f $i)
  $dst = Join-Path $imgRoot ("DSP_{0}.jpg" -f $i)
  Copy-Item -LiteralPath $src -Destination $dst -Force
}

# 3. Jeans
$map = @(
  @{ dir = $gris;    file = 'no_flash_front_sq.jpg'; name = 'DSP-JEANS-gris-01.jpg' },
  @{ dir = $gris;    file = 'no_flash_back_sq.jpg';  name = 'DSP-JEANS-gris-02.jpg' },
  @{ dir = $gris;    file = 'flash_front_sq.jpg';    name = 'DSP-JEANS-gris-03-flash.jpg' },
  @{ dir = $gris;    file = 'flash_back_sq.jpg';     name = 'DSP-JEANS-gris-04-flash.jpg' },

  @{ dir = $morado;  file = 'no_flash_front_sq.jpg'; name = 'DSP-JEANS-morado-01.jpg' },
  @{ dir = $morado;  file = 'no_flash_back_sq.jpg';  name = 'DSP-JEANS-morado-02.jpg' },
  @{ dir = $morado;  file = 'flash_front_sq.jpg';    name = 'DSP-JEANS-morado-03-flash.jpg' },
  @{ dir = $morado;  file = 'flash_back_sq.jpg';     name = 'DSP-JEANS-morado-04-flash.jpg' },

  @{ dir = $naranja; file = 'no_flash_front_sq.jpg'; name = 'DSP-JEANS-naranja-01.jpg' },
  @{ dir = $naranja; file = 'flash_front_sq.jpg';    name = 'DSP-JEANS-naranja-02-flash.jpg' }
)

foreach ($m in $map) {
  Copy-Item -LiteralPath (Join-Path $m.dir $m.file) -Destination (Join-Path $imgRoot $m.name) -Force
}

# 4. Limpieza
Remove-Item -LiteralPath $incoming -Recurse -Force

Write-Output '--- resultado ---'
Get-ChildItem -LiteralPath $imgRoot -File | Sort-Object Name | ForEach-Object {
  Write-Output ("{0}  {1}KB" -f $_.Name, [math]::Round($_.Length / 1KB, 0))
}
