 $ErrorActionPreference = "Stop"
 $scriptDir = Split-Path -Parent $PSCommandPath
 $raw = $env:RGMS_PINGER_URL
 if (-not $raw -or $raw -eq "") {
   $cfg = Join-Path $scriptDir "pinger-url.txt"
   if (Test-Path $cfg) { $raw = Get-Content -Path $cfg -TotalCount 1 }
 }
 if (-not $raw -or $raw -eq "") { exit 0 }
 
 # Normalize URL: if only host provided, ping /health
 try {
   $u = [System.Uri]$raw
   if ($u.AbsolutePath -eq "/" -or [string]::IsNullOrWhiteSpace($u.AbsolutePath)) {
     $url = ($u.Scheme + "://" + $u.Host + (if ($u.Port -ne 80 -and $u.Port -ne 443 -and $u.Port -ne 0) { ":" + $u.Port } else { "" }) + "/health")
   } else {
     $url = $raw
   }
 } catch {
   $url = $raw
 }
 
 $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
 $logPath = Join-Path $scriptDir "pinger.log"
 
 # Try /health first, then fallback to root
 $targets = @($url)
 try {
   $u2 = [System.Uri]$url
   $root = $u2.Scheme + "://" + $u2.Host + (if ($u2.Port -ne 80 -and $u2.Port -ne 443 -and $u2.Port -ne 0) { ":" + $u2.Port } else { "" }) + "/"
   if ($root -ne $url) { $targets += $root }
 } catch { }
 
 function Invoke-PingOnce {
   param([string[]]$PingTargets)
   $statusOut = $null
   foreach ($t in $PingTargets) {
     try {
       $resp = Invoke-WebRequest -Uri $t -Method Head -TimeoutSec 15 -UseBasicParsing
       $statusOut = $resp.StatusCode
       if ($statusOut) { break }
     } catch {
       try {
         $resp = Invoke-WebRequest -Uri $t -Method Get -TimeoutSec 20 -UseBasicParsing
         $statusOut = $resp.StatusCode
         if ($statusOut) { break }
       } catch {
         $statusOut = "error: " + $_.Exception.Message
       }
     }
   }
   $tsNow = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
   Add-Content -Path $logPath -Value ("[" + $tsNow + "] " + $url + " " + $statusOut)
 }
 
 # Interval and loop controls
 $intervalSec = 60
 if ($env:RGMS_PINGER_INTERVAL_SEC -and [int]::TryParse($env:RGMS_PINGER_INTERVAL_SEC, [ref]$intervalSec)) { }
 $shouldLoop = $true
 if ($env:RGMS_PINGER_LOOP -and ($env:RGMS_PINGER_LOOP -eq "0" -or $env:RGMS_PINGER_LOOP -eq "false")) { $shouldLoop = $false }
 
 if ($shouldLoop) {
   Invoke-PingOnce -PingTargets $targets
   while ($true) {
     Start-Sleep -Seconds $intervalSec
     Invoke-PingOnce -PingTargets $targets
   }
 } else {
   Invoke-PingOnce -PingTargets $targets
 }
