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
 
 $finalStatus = $null
 foreach ($t in $targets) {
   try {
     $resp = Invoke-WebRequest -Uri $t -Method Head -TimeoutSec 15 -UseBasicParsing
     $finalStatus = $resp.StatusCode
     if ($finalStatus) { break }
   } catch {
     try {
       $resp = Invoke-WebRequest -Uri $t -Method Get -TimeoutSec 20 -UseBasicParsing
       $finalStatus = $resp.StatusCode
       if ($finalStatus) { break }
     } catch {
       $finalStatus = "error: " + $_.Exception.Message
     }
   }
 }
 
 Add-Content -Path $logPath -Value ("[" + $ts + "] " + $url + " " + $finalStatus)
