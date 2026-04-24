param(
  [switch]$SetupOnly,
  [switch]$IncludeMobile,
  [switch]$SkipInstall,
  [switch]$ForceInstall,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $RepoRoot 'packages\api'
$WebDir = Join-Path $RepoRoot 'packages\web'
$MobileDir = Join-Path $RepoRoot 'packages\mobile'
$TempDir = Join-Path $RepoRoot '.tmp'
$PreferredApiPort = 3452
$ApiPort = $PreferredApiPort
$WebPort = 3000
$ExpoPort = 8081
$ApiHealthUrl = "http://localhost:$ApiPort/health"
$WebHealthUrl = "http://localhost:$WebPort"
$ApiVenvDirName = '.venv-windows311'
$ApiVenvDir = Join-Path $ApiDir $ApiVenvDirName
$ApiPython = Join-Path $ApiVenvDir 'Scripts\python.exe'
$ApiLog = Join-Path $ApiDir 'api-win.log'
$ApiErrLog = Join-Path $ApiDir 'api-win.err.log'
$WebLog = Join-Path $WebDir 'web-win.log'
$WebErrLog = Join-Path $WebDir 'web-win.err.log'
$MobileLog = Join-Path $MobileDir 'mobile-win.log'
$MobileErrLog = Join-Path $MobileDir 'mobile-win.err.log'

function Write-Section {
  param([string]$Message)
  Write-Host ''
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Set-ApiPortContext {
  param([int]$Port)

  $script:ApiPort = $Port
  $script:ApiHealthUrl = "http://localhost:$Port/health"
}

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Initialize-TempEnvironment {
  if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir | Out-Null
  }

  $env:TEMP = $TempDir
  $env:TMP = $TempDir
}

function Normalize-ProcessEnvironment {
  $processVars = [System.Environment]::GetEnvironmentVariables('Process')
  $pathValue = $null

  foreach ($key in @('Path', 'PATH')) {
    if ($processVars.Contains($key) -and $processVars[$key]) {
      $pathValue = [string]$processVars[$key]
      break
    }
  }

  if ($null -ne $pathValue) {
    [System.Environment]::SetEnvironmentVariable('PATH', $null, 'Process')
    [System.Environment]::SetEnvironmentVariable('Path', $pathValue, 'Process')
    $env:Path = $pathValue
  }
}

function Get-PythonExecutableVersion {
  param([string]$ExecutablePath)

  if (-not $ExecutablePath -or -not (Test-Path $ExecutablePath)) {
    return $null
  }

  if ($ExecutablePath -match '\\WindowsApps\\') {
    return $null
  }

  try {
    $versionOutput = & $ExecutablePath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if ($LASTEXITCODE -eq 0 -and $versionOutput) {
      return ($versionOutput | Select-Object -First 1).Trim()
    }
  } catch {
  }

  return $null
}

function Get-PythonInstallGuidance {
  $guidance = @"
Python 3.11 or 3.12 was not found on this machine.

Install one of the supported versions, then run this script again:
  1. Recommended: winget install -e --id Python.Python.3.11
     or:          winget install -e --id Python.Python.3.12
  2. Or download Windows installers from:
     https://www.python.org/downloads/windows/

If Python was just installed, close this terminal window and run the launcher again so PATH changes take effect.
"@

  return $guidance.Trim()
}

function Get-CompatiblePythonSpec {
  if (Test-CommandExists 'py') {
    $installed = & py -0p 2>$null
    if ($LASTEXITCODE -eq 0 -and $installed) {
      foreach ($version in @('3.11', '3.12')) {
        if ($installed -match [regex]::Escape("-V:$version")) {
          return @{
            Display = "py -$version"
            Launcher = 'py'
            Args = @("-$version")
            Version = $version
          }
        }
      }
    }
  }

  foreach ($commandName in @('python', 'python3')) {
    if (Test-CommandExists $commandName) {
      try {
        $commandInfo = Get-Command $commandName -ErrorAction SilentlyContinue | Select-Object -First 1
        $commandPath = if ($commandInfo) { $commandInfo.Source } else { $null }
        $version = if ($commandPath) { Get-PythonExecutableVersion -ExecutablePath $commandPath } else { $null }
        if ($version -in @('3.11', '3.12')) {
          return @{
            Display = $commandPath
            Launcher = $commandPath
            Args = @()
            Version = $version
          }
        }
      } catch {
      }
    }
  }

  $candidatePaths = New-Object System.Collections.Generic.List[string]
  $seenCandidates = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

  $registryRoots = @(
    'HKCU:\Software\Python\PythonCore',
    'HKLM:\Software\Python\PythonCore',
    'HKLM:\Software\WOW6432Node\Python\PythonCore'
  )

  foreach ($root in $registryRoots) {
    if (-not (Test-Path $root)) {
      continue
    }

    foreach ($versionKey in Get-ChildItem -Path $root -ErrorAction SilentlyContinue) {
      if ($versionKey.PSChildName -notmatch '^3\.(11|12)') {
        continue
      }

      try {
        $installPath = (Get-ItemProperty -Path (Join-Path $versionKey.PSPath 'InstallPath') -ErrorAction Stop).'(default)'
        if ($installPath) {
          $pythonExe = Join-Path $installPath 'python.exe'
          if ($seenCandidates.Add($pythonExe)) {
            $candidatePaths.Add($pythonExe)
          }
        }
      } catch {
      }
    }
  }

  foreach ($baseDir in @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if (-not $baseDir) {
      continue
    }

    foreach ($candidate in @(
      (Join-Path $baseDir 'Programs\Python\Python311\python.exe'),
      (Join-Path $baseDir 'Programs\Python\Python312\python.exe'),
      (Join-Path $baseDir 'Python311\python.exe'),
      (Join-Path $baseDir 'Python312\python.exe')
    )) {
      if ($seenCandidates.Add($candidate)) {
        $candidatePaths.Add($candidate)
      }
    }

    foreach ($pattern in @(
      (Join-Path $baseDir 'Programs\Python\Python3*\python.exe'),
      (Join-Path $baseDir 'Python3*\python.exe')
    )) {
      foreach ($resolved in @(Get-ChildItem -Path $pattern -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)) {
        if ($seenCandidates.Add($resolved)) {
          $candidatePaths.Add($resolved)
        }
      }
    }
  }

  foreach ($candidate in $candidatePaths) {
    $version = Get-PythonExecutableVersion -ExecutablePath $candidate
    if ($version -in @('3.11', '3.12')) {
      return @{
        Display = $candidate
        Launcher = $candidate
        Args = @()
        Version = $version
      }
    }
  }

  throw (Get-PythonInstallGuidance)
}

function Invoke-CompatiblePython {
  param(
    [hashtable]$PythonSpec,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $PythonSpec.Launcher @($PythonSpec.Args + $Arguments)
    if ($LASTEXITCODE -ne 0) {
      throw "Python command failed: $($PythonSpec.Display) $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Test-ApiPythonReady {
  if (-not (Test-Path $ApiPython)) {
    return $false
  }

  Push-Location $ApiDir
  try {
    & $ApiPython -c "import fastapi, uvicorn" *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    Pop-Location
  }
}

function Test-NodeModulesReady {
  return (Test-Path (Join-Path $RepoRoot 'node_modules')) -and (Test-Path (Join-Path $WebDir 'node_modules'))
}

function Ensure-NodeDependencies {
  if ($SkipInstall) {
    Write-Host 'Skipping pnpm install.'
    return
  }

  if ((Test-NodeModulesReady) -and (-not $ForceInstall)) {
    Write-Host 'Node dependencies already exist. Skipping pnpm install. Use -ForceInstall to reinstall.'
    return
  }

  Write-Section 'Installing pnpm dependencies'
  Push-Location $RepoRoot
  try {
    & pnpm install
    if ($LASTEXITCODE -ne 0) {
      if (Test-NodeModulesReady) {
        Write-Warning 'pnpm install failed, but existing node_modules were found. Continuing with current dependencies.'
        return
      }

      throw 'pnpm install failed and no usable node_modules were found.'
    }
  } finally {
    Pop-Location
  }
}

function Ensure-ApiEnvironment {
  param([hashtable]$PythonSpec)

  if ((Test-ApiPythonReady) -and (-not $ForceInstall) -and (-not $SkipInstall)) {
    Write-Host "Windows API environment already exists at $ApiVenvDirName."
    return
  }

  if (-not (Test-Path $ApiPython)) {
    Write-Section 'Creating Windows API virtual environment'
    Invoke-CompatiblePython -PythonSpec $PythonSpec -Arguments @('-m', 'venv', $ApiVenvDirName) -WorkingDirectory $ApiDir
  }

  if (-not (Test-Path $ApiPython)) {
    throw "Failed to create Windows API virtual environment at $ApiVenvDirName."
  }

  if ($SkipInstall) {
    Write-Host 'Skipping Python dependency installation.'
    return
  }

  if ((Test-ApiPythonReady) -and (-not $ForceInstall)) {
    Write-Host 'API dependencies already exist. Skipping pip install. Use -ForceInstall to reinstall.'
    return
  }

  Write-Section 'Installing API dependencies'
  Push-Location $ApiDir
  try {
    & $ApiPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) {
      throw 'Failed to upgrade pip in the Windows API virtual environment.'
    }

    & $ApiPython -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
      throw 'Failed to install API requirements.'
    }

    & $ApiPython -m pip install -e .
    if ($LASTEXITCODE -ne 0) {
      throw 'Failed to install the API package in editable mode.'
    }
  } finally {
    Pop-Location
  }
}

function Get-PortPids {
  param([int]$Port)

  $pids = @()

  try {
    $tcpConnections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    foreach ($connection in $tcpConnections) {
      if ($connection.OwningProcess) {
        $pids += [int]$connection.OwningProcess
      }
    }
  } catch {
  }

  if (-not $pids) {
    $matches = netstat -ano | Select-String "[:\.]$Port\s+.*LISTENING\s+(\d+)$"
    foreach ($match in $matches) {
      if ($match.Matches.Count -gt 0) {
        $portPid = $match.Matches[0].Groups[1].Value
        if ($portPid) {
          $pids += [int]$portPid
        }
      }
    }
  }

  return $pids | Select-Object -Unique
}

function Stop-PortProcess {
  param([int]$Port)

  foreach ($portPid in Get-PortPids -Port $Port) {
    try {
      $process = Get-Process -Id $portPid -ErrorAction SilentlyContinue
      if (-not $process) {
        continue
      }
      Write-Host "Stopping process on port ${Port}: $($process.ProcessName) ($portPid)" -ForegroundColor Yellow
      Stop-Process -Id $portPid -Force -ErrorAction Stop
    } catch {
      Write-Warning "Failed to stop process $portPid on port ${Port}: $($_.Exception.Message)"
    }
  }

  for ($i = 0; $i -lt 10; $i++) {
    if (-not (Get-PortPids -Port $Port)) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  $remaining = Get-PortPids -Port $Port
  if ($remaining) {
    throw "Port ${Port} is still in use by PID(s): $($remaining -join ', ')"
  }
}

function Reset-LogFiles {
  param([string[]]$Paths)

  foreach ($path in $Paths) {
    if (Test-Path $path) {
      $removed = $false
      for ($i = 0; $i -lt 10; $i++) {
        try {
          Remove-Item -LiteralPath $path -Force -ErrorAction Stop
          $removed = $true
          break
        } catch {
          Start-Sleep -Milliseconds 500
        }
      }

      if (-not $removed) {
        Write-Host "Reusing log file: $path" -ForegroundColor DarkYellow
      }
    }
  }
}

function Find-AvailablePort {
  param([int[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if (-not (Get-PortPids -Port $candidate)) {
      return $candidate
    }
  }

  throw "No available API port was found in candidates: $($Candidates -join ', ')"
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$Attempts = 30,
    [int]$DelaySeconds = 2
  )

  for ($i = 0; $i -lt $Attempts; $i++) {
    Start-Sleep -Seconds $DelaySeconds
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
    }
  }

  return $false
}

function Wait-ForApiReady {
  param(
    [System.Diagnostics.Process]$Process,
    [string]$Url,
    [int]$Port,
    [int]$Attempts = 30,
    [int]$DelaySeconds = 2
  )

  for ($i = 0; $i -lt $Attempts; $i++) {
    Start-Sleep -Seconds $DelaySeconds

    $currentProcess = Get-Process -Id $Process.Id -ErrorAction SilentlyContinue
    if (-not $currentProcess) {
      return $false
    }

    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
    }
  }

  return $false
}

function Start-ApiProcess {
  Reset-LogFiles -Paths @($ApiLog, $ApiErrLog)

  return Start-Process -FilePath $ApiPython `
    -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$ApiPort") `
    -WorkingDirectory $ApiDir `
    -RedirectStandardOutput $ApiLog `
    -RedirectStandardError $ApiErrLog `
    -PassThru
}

function Start-WebProcess {
  Reset-LogFiles -Paths @($WebLog, $WebErrLog)

  $internalApiUrl = "http://localhost:$ApiPort/api"
  $internalUploadsUrl = "http://localhost:$ApiPort"
  $cmd = "set `"INTERNAL_API_URL=$internalApiUrl`" && set `"INTERNAL_API_URL_UPLOADS=$internalUploadsUrl`" && set `"NEXT_PUBLIC_DIRECT_API_URL=$internalApiUrl`" && set `"NEXT_PUBLIC_DIRECT_API_PORT=$ApiPort`" && pnpm dev"

  return Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/c', $cmd) `
    -WorkingDirectory $WebDir `
    -RedirectStandardOutput $WebLog `
    -RedirectStandardError $WebErrLog `
    -PassThru
}

function Start-MobileProcess {
  Reset-LogFiles -Paths @($MobileLog, $MobileErrLog)

  return Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/c', 'npx expo start --clear --port 8081') `
    -WorkingDirectory $MobileDir `
    -RedirectStandardOutput $MobileLog `
    -RedirectStandardError $MobileErrLog `
    -PassThru
}

function Show-LogTail {
  param(
    [string]$Label,
    [string]$Path,
    [int]$Lines = 30
  )

  if (Test-Path $Path) {
    Write-Host ''
    Write-Host "[$Label]" -ForegroundColor DarkCyan
    Get-Content $Path -Tail $Lines
  }
}

function Pause-Launcher {
  if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Launcher finished. Press Enter to close this window'
  }
}

Write-Host '========================================'
Write-Host 'MeetMind Windows Launcher'
Write-Host '========================================'

if (-not (Test-CommandExists 'pnpm')) {
  throw 'pnpm was not found. Please install Node.js and pnpm first.'
}

Initialize-TempEnvironment
Normalize-ProcessEnvironment

$pythonSpec = Get-CompatiblePythonSpec
Write-Host "Using Python: $($pythonSpec.Display)"

Ensure-NodeDependencies
Ensure-ApiEnvironment -PythonSpec $pythonSpec

if ($SetupOnly) {
  Write-Host ''
  Write-Host 'Setup completed. No services were started.' -ForegroundColor Green
  Pause-Launcher
  exit 0
}

Write-Section 'Freeing ports'
try {
  Stop-PortProcess -Port $ApiPort
} catch {
  $fallbackApiPort = Find-AvailablePort -Candidates @(3453, 3454, 3455, 3456, 3457, 3458, 3459, 3460)
  Write-Host "Preferred API port $PreferredApiPort is occupied. Using fallback API port $fallbackApiPort for this launch." -ForegroundColor Yellow
  Set-ApiPortContext -Port $fallbackApiPort
}
Stop-PortProcess -Port $WebPort
if ($IncludeMobile) {
  Stop-PortProcess -Port $ExpoPort
}

Write-Section 'Starting API'
$apiProcess = Start-ApiProcess
if (-not (Wait-ForApiReady -Process $apiProcess -Url $ApiHealthUrl -Port $ApiPort -Attempts 20 -DelaySeconds 2)) {
  Show-LogTail -Label 'API stdout' -Path $ApiLog
  Show-LogTail -Label 'API stderr' -Path $ApiErrLog
  Pause-Launcher
  throw "API failed to become healthy at $ApiHealthUrl"
}
Write-Host "API is healthy. PID: $($apiProcess.Id)" -ForegroundColor Green

Write-Section 'Starting Web'
$webProcess = Start-WebProcess
if (-not (Wait-ForUrl -Url $WebHealthUrl -Attempts 40 -DelaySeconds 2)) {
  Show-LogTail -Label 'Web stdout' -Path $WebLog
  Show-LogTail -Label 'Web stderr' -Path $WebErrLog
  Pause-Launcher
  throw "Web failed to become ready at $WebHealthUrl"
}
Write-Host "Web is ready. PID: $($webProcess.Id)" -ForegroundColor Green

if ($IncludeMobile) {
  Write-Section 'Starting Mobile'
  $mobileProcess = Start-MobileProcess
  Start-Sleep -Seconds 5
  Write-Host "Mobile process started. PID: $($mobileProcess.Id)" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Startup completed successfully.' -ForegroundColor Green
Write-Host "Web:  http://localhost:$WebPort"
Write-Host "API:  http://localhost:$ApiPort"
Write-Host "Docs: http://localhost:$ApiPort/docs"
if ($IncludeMobile) {
  Write-Host "Expo: http://localhost:$ExpoPort"
}
Write-Host ''
Write-Host "API logs:  $ApiLog"
Write-Host "Web logs:  $WebLog"
if ($IncludeMobile) {
  Write-Host "Expo logs: $MobileLog"
}
Write-Host ''
Write-Host 'Usage examples:'
Write-Host '  .\start-project.cmd'
Write-Host '  .\start-project.cmd -SetupOnly'
Write-Host '  .\start-project.cmd -ForceInstall'
Write-Host '  .\start-project.cmd -IncludeMobile'

Pause-Launcher
