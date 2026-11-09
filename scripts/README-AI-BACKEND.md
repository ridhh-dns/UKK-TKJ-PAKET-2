# AI Backend Otomatis (Task Scheduler)

Backend AI Tutor (port 3001, endpoint `/api/ai/chat` & `/api/ai/status`) dijalankan
terus-menerus di background oleh Windows Task Scheduler. `npm start` manual tidak
diperlukan lagi.

## Instalasi pertama kali

Jalankan sekali (pilih sesuai hak akses):

```powershell
# Rekomendasi (PowerShell as Administrator) — trigger At Startup tanpa login:
powershell -ExecutionPolicy Bypass -File "C:\xampp\htdocs\UKK-PAKET-2\scripts\install-ai-backend-task.ps1"
```

Tanpa hak Administrator, skrip otomatis memakai fallback trigger **At Logon**.

## Pemakaian harian

```powershell
# Mulai (dari PowerShell):
Start-ScheduledTask -TaskName "UKK-TKJ-PAKET-2 AI Backend"

# Periksa:
Get-ScheduledTask -TaskName "UKK-TKJ-PAKET-2 AI Backend"
powershell -ExecutionPolicy Bypass -File "C:\xampp\htdocs\UKK-PAKET-2\scripts\status-ai-backend-task.ps1"

# Hentikan (tidak menyentuh UKS port 3000 maupun Tailscale):
Stop-ScheduledTask -TaskName "UKK-TKJ-PAKET-2 AI Backend"
powershell -ExecutionPolicy Bypass -File "C:\xampp\htdocs\UKK-PAKET-2\scripts\stop-ai-backend-task.ps1"
```

Builder manual tanpa task (mis. sesi sementara):

```cmd
C:\xampp\htdocs\UKK-PAKET-2\scripts\start-ai-backend-background.cmd
```

## Cara kerja watchdog

- `ai-backend-runner.ps1` memeriksa port 3001 tiap 15 detik.
- Backend mati/crash → dijalankan ulang otomatis lewat `npm start` (timeout health 60 detik).
- Port dipakai proses LAIN → **dibiarkan**, dicatat di log, tidak dibunuh.
- Instance tunggal: setting task `MultipleInstances: IgnoreNew`.
- Log: `server\logs\ai-backend.log` (+ stdout/stderr per peluncuran), dipotong otomatis di 1 MB.

## Keamanan

- `server/.env` (termasuk `GROQ_API_KEY`) tidak pernah dibaca, dicetak, atau dipindahkan
  oleh runner maupun task. API key TIDAK pernah di sisi frontend.
- Pendaftaran mode password hanya memakai `Get-Credential`; nilai password tidak ditulis
  di file/log manapun.

## Kondisi runtime

| Kondisi | Backend tetap hidup? |
|---|---|
| CMD/PowerShell ditutup | ya |
| Node crash | ya — dihidupkan ulang watchdog |
| User log off / reboot | ya — task At Startup menyalakan kembali (mode S4U/password); pada mode fallback At Logon, hidup setelah login |
| Komputer **sleep** | **tidak** — lakukan pengaturan di bawah |
| Komputer mati / listrik putih | **tidak** |

Agar backend + Tailscale Funnel tetap melayani internet saat komputer tidak dipakai,
set: **Settings > System > Power > "Put my device to sleep" = Never ketika tercolok listrik**
(plugged in; biarkan sleep tetap berlaku di baterai bila laptop). Konsekuensi: konsumsi daya
bertambah dan layar mungkin tetap bisa mati (sleep hanya bila diset Never). Perhatikan juga:
backend maupun Funnel **tidak bisa melayani internet saat komputer mati atau koneksi putus** —
sifat ini tidak dapat diatasi oleh Task Scheduler.
