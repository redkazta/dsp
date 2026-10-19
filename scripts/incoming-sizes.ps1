Add-Type -AssemblyName System.Drawing

$root = 'C:\Users\Angel\Downloads\D$P-20261019T205438Z-1-001\D$P'

Get-ChildItem -LiteralPath $root -Recurse -File -Include *.jpg, *.jpeg, *.png, *.webp | Sort-Object FullName | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm MD5).Hash.Substring(0, 8)
  $rel = $_.FullName.Substring($root.Length + 1)
  Write-Output ("{0}x{1}  {2}KB  md5={3}  {4}" -f $img.Width, $img.Height, [math]::Round($_.Length / 1KB, 0), $hash, $rel)
  $img.Dispose()
}
