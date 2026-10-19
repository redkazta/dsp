$root = 'C:\Users\Angel\Downloads'
$dir = Get-ChildItem -LiteralPath $root -Directory | Where-Object { $_.Name -like 'D*P-2026*' } | Select-Object -First 1

if (-not $dir) { Write-Output 'NO ENCONTRADA'; exit }

Write-Output ('raiz: ' + $dir.FullName)
Get-ChildItem -LiteralPath $dir.FullName -Recurse -Directory | ForEach-Object {
  Write-Output ('DIR  ' + $_.FullName.Substring($dir.FullName.Length))
}
Write-Output '--- archivos ---'
Get-ChildItem -LiteralPath $dir.FullName -Recurse -File | Sort-Object FullName | ForEach-Object {
  Write-Output ('{0}  {1}KB' -f $_.FullName.Substring($dir.FullName.Length), [math]::Round($_.Length / 1KB, 0))
}
