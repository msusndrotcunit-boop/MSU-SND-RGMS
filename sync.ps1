Set-Location "c:\Users\Toshiba Dynabook\Documents\trae_projects\ROTC GRADING MANAGEMENT SYSTEM\MSU-SND-RGMS"
git config --global --add safe.directory "c:/Users/Toshiba Dynabook/Documents/trae_projects/ROTC GRADING MANAGEMENT SYSTEM/MSU-SND-RGMS"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path ".\sync.log" -Value "[$ts] start"
$fetchOut = & git fetch --all --prune 2>&1
if ($fetchOut) { Add-Content -Path ".\sync.log" -Value $fetchOut }
$rev = & git rev-list --left-right --count origin/main...HEAD
Add-Content -Path ".\sync.log" -Value "[$ts] ahead_behind $rev"
$needPull = $false
$parts = $rev -split "\s+"
if ($parts.Length -ge 2) {
  if (($parts[0] -ne "0") -or ($parts[1] -ne "0")) { $needPull = $true }
}
if ($needPull) {
  $pullOut = & git pull --rebase --autostash 2>&1
  if ($pullOut) { Add-Content -Path ".\sync.log" -Value $pullOut }
} else {
  Add-Content -Path ".\sync.log" -Value "No changes"
}
Add-Content -Path ".\sync.log" -Value "[$ts] done"
