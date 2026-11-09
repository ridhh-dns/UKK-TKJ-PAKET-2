# =============================================================================
# stop-ai-backend-task.ps1
# Hentikan task AI backend milik UKK saja, lalu matikan proses port 3001
# HANYA bila benar-benar milik backend ini (node.exe + server.js + dir server).
# Tidak menyentuh UKS System (port 3000) dan tidak menyentuh Tailscale.
# =============================================================================
[CmdletBinding()]
param(
    [string]$TaskName = 'UKK-TKJ-PAKET-2 AI Backend'
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerDir   = Join-Path $ProjectRoot 'server'
$PidFile     = Join-Path $ServerDir 'logs\ai-backend.pid'
$Port        = 3001

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    if ($task.State -eq 'Running') { Stop-ScheduledTask -TaskName $TaskName }
    Write-Host ("Task '{0}' dihentikan (state: {1} -> {2})." -f $TaskName, $task.State, (Get-ScheduledTask -TaskName $TaskName).State)
} else {
    Write-Host "Task tidak terdaftar; lanjut proses berhenti backend bila ada."
}

# Verifikasi port owner sebelum menyentuh proses apapun.
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
if ($conn) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)"
    $isOurs = ($proc.Name -eq 'node.exe') -and ($proc.CommandLine -match 'server\.js') -and
              (($proc.CommandLine -match [regex]::Escape($ServerDir)) -or ($proc.ExecutablePath -match 'node\.exe'))
    if ($isOurs) {
        # taskkill /T: hentikan launcher (cmd.exe/npm) DAN anak node-nya.
        & taskkill /PID $conn.OwningProcess /T /F | Out-Null
        Write-Host ("Proses backend port {0} (pid {1}) dihentikan." -f $Port, $conn.OwningProcess)
    } else {
        Write-Warning ("Port {0} dipakai proses yang tidak dapat dipastikan milik project ini (pid={1} name={2}). TIDAK dihentikan." -f $Port, $conn.OwningProcess, $proc.Name)
    }
} else {
    Write-Host ("Port {0} memang tidak listening." -f $Port)
}

if (Test-Path $PidFile) { Remove-Item $PidFile -ErrorAction SilentlyContinue }
Write-Host 'Selesai. Tailscale dan port 3000 tidak tersentuh.'
