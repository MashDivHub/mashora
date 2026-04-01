$ErrorActionPreference = "Stop"

$v2Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $v2Root
$backendRoot = Join-Path $v2Root "backend"
$frontendRoot = Join-Path $v2Root "frontend"
$tmpRoot = Join-Path $repoRoot "tmp"

if (!(Test-Path $tmpRoot)) {
    New-Item -ItemType Directory -Path $tmpRoot | Out-Null
}

function Stop-ProcessOnPort([int]$Port) {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn -and $conn.OwningProcess -gt 0) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
            Start-Sleep -Seconds 1
        } catch {
            Write-Warning "Failed to stop process on port ${Port}: $($_.Exception.Message)"
        }
    }
}

function Start-BackgroundProcess(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [string]$StdOutPath,
    [string]$StdErrPath
) {
    Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath | Out-Null
}

Stop-ProcessOnPort -Port 8069
Stop-ProcessOnPort -Port 3001

$backendLog = Join-Path $tmpRoot "mashora-v2-backend-8069.log"
$backendErrLog = Join-Path $tmpRoot "mashora-v2-backend-8069.err.log"
$frontendLog = Join-Path $tmpRoot "mashora-v2-frontend-3001.log"
$frontendErrLog = Join-Path $tmpRoot "mashora-v2-frontend-3001.err.log"

Start-BackgroundProcess `
    -FilePath "C:\Python314\python.exe" `
    -Arguments @(
        "mashora-bin",
        "server",
        "--http-port=8069",
        "--addons-path=addons,mashora/addons",
        "--db_host=localhost",
        "--db_port=5433",
        "--db_user=mashora",
        "--db_password=mashora_dev",
        "-d",
        "mashora_demo"
    ) `
    -WorkingDirectory $backendRoot `
    -StdOutPath $backendLog `
    -StdErrPath $backendErrLog

Start-BackgroundProcess `
    -FilePath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -Arguments @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "npm run dev"
    ) `
    -WorkingDirectory $frontendRoot `
    -StdOutPath $frontendLog `
    -StdErrPath $frontendErrLog

Start-Sleep -Seconds 6
$backendProcess = Get-NetTCPConnection -State Listen -LocalPort 8069 -ErrorAction SilentlyContinue | Select-Object -First 1
$frontendProcess = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1

Write-Host "Mashora V2 started."
Write-Host "Backend PID: $($backendProcess.OwningProcess) on http://localhost:8069"
Write-Host "Frontend PID: $($frontendProcess.OwningProcess) on http://localhost:3001"
