$ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -ge 1024 } | Select-Object -Expand LocalPort -Unique
foreach ($p in $ports) {
  try {
    $list = Invoke-RestMethod "http://127.0.0.1:$p/json/list" -TimeoutSec 1 -ErrorAction Stop
    if (@($list | Where-Object { $_.type -eq 'page' -and $_.url -match 'adapta.one/agentic-chat' }).Count) { Write-Output $p; break }
  } catch {}
}
