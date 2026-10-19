$roots = @(
  (Join-Path $env:USERPROFILE 'Desktop'),
  (Join-Path $env:USERPROFILE 'Downloads'),
  (Join-Path $env:USERPROFILE 'Documents'),
  (Join-Path $env:USERPROFILE 'OneDrive')
)

foreach ($root in $roots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }

  Get-ChildItem -LiteralPath $root -Recurse -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notlike '*node_modules*' -and $_.Name -match 'D.?P|Jeans|Camis|Camisas|showroom' -and $_.Name -notlike '*_incoming*' } |
    ForEach-Object {
      $files = @(Get-ChildItem -LiteralPath $_.FullName -File -ErrorAction SilentlyContinue)
      $imgs = @($files | Where-Object { $_.Extension -in '.jpg', '.jpeg', '.png', '.webp' })
      if ($imgs.Count -gt 0) {
        Write-Output ('=== ' + $_.FullName + '  (' + $imgs.Count + ' imagenes)')
        $imgs | ForEach-Object {
          Write-Output ('    {0}  {1:yyyy-MM-dd HH:mm}  {2}KB' -f $_.Name, $_.LastWriteTime, [math]::Round($_.Length / 1KB, 0))
        }
      }
    }
}
