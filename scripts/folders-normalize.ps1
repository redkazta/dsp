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

# =====================================================
# CAMISAS: DSP_<n>.jpg  y  DSP_<n>_Flash.jpg
# =====================================================
$camisasSrc = Get-ChildItem -LiteralPath $srcRoot -Directory | Where-Object { $_.Name -like 'Camisas*' } | Select-Object -First 1
$camisasOut = Join-Path $outRoot 'camisas'
if (Test-Path -LiteralPath $camisasOut) { Remove-Item -LiteralPath $camisasOut -Recurse -Force }
New-Item -ItemType Directory -Force -Path $camisasOut | Out-Null

$rutasCamisas = @()

Get-ChildItem -LiteralPath $camisasSrc.FullName -File -Include *.jpg, *.jpeg, *.png, *.webp | ForEach-Object {
  # DSP_1.jpg -> camera-dsp-1 ; DSP_1_Flash.jpg -> camera-dsp-1-flash
  if ($_.BaseName -match '^(?i)DSP_(\d+)(_Flash)?$') {
    $n = $Matches[1]
    $flash = [bool]$Matches[2]

    $order = '01'
    if ($flash) { $order = '02' }
    $name = 'camisa-dsp-' + $n + '-' + $order + '-frente'
    if ($flash) { $name += '-flash' }
    $name += '.jpg'

    $out = Join-Path $camisasOut $name
    Export-Normalized $_.FullName $out
    $rutasCamisas += '/img/camisas/' + $name
    Write-Output ('OK  ' + $name + '  <- ' + $_.Name)
  } else {
    Write-Output ('IGNORADA (nombre no reconocido): ' + $_.Name)
  }
}

# =====================================================
# JEANS: <color>/[no_flash_|flash_]<front|back>.jpg
# =====================================================
$jeansSrc = Get-ChildItem -LiteralPath $srcRoot -Directory | Where-Object { $_.Name -like '*JEANS*' } | Select-Object -First 1
if (-not $jeansSrc) { throw 'No se encontro la carpeta de jeans en img-src' }
$rutasJeans = @()

foreach ($dir in Get-ChildItem -LiteralPath $jeansSrc.FullName -Directory) {
  $slug = $dir.Name.ToLower()
  if ($slug -like 'gris*')    { $slug = 'gris-metalico' }
  if ($slug -like 'morado*')  { $slug = 'morado-reflectivo' }
  if ($slug -like 'naranja*') { $slug = 'naranja-reflextivo' }

  $outDir = Join-Path (Join-Path $outRoot 'jeans') $slug
  if (Test-Path -LiteralPath $outDir) { Remove-Item -LiteralPath $outDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null

  foreach ($f in Get-ChildItem -LiteralPath $dir.FullName -File -Include *.jpg, *.jpeg, *.png, *.webp) {
    $base = $f.BaseName.ToLower()

    $isBack = $base -like '*back*'
    $isFlash = $base -like 'flash*'

    $order = '01'
    $vista = 'frente'
    if ($isBack -and -not $isFlash) { $order = '02'; $vista = 'espalda' }
    if ($isFlash -and -not $isBack) { $order = '03'; $vista = 'frente' }
    if ($isFlash -and $isBack)      { $order = '04'; $vista = 'espalda' }

    $suffix = ''
    if ($isFlash) { $suffix = '-flash' }

    $name = $slug + '-' + $order + '-' + $vista + $suffix + '.jpg'
    $out = Join-Path $outDir $name
    Export-Normalized $f.FullName $out
    $rutasJeans += '/img/jeans/' + $slug + '/' + $name
    Write-Output ('OK  jeans/' + $slug + '/' + $name + '  <- ' + $f.Name)
  }
}

Write-Output ''
Write-Output '--- CAMISAS ---'
$rutasCamisas | Sort-Object | ForEach-Object { Write-Output $_ }
Write-Output '--- JEANS ---'
$rutasJeans | Sort-Object | ForEach-Object { Write-Output $_ }
Write-Output ('total: ' + ($rutasCamisas.Count + $rutasJeans.Count))
