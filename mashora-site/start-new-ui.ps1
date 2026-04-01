$ErrorActionPreference = "Stop"

$repoRoot = "C:\xampp\htdocs\mashora"
$erpRoot = Join-Path $repoRoot "mashora-v2\backend"
$frontendRoot = Join-Path $repoRoot "mashora-site\frontend"
$backendRoot = Join-Path $repoRoot "mashora-site\backend"
$tmpRoot = Join-Path $repoRoot "tmp"

if (!(Test-Path $tmpRoot)) {
    New-Item -ItemType Directory -Path $tmpRoot | Out-Null
}

function Get-ListeningProcessId([int]$Port) {
    $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $connection) {
        return $null
    }
    return $connection.OwningProcess
}

function Get-ProcessCommandLine([int]$ProcessId) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $null
    }
    return $process.CommandLine
}

function Stop-ProcessOnPort([int]$Port) {
    $processId = Get-ListeningProcessId -Port $Port
    if ($null -eq $processId) {
        return
    }

    if ($processId -le 0) {
        return
    }

    try {
        Stop-Process -Id $processId -Force -ErrorAction Stop
        Start-Sleep -Seconds 1
    } catch {
        Write-Warning "Failed to stop process $processId on port ${Port}: $($_.Exception.Message)"
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

# Keep the real ERP on its primary port.
Stop-ProcessOnPort -Port 8069

# Stop any old preview frontend that may still be running on 3000.
Stop-ProcessOnPort -Port 3000
$odooLog = Join-Path $tmpRoot "odoo-8069.log"
$odooErrLog = Join-Path $tmpRoot "odoo-8069.err.log"
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
    -WorkingDirectory $erpRoot `
    -StdOutPath $odooLog `
    -StdErrPath $odooErrLog

# Start the API backend if it is not already listening.
$apiProcessId = Get-ListeningProcessId -Port 8000
if ($null -eq $apiProcessId) {
    $apiLog = Join-Path $tmpRoot "api-8000.log"
    $apiErrLog = Join-Path $tmpRoot "api-8000.err.log"
    Start-BackgroundProcess `
        -FilePath "C:\Python314\python.exe" `
        -Arguments @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload") `
        -WorkingDirectory $backendRoot `
        -StdOutPath $apiLog `
        -StdErrPath $apiErrLog
}

# Start the separate portal preview on 3000 without replacing the ERP.
$frontendLog = Join-Path $tmpRoot "frontend-3000.log"
$frontendErrLog = Join-Path $tmpRoot "frontend-3000.err.log"
Start-BackgroundProcess `
    -FilePath (Join-Path $frontendRoot "node_modules\.bin\vite.cmd") `
    -Arguments @("--host", "0.0.0.0", "--port", "3000", "--strictPort") `
    -WorkingDirectory $frontendRoot `
    -StdOutPath $frontendLog `
    -StdErrPath $frontendErrLog

Start-Sleep -Seconds 6
$frontendProcessId = Get-ListeningProcessId -Port 3000
$apiProcessId = Get-ListeningProcessId -Port 8000
$odooProcessId = Get-ListeningProcessId -Port 8069

Write-Host "ERP + preview UI started."
Write-Host "ERP PID: $odooProcessId on http://localhost:8069"
Write-Host "API PID: $apiProcessId on http://localhost:8000"
Write-Host "Portal preview PID: $frontendProcessId on http://localhost:3000"
