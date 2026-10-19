Add-Type -AssemblyName System.Drawing

$root = 'C:\Users\Angel\Desktop\DSP\storefront\public\img\_incoming'
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

function Get-Frame($b) {
  # Marco cuadrado centrado en la prenda.
  # Distancia al borde más cercano (en fracción del marco).
  $side = [math]::Max($b.BW, $b.BH) / 0.85          # margen del 15%
  $dx = [math]::Min($b.CX, $b.W - $b.CX) / $side
  $dy = [math]::Min($b.CY, $b.H - $b.CY) / $side
  $margin = [math]::Min($dx, $dy)
  if ($margin -gt 0.12) { $margin = 0.12 }
  $side = [math]::Max($b.BW, $b.BH) / (1 - 2 * $margin)
  if ($side -gt $b.H) { $side = $b.H }
  if ($side -gt $b.W) { $side = $b.W }

  # Escala final para uniformar el ÁREA de la prenda.
  $targetArea = $outSize * $outSize * 0.33
  $scale = [math]::Sqrt($targetArea / ($b.BW * $b.BH))
  $maxH = ($outSize * 0.74) / ($b.BH / $side * $outSize)
  if ($scale -gt $maxH) { $scale = $maxH }

  $drawSide = $side * $scale                        # lado en px del lienzo
  $left = ($outSize - $drawSide) / 2
  $top = ($outSize - $drawSide) / 2

  return [pscustomobject]@{
    X = [int][math]::Round($b.CX - $side / 2)
    Y = [int][math]::Round($b.CY - $side / 2)
    S = [int][math]::Round($side)
    Left = [int][math]::Round($left)
    Top = [int][math]::Round($top)
    DrawSide = [int][math]::Round($drawSide)
    Margin = [math]::Round($margin, 3)
  }
}

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.Name -notlike '*_sq.jpg' } | Sort-Object FullName | ForEach-Object {
  $src = $_.FullName
  $rel = $_.FullName.Substring($root.Length + 1)

  $b = Get-Box $src
  $f = Get-Frame $b

  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $outSize, $outSize
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $srcRect = New-Object System.Drawing.Rectangle $f.X, $f.Y, $f.S, $f.S
  $dstRect = New-Object System.Drawing.Rectangle $f.Left, $f.Top, $f.DrawSide, $f.DrawSide
  $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $img.Dispose()

  $dir = Split-Path -Parent $src
  $name = [System.IO.Path]::GetFileNameWithoutExtension($src)
  $out = Join-Path $dir ($name + '_sq.jpg')

  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90
  $bmp.Save($out, $encoder, $params)
  $bmp.Dispose()

  Write-Output ("frame=({0},{1},{2}) draw={3} margin={4} ink={5}x{6}  {7}" -f $f.X, $f.Y, $f.S, $f.DrawSide, $f.Margin, $b.BW, $b.BH, $rel)
}
