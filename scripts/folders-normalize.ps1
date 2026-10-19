$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$srcRoot = 'C:\Users\Angel\Desktop\DSP\storefront\public\img-src'
$outRoot = 'C:\Users\Angel\Desktop\DSP\storefront\public\img'
$outSize = 1200

function Get-Box([string] $path) {
  $bmp = New-Object System.Drawing.Bitmap $path
  $w = $bmp.Width; $h = $bmp.Height
  $step = 6
  $minX = $w; $minY = $h; $maxX = 0; $maxY = 0

  for ($y = 0; $y -lt $h; $y += $step) {
    for ($x = 0; $x -lt $w; $x += $step) {
      $p = $bmp.GetPixel($x, $y)
      if ($p.R -lt 247 -or $p.G -lt 247 -or $p.B -lt 247) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $bmp.Dispose()

  return [pscustomobject]@{
    W = $w; H = $h
    BW = ($maxX - $minX) + $step
    BH = ($maxY - $minY) + $step
    CX = ($minX + $maxX) / 2
    CY = ($minY + $maxY) / 2
  }
}

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Export-Normalized([string] $inPath, [string] $outPath) {
  $b = Get-Box $inPath

  $side = [math]::Max($b.BW, $b.BH) / 0.88
  $dx = [math]::Min($b.CX, $b.W - $b.CX) / $side
  $dy = [math]::Min($b.CY, $b.H - $b.CY) / $side
  $margin = [math]::Min($dx, $dy)
  if ($margin -gt 0.06) { $margin = 0.06 }
  $side = [math]::Max($b.BW, $b.BH) / (1 - 2 * $margin)
  if ($side -gt $b.H) { $side = $b.H }
  if ($side -gt $b.W) { $side = $b.W }

  $targetArea = $outSize * $outSize * 0.38
  $scale = [math]::Sqrt($targetArea / ($b.BW * $b.BH))
  $maxH = ($outSize * 0.82) / ($b.BH / $side * $outSize)
  if ($scale -gt $maxH) { $scale = $maxH }

  $drawSide = $side * $scale
  $left = ($outSize - $drawSide) / 2
  $top = ($outSize - $drawSide) / 2

  $fx = [int][math]::Round($b.CX - $side / 2)
  $fy = [int][math]::Round($b.CY - $side / 2)
  $fs = [int][math]::Round($side)
  if ($fx -lt 0) { $fx = 0 }
  if ($fy -lt 0) { $fy = 0 }
  if ($fx + $fs -gt $b.W) { $fs = $b.W - $fx }
  if ($fy + $fs -gt $b.H) { $fs = $b.H - $fy }

  $img = [System.Drawing.Image]::FromFile($inPath)
  $bmp = New-Object System.Drawing.Bitmap $outSize, $outSize
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $srcRect = New-Object System.Drawing.Rectangle $fx, $fy, $fs, $fs
  $dstRect = New-Object System.Drawing.Rectangle ([int][math]::Round($left)), ([int][math]::Round($top)), ([int][math]::Round($drawSide)), ([int][math]::Round($drawSide))
  $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $img.Dispose()

  $parent = Split-Path -Parent $outPath
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }

  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90
  $bmp.Save($outPath, $encoder, $params)
  $bmp.Dispose()
}

# Borra TODO lo anterior de img (menos el README)
Get-ChildItem -LiteralPath $outRoot -File | Where-Object { $_.Name -ne 'README.md' } | Remove-Item -Force
Get-ChildItem -LiteralPath $outRoot -Directory | Remove-Item -Recurse -Force

$routes = @()

# ---------- CAMISAS ----------
$camisas = Get-ChildItem -LiteralPath $srcRoot -Directory | Where-Object { $_.Name -like 'Camisas*' } | Select-Object -First 1
foreach ($f in Get-ChildItem -LiteralPath $camisas.FullName -File -Include *.jpg, *.jpeg, *.png, *.webp | Sort-Object Name) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name).ToLower()   # dsp_1
  $out = Join-Path $outRoot ('camisas\' + $base + '.jpg')
  Export-Normalized $f.FullName $out
  $routes += '/img/camisas/' + $base + '.jpg'
}

# ---------- JEANS ----------
$jeans = Get-ChildItem -LiteralPath $srcRoot -Directory | Where-Object { $_.Name -like '*JEANS*' } | Select-Object -First 1

foreach ($dir in Get-ChildItem -LiteralPath $jeans.FullName -Directory) {
  # Slug del color a partir del nombre de carpeta
  $raw = $dir.Name.ToLower()
  $slug = $raw
  if ($raw -like 'gris*')    { $slug = 'gris-metalico' }
  if ($raw -like 'morado*')  { $slug = 'morado-reflectivo' }
  if ($raw -like 'naranja*') { $slug = 'naranja-reflextivo' }

  foreach ($f in Get-ChildItem -LiteralPath $dir.FullName -File -Include *.jpg, *.jpeg, *.png, *.webp | Sort-Object Name) {
    # no_flash_front -> frente ; flash_back -> espalda-flash
    $n = [System.IO.Path]::GetFileNameWithoutExtension($f.Name).ToLower()
    $view = 'frente'
    if ($n -like '*back*') { $view = 'espalda' }
    $flash = ''
    if ($n -match '(^|[^o]_?flash)') { $flash = '' }
    if ($n -like 'flash*') { $flash = '-flash' }

    $order = '01'
    if ($view -eq 'espalda') { $order = '02' }
    if ($flash) {
      if ($view -eq 'frente') { $order = '03' } else { $order = '04' }
    }

    $name = $slug + '-' + $order + '-' + $view + $flash + '.jpg'
    $out = Join-Path $outRoot ('jeans\' + $slug + '\' + $name)
    Export-Normalized $f.FullName $out
    $routes += '/img/jeans/' + $slug + '/' + $name
  }
}

Write-Output '--- rutas finales ---'
$routes | Sort-Object | ForEach-Object { Write-Output $_ }
Write-Output ('total: ' + $routes.Count)
