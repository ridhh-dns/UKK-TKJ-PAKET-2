# =============================================================================
# ai-backend-runner.ps1
# Watchdog persisten untuk backend AI Tutor (port 3001).
# Dipanggil oleh Task Scheduler (trigger startup/logon) maupun manual.
# Loop: pastikan backend listening; bila mati -> jalankan "npm start" lagi.
# Tidak pernah membaca atau mencatat isi server/.env.
# =============================================================================
[CmdletBinding()]
param(
    [int]$CheckIntervalSec = 15,
    [int]$StartTimeoutSec  = 60
)

$ErrorActionPreference = 'Continue'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerDir   = Join-Path $ProjectRoot 'server'
$LogsDir     = Join-Path $ServerDir 'logs'
$LogFile     = Join-Path $LogsDir 'ai-backend.log'
$OutLog      = Join-Path $LogsDir 'ai-backend-stdout.log'
$ErrLog      = Join-Path $LogsDir 'ai-backend-stderr.log'
$PidFile     = Join-Path $LogsDir 'ai-backend.pid'
$Port        = 3001
$MaxLogBytes = 1MB
$TailLines   = 1500

function Write-Log {
    param([string]$Message)
    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $LogFile -Value "[$stamp] $Message" -Encoding UTF8
}

function Rotate-Log {
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt $MaxLogBytes)) {
        $tail = Get-Content -Path $LogFile -Tail $TailLines -ErrorAction SilentlyContinue
        Set-Content -Path $LogFile -Value $tail -Encoding UTF8
        Write-Log ("log dipotong otomatis (ukuran melewati {0:N0} byte)" -f $MaxLogBytes)
    }
}

function Resolve-Npm {
    $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $node) { $node = 'D:\nodejs\node.exe' }
    if (Test-Path $node) {
        $cand = Join-Path (Split-Path -Parent $node) 'npm.cmd'
        if (Test-Path $cand) { return $cand }
    }
    $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if ($npm) { return $npm }
    foreach ($candidate in @('D:\nodejs\npm.cmd', 'C:\Program Files\nodejs\npm.cmd')) {
        if (Test-Path $candidate) { return $candidate }
    }
    Write-Log ("diagnostik npm: node cmd-path='{0}' PATH='{1}'" -f $node, $env:Path)
    return $null
}

function Get-PortOwner {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
    if (-not $conn) { return $null }
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
    return @{
        Pid         = $conn.OwningProcess
        Name        = $proc.Name
        CommandLine = $proc.CommandLine
    }
}

# Hanya proses node.exe dengan "server.js" yang dianggap milik backend ini.
function Test-PortOurs {
    param([hashtable]$Owner)
    if (-not $owner) { return $false }
    if ($owner.Name -ne 'node.exe') { return $false }
    return ($owner.CommandLine -match 'server\.js')
}

if (-not (Test-Path (Join-Path $ServerDir 'package.json'))) {
    Write-Log "FATAL: package.json tidak ditemukan di $ServerDir - runner dihentikan."
    exit 1
}

$npm = Resolve-Npm
if (-not $npm) {
    Write-Log "FATAL: npm.cmd tidak ditemukan (PATH & lokasi standar) - runner dihentikan."
    exit 1
}

Write-Log ("npm terverifikasi: {0} (ada: {1})" -f $npm, (Test-Path $npm))

Write-Log ("runner aktif. server dir={0} npm={1}" -f $ServerDir, $npm)

while ($true) {
    Rotate-Log

    $owner = Get-PortOwner

    if (-not $owner) {
        Write-Log "port 3001 tidak listening - memulai ulang backend..."
        try {
            $proc = Start-Process -FilePath 'cmd.exe' `
                -ArgumentList '/c', "`"$npm`" start" `
                -WorkingDirectory $ServerDir -WindowStyle Hidden `
                -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru
            Set-Content -Path $PidFile -Value $proc.Id -Encoding ASCII
            Write-Log ("backend diluncurkan. launcher pid={0}" -f $proc.Id)

            $listening = $false
            for ($i = 0; $i -lt [Math]::Max(1, [int]($StartTimeoutSec / 5)); $i++) {
                Start-Sleep -Seconds 5
                if (Get-PortOwner) { $listening = $true; break }
            }
            if ($listening) { Write-Log "port 3001 aktif." }
            else            { Write-Log "backend tidak listening setelah $StartTimeoutSec detik - cek ai-backend-stderr.log." }
        }
        catch {
            Write-Log ("ERROR saat meluncurkan backend: {0}" -f $_.Exception.Message)
        }
        Start-Sleep -Seconds 5
        continue
    }

    if (-not (Test-PortOurs -Owner $owner)) {
        Write-Log ("WARNING: port 3001 dipakai proses lain (pid={0} name={1}) - dilewati, tidak diubah." -f $owner.Pid, $owner.Name)
        Start-Sleep -Seconds ($CheckIntervalSec * 2)
        continue
    }

    Start-Sleep -Seconds $CheckIntervalSec
}
