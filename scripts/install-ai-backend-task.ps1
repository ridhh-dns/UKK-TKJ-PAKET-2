# =============================================================================
# install-ai-backend-task.ps1
# Daftarkan Task Scheduler "UKK-TKJ-PAKET-2 AI Backend" (trigger At Startup).
#
# Mode pendaftaran (otomatis):
#   1. elevated + S4U        -> "Run whether user is logged on or not" tanpa password.
#   2. elevated + password   -> Get-Credential (hanya untuk pendaftaran; tidak ditulis
#                               ke file/log manapun).
#   3. tanpa elevasi         -> fallback trigger At Logon (backend hanya hidup
#                               setelah user login; ini konsekuensinya).
# Idempotent: task lama dengan nama sama diganti ulang.
# =============================================================================
[CmdletBinding()]
param(
    [string]$TaskName = 'UKK-TKJ-PAKET-2 AI Backend'
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerDir   = Join-Path $ProjectRoot 'server'
$Runner      = Join-Path $PSScriptRoot 'ai-backend-runner.ps1'
$Port        = 3001

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principalFull = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principalFull.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$runAs   = "$env:USERDOMAIN\$env:USERNAME"

Write-Host '== Instalasi task AI backend ==' -ForegroundColor Cyan
Write-Host ("Task name        : {0}" -f $TaskName)
Write-Host ("Project root     : {0}" -f $ProjectRoot)
Write-Host ("Backend dir      : {0}" -f $ServerDir)
Write-Host ("Run as           : {0}" -f $runAs)
Write-Host ("Elevated         : {0}" -f $isAdmin)

# ---- 1. Prasyarat ----
foreach ($cmd in @('node.exe', 'npm.cmd')) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $found) {
        Write-Error "$cmd tidak ditemukan di PATH. Instal Node.js terlebih dahulu."
        exit 1
    }
    Write-Host ("OK  {0,-8}: {1}" -f $cmd, $found.Source)
}

if (-not (Test-Path (Join-Path $ServerDir 'package.json'))) {
    Write-Error "package.json tidak ditemukan di server/. Periksa lokasi backend."
    exit 1
}
Write-Host 'OK  server/package.json ada'

if (-not (Test-Path (Join-Path $ServerDir '.env'))) {
    Write-Warning "server/.env belum ada (hanya cek keberadaan, isi tidak dibaca). Path env.example: server/.env.example"
} else {
    Write-Host 'OK  server/.env ada (isi tidak dibaca)'
}

if (-not (Test-Path $Runner)) {
    Write-Error "ai-backend-runner.ps1 tidak ditemukan: $Runner"
    exit 1
}

# ---- 2. Cek port (tidak pernah membunuh proses lain) ----
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
if ($conn) {
    $ownerProc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)"
    Write-Warning ("Port {0} sedang dipakai: pid={1} name={2}. Task tetap didaftarkan; runner hanya akan memulai backend saat port bebas dan tidak mengubah proses lain." -f $Port, $ownerProc.ProcessId, $ownerProc.Name)
} else {
    Write-Host "OK  port $Port bebas"
}

# ---- 3. Registrasi ----
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Host 'Task lama ditemukan - mengganti ulang (idempotent)...'
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" `
    -WorkingDirectory $ProjectRoot

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$registered = $false

if ($isAdmin) {
    # Mode 1: S4U - tanpa password, bisa jalan tanpa user login.
    try {
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId $runAs -LogonType S4U -RunLevel Limited
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
            -Settings $settings -Principal $principal -Force | Out-Null
        $registered = $true
        Write-Host ("TERDAFTAR: trigger At Startup, mode S4U (tanpa password, jalur tanpa login).") -ForegroundColor Green
    } catch {
        Write-Warning ("S4U gagal: {0}" -f $_.Exception.Message)
    }

    # Mode 2: password aman via prompt, hanya disimpan oleh Windows (credential blob).
    if (-not $registered) {
        try {
            Write-Host 'Diperlukan password akun Windows untuk pendaftaran "Run whether user is logged on or not".'
            Write-Host 'Password TIDAK akan ditulis ke file atau log.'
            $cred = Get-Credential -UserName $runAs -Message 'Password akun Windows untuk mendaftarkan task AI backend'
            if ($cred) {
                $trigger = New-ScheduledTaskTrigger -AtStartup
                Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
                    -Settings $settings `
                    -User $cred.UserName -Password $cred.GetNetworkCredential().Password -Force | Out-Null
                $registered = $true
                Write-Host ("TERDAFTAR: trigger At Startup, mode password.") -ForegroundColor Green
            }
        } catch {
            Write-Warning ("Pendaftaran dengan password gagal: {0}" -f $_.Exception.Message)
        }
    }
}

# Mode 3: fallback At Logon (tidak butuh elevasi).
if (-not $registered) {
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $principal = New-ScheduledTaskPrincipal -UserId $runAs -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal -Force | Out-Null
    $registered = $true
    Write-Host ''
    Write-Warning 'FALLBACK: task terdaftar dengan trigger At Logon.'
    Write-Warning 'Konsekuensi: backend hanya hidup SETELAH user Windows login. Saat komputer menyala tapi belum login (mis. layar kunci sebelum login), backend belum berjalan.'
    Write-Warning 'Untuk mode At Startup penuh, jalankan sekali: PowerShell as Administrator -> scripts\install-ai-backend-task.ps1'
}

# ---- 4. Mulai langsung ----
try {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host ('Task dimulai sekarang. Status/cek: scripts\status-ai-backend-task.ps1') -ForegroundColor Green
} catch {
    Write-Warning ("Task terdaftar tapi gagal dimulai: {0}" -f $_.Exception.Message)
}
