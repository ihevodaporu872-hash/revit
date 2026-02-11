$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root
$envPath = Join-Path $repo '.env'

if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*$') { return }
    if ($_ -match '^\s*#') { return }
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
      $name = $parts[0].Trim()
      $value = $parts[1].Trim()
      if ($name) { Set-Item -Path "Env:$name" -Value $value }
    }
  }
}

if (-not $env:PORT) { $env:PORT = '3101' }
if (-not $env:ENABLE_RVT_CONVERTER) { $env:ENABLE_RVT_CONVERTER = 'true' }

$node = 'node'
$server = Join-Path $repo 'server\index.js'
Start-Process -FilePath $node -ArgumentList @($server) -WorkingDirectory $repo -WindowStyle Hidden
