$n = 0
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ForEach-Object {
  if ($_.CommandLine -match 'user-data-dir="?([^"\s]+)"?') {
    $p = $matches[1]
    if ($p -like '*workplace-bot\worker\browser_profile_deepseek*' -and $p -notlike '*workplace-bot2*') { $n++ }
  }
}
$n
