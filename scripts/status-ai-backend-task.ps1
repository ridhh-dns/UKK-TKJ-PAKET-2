# =============================================================================
# status-ai-backend-task.ps1
# Ringkasan status task + port 3001 + endpoint AI + lokasi log.
# =============================================================================
[CmdletBinding()]
param(
    [string]$TaskName = 'UKK-TKJ-PAKET-2 AI Backend'
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerDir   = Join-Path $ProjectRoot 'server'
$LogsDir     = Join-Path $ServerDir 'logs'
$LogFile     = Join-Path $LogsDir 'ai-backend.log'
$OutLog      = Join-Path $LogsDir 'ai-backend-stdout.log'
$ErrLog      = Join-Path $LogsDir 'ai-backend-stderr.log'
$Port        = 3001

Write-Host '== Status AI Backend UKK ==' -ForegroundColor Cyan

# --- Task Scheduler ---
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    $info = $task | Get-ScheduledTaskInfo
    Write-Host ("Task      : {0}" -f $TaskName)
    Write-Host ("State     : {0}" -f $task.State)
    $triggerNames = ($task.Triggers | ForEach-Object { $_.CimClass.CimClassName }) -join ', '
    Write-Host ("Triggers  : {0}" -f $triggerNames)
    Write-Host ("Run terakhir : {0} (hasil 0x{1:X})" -f $info.LastRunTime, $info.LastTaskResult)
    Write-Host ("Run berikutnya : {0}" -f $(if ($info.NextRunTime) { $info.NextRunTime } else { '-' }))
} else {
    Write-Warning ("Task '{0}' belum terdaftar. Jalankan scripts\install-ai-backend-task.ps1" -f $TaskName)
}

# --- Port 3001 ---
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
if ($conn) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)"
    Write-Host ("Port {0}  : AKTIF (pid {1} - {2})" -f $Port, $conn.OwningProcess, $proc.Name) -ForegroundColor Green
} else {
    Write-Host ("Port {0}  : TIDAK listening" -f $Port) -ForegroundColor Yellow
}

# --- Endpoint health (tanpa menyentuh .env / key) ---
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/ai/status" -UseBasicParsing -TimeoutSec 10
    Write-Host ("Endpoint  : GET /api/ai/status -> HTTP {0}" -f $res.StatusCode)
    Write-Host ("Isi       : {0}" -f $res.Content)
} catch {
    Write-Host ("Endpoint  : tidak merespons ({0})" -f $_.Exception.Message)
}

# --- Log ---
Write-Host ''
Write-Host ("Runner log   : {0}" -f $LogFile)
Write-Host ("Stdout log   : {0}" -f $OutLog)
Write-Host ("Stderr log   : {0}" -f $ErrLog)
if (Test-Path $LogFile) {
    Write-Host ''
    Write-Host '--- Baris terakhir runner log ---'
    Get-Content -Path $LogFile -Tail 6
}
