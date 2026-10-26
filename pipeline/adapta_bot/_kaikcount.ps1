$n = 0
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ForEach-Object {
  if ($_.CommandLine -match 'user-data-dir="?([^"\s]+)"?') {
    $p = $matches[1]
    if ($p -like '*workplace-bot2\worker\browser_profile_deepseek*') { $n++ }
  }
}
$n
