$ErrorActionPreference = "Stop"

$base = "http://localhost:4000"
$email = "eduardo.yanez.concha@gmail.com"
$pass = "admin123"

Write-Output "[VALIDATE] Login..."
$body = @{ email = $email; password = $pass } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri ($base + "/api/auth/login") -ContentType "application/json" -Body $body
$token = $login.accessToken

if (-not $token) {
  throw "No accessToken returned"
}

$h = @{ Authorization = ("Bearer " + $token) }

Write-Output "[VALIDATE] GET external-indicators..."
$ind = Invoke-RestMethod -Method Get -Uri ($base + "/api/dashboard/external-indicators") -Headers $h
Write-Output ("[VALIDATE] external-indicators error=" + $ind.error)
Write-Output ("[VALIDATE] dolar.value=" + $ind.dolar.value + " uf.value=" + $ind.uf.value + " ipc.value=" + $ind.ipc.value)

$periods = @("weekly","monthly","yearly")
foreach ($p in $periods) {
  Write-Output ("[VALIDATE] GET series period=" + $p)
  $s = Invoke-RestMethod -Method Get -Uri ($base + "/api/dashboard/external-indicators/series?period=" + $p) -Headers $h

  $dC = if ($null -eq $s.dolar) { -1 } else { $s.dolar.Count }
  $uC = if ($null -eq $s.uf) { -1 } else { $s.uf.Count }
  $iC = if ($null -eq $s.ipc) { -1 } else { $s.ipc.Count }

  Write-Output ("[VALIDATE] counts dolar=" + $dC + " uf=" + $uC + " ipc=" + $iC + " error=" + $s.error)
}

