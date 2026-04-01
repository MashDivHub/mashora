$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $backendRoot)
$tmpRoot = Join-Path $repoRoot "tmp"

if (!(Test-Path $tmpRoot)) {
    New-Item -ItemType Directory -Path $tmpRoot | Out-Null
}

$logPath = Join-Path $tmpRoot "mashora-v2-backend-8069.log"
$errPath = Join-Path $tmpRoot "mashora-v2-backend-8069.err.log"

python mashora-bin server `
    --http-port=8069 `
    --addons-path=addons,mashora/addons `
    --db_host=localhost `
    --db_port=5433 `
    --db_user=mashora `
    --db_password=mashora_dev `
    -d mashora_demo 2>> $errPath | Tee-Object -FilePath $logPath
