# Genera el favicon a partir de la foto real del logo (public/img/logo/DSP.jpg).
# Salida: favicon.svg, favicon.ico (16/32/48) y apple-touch-icon.png (180).
# Sin dependencias: usa System.Drawing de .NET Framework.
#
# Nota: las funciones devuelven con `return , $valor` para que un byte[] no se
# "desenrolle" en PowerShell (un retorno normal lo convierte en salida por
# elementos y llega vacío).

Add-Type -AssemblyName System.Drawing

$source = 'storefront/public/img/logo/DSP.jpg'
$public = 'storefront/public'

function New-ResizedBitmap {
  param([System.Drawing.Image]$Source, [int]$Size)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  # Fondo negro: el JPG trae marco oscuro y así no quedan bordes blancos
  $g.Clear([System.Drawing.Color]::Black)
  $g.DrawImage($Source, 0, 0, $Size, $Size)
  $g.Dispose()

  return , $bmp
}

function Save-PngBytes {
  param([System.Drawing.Bitmap]$Bitmap)

  $ms = New-Object System.IO.MemoryStream
  $Bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Dispose()

  return , $bytes
}

$img = [System.Drawing.Image]::FromFile((Resolve-Path $source))

# --- PNG de 32px para el SVG ----------------------------------------
$bmp32 = New-ResizedBitmap -Source $img -Size 32
$png32 = Save-PngBytes -Bitmap $bmp32
$bmp32.Dispose()

# favicon.svg: la foto embebida en base64 (nítida y en un solo archivo)
$b64 = [System.Convert]::ToBase64String($png32)
$svg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <image width="32" height="32" href="data:image/png;base64,$b64"/>
</svg>
"@
[System.IO.File]::WriteAllText((Join-Path $public 'favicon.svg'), $svg, (New-Object System.Text.UTF8Encoding($false)))

# --- favicon.ico con 16, 32 y 48 ------------------------------------
$sizes = 16, 32, 48
$images = @()

foreach ($s in $sizes) {
  $bmp = New-ResizedBitmap -Source $img -Size $s
  $bytes = Save-PngBytes -Bitmap $bmp
  $bmp.Dispose()
  $images += , $bytes
}

$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter($ico)
$w.Write([UInt16]0)                 # reservado
$w.Write([UInt16]1)                 # tipo: icono
$w.Write([UInt16]$sizes.Count)      # número de imágenes

$offset = 6 + (16 * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $png = $images[$i]

  $w.Write([Byte]$s)                # ancho
  $w.Write([Byte]$s)                # alto
  $w.Write([Byte]0)                 # colores de paleta
  $w.Write([Byte]0)                 # reservado
  $w.Write([UInt16]1)               # planos
  $w.Write([UInt16]32)              # bits por píxel
  $w.Write([UInt32]$png.Length)
  $w.Write([UInt32]$offset)
  $offset += $png.Length
}

foreach ($png in $images) { $w.Write($png) }
$w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $public 'favicon.ico'), $ico.ToArray())

# --- apple-touch-icon -----------------------------------------------
$touch = New-ResizedBitmap -Source $img -Size 180
$touch.Save((Join-Path $public 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$touch.Dispose()

$img.Dispose()
Write-Output 'favicon.svg, favicon.ico y apple-touch-icon.png generados'
