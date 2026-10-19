Add-Type -AssemblyName System.Drawing

$base = 'C:\Users\Angel\Downloads'
$dirs = Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -like 'Camisas V3*' }

if (-not $dirs) { Write-Output 'NO ENCONTRADA en Downloads'; exit }

foreach ($d in $dirs) {
  Write-Output ('=== ' + $d.FullName)
  Get-ChildItem -LiteralPath $d.FullName -Recurse -File | Sort-Object FullName | ForEach-Object {
    $size = ''
    if ($_.Extension -in '.jpg', '.jpeg', '.png', '.webp') {
      $img = [System.Drawing.Image]::FromFile($_.FullName)
      $size = ('{0}x{1}' -f $img.Width, $img.Height)
      $img.Dispose()
    }
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm MD5).Hash.Substring(0, 8)
    $rel = $_.FullName.Substring($d.FullName.Length).TrimStart('\')
    Write-Output ('  {0,-40} {1,10}  {2,6}KB  md5={3}  {4}' -f $rel, $size, [math]::Round($_.Length / 1KB, 0), $hash, $_.LastWriteTime.ToString('MM-dd HH:mm'))
  }
}
