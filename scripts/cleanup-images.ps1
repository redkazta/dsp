$ErrorActionPreference = 'Stop'

$imgDir = 'C:\Users\Angel\Desktop\DSP\storefront\public\img'

# -sq.jpg eran copias temporales para revisar el encuadre
Get-ChildItem -LiteralPath $imgDir -File -Filter '*-sq.jpg' | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Force
  Write-Output ('borrada ' + $_.Name)
}

Write-Output '--- /img ---'
Get-ChildItem -LiteralPath $imgDir -File | Sort-Object Name | ForEach-Object {
  Write-Output ('{0}  {1}KB' -f $_.Name, [math]::Round($_.Length / 1KB, 0))
}
