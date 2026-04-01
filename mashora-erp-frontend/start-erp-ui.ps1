$ErrorActionPreference = "Stop"

$frontendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeModules = Join-Path $frontendRoot "node_modules"

if (!(Test-Path $nodeModules)) {
    npm install --no-package-lock
}

npm run dev
