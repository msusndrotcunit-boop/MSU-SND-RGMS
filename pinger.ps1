 $ErrorActionPreference = "Stop"
 $scriptDir = Split-Path -Parent $PSCommandPath
 $url = $env:RGMS_PINGER_URL
 if (-not $url -or $url -eq "") {
   $cfg = Join-Path $scriptDir "pinger-url.txt"
   if (Test-Path $cfg) { $url = Get-Content -Path $cfg -TotalCount 1 }
 }
 if (-not $url -or $url -eq "") { exit 0 }
 $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
 $logPath = Join-Path $scriptDir "pinger.log"
 try {
   $resp = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 15 -UseBasicParsing
   $status = $resp.StatusCode
 } catch {
   $status = "error: " + $_.Exception.Message
 }
 Add-Content -Path $logPath -Value ("[" + $ts + "] " + $url + " " + $status)
