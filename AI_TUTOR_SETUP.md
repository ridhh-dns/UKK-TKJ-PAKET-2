# AI Tutor Setup — UKK TKJ Paket 2

Panduan konfigurasi lengkap fitur **AI Tutor UKK**: asisten teknis bermotor **Groq API** yang membaca dokumentasi Bagian 1–7, membimbing langkah demi langkah, dan menganalisis screenshot/file yang dikirim pengguna.

---

## 1. Arsitektur

```
 Browser (index.html + chat.js + chat.css)
        |  POST /api/ai/chat  (FormData: message, history, context, files)
        v
 Backend Node.js (server/server.js, port default 3001)
        |  - membangun indeks dokumentasi dari index.html saat startup
        |  - rate limit, validasi file, pemeriksaan pola kredensial
        |  - ekstraksi teks PDF (pdf-parse) — Groq tidak menerima PDF
        |  - loop tool calling (Format OpenAI Chat Completions)
        v
 Groq API (https://api.groq.com/openai/v1/chat/completions)
```

- Frontend **tidak pernah** memegang API key — hanya URL backend.
- Backend membaca dokumen langsung dari `index.html` saat boot; tidak ada salinan konten manual.
- Tools AI hanya dapat MEMBACA indeks dokumentasi. Tidak ada shell/terminal/DB.

## 2. Teknologi

- Node.js ≥ 20 (fetch bawaan; tanpa SDK AI)
- `express` 5, `multer` 2, `dotenv`, `pdf-parse` 2 (ekstraksi teks PDF)
- Frontend: HTML/CSS/vanilla JS yang sudah ada — chat memakai `chat.js`, `chat.css`

## 3. Cara memperoleh Groq API key

1. Buka <https://console.groq.com/> dan daftar/masuk.
2. Buka **API Keys** → <https://console.groq.com/keys>.
3. **Create API Key**, salin key (format diawali `gsk_…`).
4. Catatan: kuota/batas mengikuti plan akun Groq (rate limit per menit/hari, token per menit). Tidak ada layanan gratis tanpa batas; error 429 berarti batas tercapai.

## 4. Menyiapkan file .env

```bash
cd server
Copy-Item .env.example .env   # Windows PowerShell (atau: cp .env.example .env)
```

Isi `server/.env`:

```
GROQ_API_KEY=gsk_...KEY_ANDA
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=qwen/qwen3.8-27b
PORT=3001
ALLOWED_ORIGINS=http://localhost,http://192.168.100.50
AI_MAX_FILE_SIZE_MB=10
AI_MAX_TOTAL_SIZE_MB=20
AI_MAX_FILES=3
AI_RATE_WINDOW_SEC=300
AI_RATE_MAX=10
AI_MAX_HISTORY=16
AI_MAX_MESSAGE_LENGTH=4000
AI_MAX_TOOL_ROUNDS=5
AI_MAX_TOOL_CALLS=20
AI_TIMEOUT_MS=90000
PDF_MAX_PAGES=40
PDF_MAX_TEXT_CHARS=120000
DOC_INDEX_HTML=../index.html
```

- `ALLOWED_ORIGINS` kosong = hanya localhost/127.0.0.1 yang boleh memanggil API.
- Jangan pernah commit `server/.env` (sudah diblokir `.gitignore`).

### Model yang dipakai (verifikasi: GET https://api.groq.com/openai/v1/models atau https://console.groq.com/docs/models)

- `GROQ_MODEL` — teks + tool calling: `llama-3.3-70b-versatile`.
- `GROQ_VISION_MODEL` — dipakai hanya saat pengguna mengirim gambar (teks+gambar+tool calling): `qwen/qwen3.8-27b` (maksimal 3 gambar/request, batas ukuran request ~20 MB; gambar dihitung ±2048 token/gambar).
- Awas kuota akun: model tercantum di console bisa berubah; bila muncul error "model tidak tersedia", periksa daftar model di console lalu sesuaikan `.env` — cukup ubah `GROQ_MODEL`/`GROQ_VISION_MODEL` tanpa menyentuh kode.

## 5. Menjalankan backend

Windows (detached — tidak mati saat terminal ditutup):

```bash
cd server
node run-detached.cjs
```

Cara umum:

```bash
cd server
npm install
npm start
```

Output sukses (masuk ke `server.log` saat detached):

```
AI Tutor backend berjalan di http://localhost:3001
Provider: Groq | Model: llama-3.3-70b-versatile | Vision: qwen/qwen3.8-27b | API key: terkonfigurasi
Indeks dokumentasi: 111 langkah, 23 heading
```

`run-detached.cjs` tidak membuat instance baru bila port backend sudah dipakai.

Backend sekaligus menyajikan website: buka `http://localhost:3001/`.

## 6. Menjalankan website

- **Cara A (dengan backend):** buka `http://localhost:3001/`.
- **Cara B (XAMPP):** letakkan folder di `htdocs`, buka `http://localhost/UKK-PAKET-2/`. Chat otomatis mendeteksi backend di port 3001 (CORS wajib `ALLOWED_ORIGINS` memuat origin XAMPP Anda).

## 7. Cara memeriksa status

```
http://localhost:3001/api/ai/status
```

Contoh respons:

```json
{
  "ready": true,
  "keyConfigured": true,
  "indexReady": true,
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "visionModel": "qwen/qwen3.8-27b",
  "groqReachable": true,
  "groqCheck": "HTTP 200"
}
```

- `ready=false` + `keyConfigured=false` → isi `GROQ_API_KEY` di `server/.env`.
- `groqReachable=false` → jaringan/penyedia tidak terjangkau dari backend.
- Status melakukan pemeriksaan koneksi ke Groq (daftar model, hasil dicache 60 dtk) — aman terhadap kuota.

## 8. Cara membaca log (server/server.log)

Baris penting (tanpa key/isi percakapan):

```
[groq-call] stage=round-2 model=llama-3.3-70b-versatile status=200 dur=1.4s ok tools=2
[chat] stage=chat-end model=... status=200 dur=3.2s tools=2
[groq-call] stage=agent model=... status=429 dur=0.4s fail:rate_limited_api
```

- `fail:api_key_invalid` → key salah/tidak valid.
- `fail:rate_limited_api` → batas kuota/limits akun Groq tercapai.
- `fail:timeout` → Groq tidak merespons dalam `AI_TIMEOUT_MS`.
- `fail:network_error` → backend gagal jaringan ke api.groq.com.
- Tahap `chat-end` tandanya backend selesai dan mengirim respons ke browser; bila `chat-end` muncul tetapi browser tidak menerima jawaban, masalahnya di jaringan lokal/browser.

## 9. Cara menguji chatbot

1. Klik tombol **Tanya AI** kanan bawah.
2. Status di header harus "Online · llama-3.3-70b-versatile". Bila "AI belum dikonfigurasi" → `GROQ_API_KEY` belum benar.
3. Klik quick prompt "Bimbing saya mulai dari awal praktek UKK ini." → AI memberi satu langkah dengan format Tahap/Tujuan/Lokasi/Instruksi/Hasil/Pemeriksaan + baris Sumber yang menautkan bagian dokumentasi.
4. Tanya sesuatu dari dokumentasi (mis. "Bagaimana konfigurasi dstnat port 9090 sesuai dokumentasi UKK?") → log harus menunjukkan tool calling (`tools=...`).
5. Unggah screenshot PNG, log `.txt`, PDF teks, dan coba upload `.env` (harus ditolak).
6. Coba "Ringkas seluruh tahapan" untuk jawaban panjang.

## 10. Lampiran dan cara kerjanya

- **Gambar (PNG/JPG/WEBP):** dikirim base64 `data:` URL ke model vision (`GROQ_VISION_MODEL`). Total raw gambar dibatasi ±14 MB agar JSON request di bawah limit Groq (~20 MB).
- **TXT/konfig/log:** isi file dibaca dan disisipkan sebagai konteks percakapan (maks. 200.000 karakter/file).
- **PDF:** teks diekstraksi di backend (pdf-parse, maks. `PDF_MAX_PAGES` halaman) lalu disisipkan sebagai konteks. **PDF hasil scan/foto (tanpa lapisan teks) belum didukung** — AI meminta screenshot halaman tertentu sebagai PNG/JPG.
- **Kamera & drag & drop:** alur sama dengan upload biasa (file picker `/` drop) — tidak ada perubahan frontend.
- Ekstensi `.env`, private key, sertifikat ditolak; file teks berpola kredensial (`password=`, token dsb.) ditolak HTTP 422.

## 11. Troubleshooting

- **HTTP 401 `api_key_invalid`** → `GROQ_API_KEY` salah/kadaluarsa. Buat key baru di console.groq.com/keys, isi di `server/.env`, restart backend.
- **HTTP 429 `quota_exceeded`** → batas penggunaan akun Groq tercapai. Periksa `retry-after` di header/log, tunggu sesuai saran; juga cek batas plan di console. Backend rate limit sendiri (`rate_limited`) aktif bila lebih dari `AI_RATE_MAX` request per `AI_RATE_WINDOW_SEC` dari satu IP.
- **HTTP 503 `model_busy`** → model sedang beban tinggi. Tunggu, coba lagi; bila sering, ganti model di `.env`.
- **HTTP 504 `timeout`** → naikkan `AI_TIMEOUT_MS` atau kurangi ukuran/riwayat pertanyaan.
- **HTTP 502 / jaringan** → ia bisa dari backend ke Groq (`network_error` di log) atau browser ke backend (cek backend hidup: `netstat -ano | findstr :3001`).

## 12. Batasan kuota

- Penggunaan mengikuti limits akun Groq (tokens per menit, request per menit/hari) — bervariasi per plan.
- Pemeriksaan status cukup hemat (`/models` sekali per menit maksimal).
- Setiap gambar ±2048 token input; riwayat dibatasi `AI_MAX_HISTORY` pesan.

## 13. Deployment backend

Backend **tidak dapat berjalan di hosting statis** (GitHub Pages / Netlify tanpa function). Pilih salah satu:

- **Node.js hosting** (VPS, Railway, Fly.io, Render): `npm ci && npm start`, set environment variables (bukan `.env` commit), arahkan `ALLOWED_ORIGINS` ke domain produksi website.
- HTTPS wajib di produksi; jangan jalankan backend tanpa TLS di domain publik.

## 14. Catatan keamanan & privasi

- API key hanya di env backend; frontend merekas know-how lewat `/api/ai/*`. `/api/ai/status` hanya memberi flag/model — tidak pernah mengembalikan key.
- Upload diperiksa: ekstensi + MIME, ukuran per file & total, jumlah file, pola kredensial. File terdeteksi kredensial ditolak HTTP 422.
- Lampiran hanya segantung memori proses — tidak save ke disk/DB.
- Log server hanya berisi tahap/model/status HTTP/durasi/jumlah tools/kategori error — tanpa isi pesan/lampiran/key.
- User-facing notice: pesan & lampiran diproses via Groq API — dilarang kirim data rahasia; kuota mengikuti kebijakan Groq.
