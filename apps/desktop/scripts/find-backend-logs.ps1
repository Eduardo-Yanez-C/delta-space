$ErrorActionPreference = "SilentlyContinue"
$matches = Get-ChildItem -Path $env:APPDATA -Recurse -Filter "backend.log" -ErrorAction SilentlyContinue
if ($null -eq $matches) { return }
$matches | Select-Object -First 20 -Property FullName | ForEach-Object { $_.FullName }

