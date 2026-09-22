<#
.SYNOPSIS
  Installs the FitPulse relay agent as a Windows service.

.DESCRIPTION
  A terminal window running "npm start" dies when the window is closed, the
  staff member logs out, or Windows reboots after an update — and door
  blocking silently stops working until someone notices. A service starts
  before anyone logs in, restarts itself if it crashes, and comes back after
  a reboot on its own.

  Uses NSSM (https://nssm.cc) to wrap node.exe. Run from an ADMINISTRATOR
  PowerShell in the relay-agent folder:

      Set-ExecutionPolicy -Scope Process Bypass -Force
      .\install-service.ps1

.PARAMETER ServiceName
  Name of the Windows service. Default: FitPulseRelay

.PARAMETER Uninstall
  Remove the service instead of installing it.
#>
param(
  [string]$ServiceName = "FitPulseRelay",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this from an Administrator PowerShell (right-click PowerShell -> Run as administrator)."
  }
}

Assert-Admin

$dir = $PSScriptRoot

# Windows PowerShell 5.1 (the default on Windows) has no null-conditional
# operator, so resolve these the long way.
function Get-ExePath([string]$name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$nssm = Get-ExePath "nssm"

if ($Uninstall) {
  if (-not $nssm) { throw "nssm not found on PATH — cannot remove the service." }
  & $nssm stop $ServiceName confirm 2>$null | Out-Null
  & $nssm remove $ServiceName confirm
  Write-Host "Removed service '$ServiceName'." -ForegroundColor Green
  return
}

# ── Preconditions the service cannot fix for itself ───────────────────
$node = Get-ExePath "node"
if (-not $node) { throw "Node.js is not installed or not on PATH. Install Node 18+ from nodejs.org first." }

foreach ($f in @(".env", "service-account.json")) {
  if (-not (Test-Path (Join-Path $dir $f))) {
    throw "$f is missing from $dir. Run 'npm run doctor' and fix the setup before installing the service."
  }
}
if (-not (Test-Path (Join-Path $dir "node_modules"))) {
  throw "Dependencies are not installed. Run 'npm install' in $dir first."
}

if (-not $nssm) {
  Write-Host @"
NSSM is not installed. Install it, then re-run this script:

    winget install NSSM.NSSM

(or download from https://nssm.cc/download and put nssm.exe on your PATH)
"@ -ForegroundColor Yellow
  return
}

# ── Install ───────────────────────────────────────────────────────────
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
  Write-Host "Service '$ServiceName' already exists — reconfiguring it." -ForegroundColor Yellow
  & $nssm stop $ServiceName confirm 2>$null | Out-Null
} else {
  & $nssm install $ServiceName $node "index.js"
}

# AppDirectory matters: .env and service-account.json are resolved relative
# to the working directory, not to node.exe.
& $nssm set $ServiceName AppDirectory   $dir
& $nssm set $ServiceName AppParameters  "index.js"
& $nssm set $ServiceName DisplayName    "FitPulse Device Relay"
& $nssm set $ServiceName Description    "Applies FitPulse door block/unblock commands to the Hikvision terminal on this LAN."
& $nssm set $ServiceName Start          SERVICE_AUTO_START
& $nssm set $ServiceName AppStdout      (Join-Path $dir "service-out.log")
& $nssm set $ServiceName AppStderr      (Join-Path $dir "service-err.log")
& $nssm set $ServiceName AppRotateFiles 1
& $nssm set $ServiceName AppRotateBytes 10485760
# Restart on any exit, after 10s — the agent exits deliberately on a
# Firestore listener error so that a restart re-establishes the stream.
& $nssm set $ServiceName AppExit Default Restart
& $nssm set $ServiceName AppRestartDelay 10000

& $nssm start $ServiceName

Start-Sleep -Seconds 3
$svc = Get-Service -Name $ServiceName
Write-Host ""
Write-Host "Service '$ServiceName' is $($svc.Status)." -ForegroundColor Green
Write-Host "Logs:    $(Join-Path $dir 'relay-agent.log')"
Write-Host "Stop:    nssm stop $ServiceName"
Write-Host "Restart: nssm restart $ServiceName   (do this after every 'git pull')"
Write-Host ""
Write-Host "Now stop this PC from sleeping, or the relay sleeps with it:" -ForegroundColor Yellow
Write-Host "    powercfg /change standby-timeout-ac 0"
Write-Host "    powercfg /change hibernate-timeout-ac 0"
