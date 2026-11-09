// Backend AI Tutor UKK TKJ Paket 2 — Groq API (OpenAI-compatible endpoint).
// API key HANYA dari environment (GROQ_API_KEY). Lampiran diproses di memori, tidak tersimpan.
// Endpoint frontend tidak berubah: POST /api/ai/chat, GET /api/ai/status.

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';

import { config, isKeyConfigured } from './src/config.js';
import { buildDocIndex } from './src/docs.js';
import { buildSystemInstruction, groqTools, TOOL_NAMES } from './src/prompt.js';
import { groqChat, groqProbeModels, GroqApiError } from './src/groq.js';
import {
  isAllowedName, detectSecrets, looksBinaryText,
  IMAGE_EXTENSIONS, PDF_EXTENSIONS, fileExtension
} from './src/attach.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ================== Indeks dokumentasi ==================
let docs = null;
try {
  const docPath = path.resolve(__dirname, config.docIndexHtml);
  docs = buildDocIndex(docPath);
} catch (err) {
  console.error('[startup] Gagal membaca index.html:', err.message);
}

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// ================== CORS ==================
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin || '';
  const localhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const allowed = config.allowedOrigins.includes(origin) || (config.allowedOrigins.length === 0 && localhost);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}
app.use(corsMiddleware);

// ================== Rate limit per IP (memori) ==================
const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip = (req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const winMs = config.rateWindowSec * 1000;
  let arr = rateMap.get(ip);
  if (!arr) { arr = []; rateMap.set(ip, arr); }
  while (arr.length && arr[0] < now - winMs) arr.shift();
  if (arr.length >= config.rateMax) {
    const retryAfter = Math.ceil((arr[0] + winMs - now) / 1000);
    return res.status(429).json({
      error: 'rate_limited',
      message: `Terlalu banyak permintaan. Coba lagi dalam ${Math.max(retryAfter, 1)} detik.`
    });
  }
  arr.push(now);
  next();
}

// ================== Upload (memori) ==================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: config.maxFiles
  }
});

// ================== Helpers ==================
const mimeOf = (file) => file.mimetype || 'application/octet-stream';
const isImageFile = (f) => IMAGE_EXTENSIONS.includes(fileExtension(f.originalname)) && /image\/(png|jpe?g|webp)/i.test(f.mimetype);
const isPdfFile = (f) => PDF_EXTENSIONS.includes(fileExtension(f.originalname)) && f.mimetype === 'application/pdf';
const isTextFile = (f) => {
  const ext = fileExtension(f.originalname);
  return ext === 'env.example' || ['txt', 'md', 'csv', 'json', 'conf', 'ini', 'log', 'sh', 'bash', 'sql', 'yaml', 'yml', 'js', 'ts', 'html', 'css', 'xml', 'toml'].includes(ext);
};

function jsonError(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

// ================== Tools: eksekusi lokal (read-only) ==================
function executeTool(name, args, toolCounters) {
  if (!TOOL_NAMES.has(name)) return { error: 'Fungsi tidak diizinkan.' };
  toolCounters.count++;
  toolCounters.executions++;
  if (toolCounters.count > config.maxToolCallsPerRequest) {
    return { error: 'Batas pemanggilan tools tercapai. Jawab dengan informasi yang sudah ada.' };
  }
  try {
    if (name === 'search_ukk_documentation') {
      const query = String(args?.query ?? '').slice(0, 300).trim();
      if (!query) return { error: 'Parameter query wajib diisi.' };
      const max = Math.min(Math.max(parseInt(args?.max_results, 10) || 5, 1), 10);
      const res = docs.search(query, { maxResults: max });
      return res || { results: [], note: 'Tidak ada hasil. JANGAN mengarang isi dokumentasi; sampaikan bahwa bagian itu belum ada.' };
    }
    if (name === 'read_ukk_section') {
      const id = String(args?.section_id ?? '').trim();
      if (!/^[a-z0-9-]{1,64}$/.test(id)) return { error: 'section_id tidak valid.' };
      if (!docs.sectionById.has(id)) return { error: `Bagian "${id}" tidak ditemukan. Gunakan search_ukk_documentation.` };
      return docs.readSection(id);
    }
    if (name === 'search_related_steps') {
      const query = String(args?.query ?? '').slice(0, 300).trim();
      const currentSectionId = String(args?.current_section_id ?? '').trim();
      if (!query) return { error: 'Parameter query wajib diisi.' };
      if (currentSectionId && !/^[a-z0-9-]{1,64}$/.test(currentSectionId)) return { error: 'current_section_id tidak valid.' };
      return docs.relatedSteps(query, currentSectionId) || { results: [] };
    }
    return { error: 'Fungsi tidak dikenal.' };
  } catch (err) {
    return { error: 'Eksekusi tools gagal: ' + err.message };
  }
}

// ================== Logging diagnostik aman ==================
// Hanya: stage, model, status HTTP, durasi, jumlah tool, kategori error.
function aiLog(stage, model, status, durMs, ok, extra = {}) {
  const dur = ((durMs || 0) / 1000).toFixed(1) + 's';
  const bits = ['[groq-call]', 'stage=' + stage, 'model=' + model, 'status=' + (status ?? 0),
    'dur=' + dur, ok ? 'ok' : 'fail' + (extra.errCategory ? ':' + extra.errCategory : '')];
  if ('tools' in extra) bits.push('tools=' + extra.tools);
  if (extra.note) bits.push('note=' + extra.note);
  console.error(bits.join(' '));
}

// ================== System prompt (per model, di-cache) ==================
const sysPromptCache = new Map();
function systemInstructionFor(model) {
  if (!sysPromptCache.has(model)) sysPromptCache.set(model, buildSystemInstruction(model));
  return sysPromptCache.get(model);
}

// ================== Agent loop (Groq + tool calling) ==================
// Alur: messages -> Groq (dengan tools) -> tool_calls? -> jalankan -> role:tool kembali -> jawaban akhir.
async function runAgentOnGroq({ messages, model }) {
  const t0 = Date.now();
  const deadline = t0 + config.aiTimeoutMs;
  const work = messages.slice();
  const toolCounters = { count: 0, rounds: 0, totalCalls: 0 };

  try {
    for (let round = 1; round <= config.maxToolRounds; round++) {
      const remaining = deadline - Date.now();
      if (remaining < 1500) break;

      const { data, durMs } = await groqChat({
        apiKey: config.groqApiKey,
        baseUrl: config.groqBaseUrl,
        model,
        messages: work,
        tools: groqTools,
        temperature: 0.4,
        maxCompletionTokens: 4096,
        deadlineMs: remaining
      });

      const choice = data?.choices?.[0]?.message;
      if (!choice) throw new GroqApiError({ status: 200, code: 'empty_response', message: 'Respons model kosong.' });

      const calls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
      if (!calls.length) {
        aiLog('round-' + round, model, 200, durMs, true, { tools: toolCounters.totalCalls });
        return { reply: cleanContent(choice.content), stats: { durMs: Date.now() - t0, tools: toolCounters.totalCalls } };
      }

      toolCounters.rounds = round;
      toolCounters.totalCalls += calls.length;

      // Assistant dengan tool_calls wajib dikirim kembali apa adanya.
      work.push({
        role: 'assistant',
        content: choice.content ? cleanRawContent(choice.content) : '',
        tool_calls: calls
      });

      for (const tc of calls) {
        const fnName = tc?.function?.name || '';
        let args = {};
        try { args = JSON.parse(tc?.function?.arguments || '{}'); } catch { args = {}; }
        let result;
        if (!tc?.id) {
          result = { error: 'Tool call tanpa id.' };
        } else if (toolCounters.count >= config.maxToolCallsPerRequest) {
          result = { error: 'Batas pemanggilan tools tercapai.' };
        } else {
          try { result = executeTool(fnName, args, toolCounters); }
          catch (err) { result = { error: 'Tool gagal: ' + err.message }; }
        }
        work.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 24000)
        });
      }
    }

    // Batas putaran/terlalu banyak tools — satu pemanggilan terakhir TANPA tools.
    const remaining = Math.max(deadline - Date.now(), 4000);
    const { data, durMs } = await groqChat({
      apiKey: config.groqApiKey,
      baseUrl: config.groqBaseUrl,
      model,
      messages: [...work, {
        role: 'user',
        content: 'Batas pemanggilan tools sudah tercapai. Jawab sekarang dengan informasi yang sudah kamu kumpulkan.'
      }],
      tools: null,
      temperature: 0.4,
      maxCompletionTokens: 4096,
      deadlineMs: remaining
    });
    const reply = data?.choices?.[0]?.message?.content || '';
    aiLog('final', model, 200, durMs, true, { tools: toolCounters.totalCalls });
    return { reply: cleanContent(reply), stats: { durMs: Date.now() - t0, tools: toolCounters.totalCalls } };
  } catch (err) {
    const status = err instanceof GroqApiError ? err.status : 0;
    const category = err instanceof GroqApiError ? err.code : 'unexpected';
    aiLog('agent', model, status, Date.now() - t0, false, { errCategory: category, tools: toolCounters.totalCalls });
    throw err;
  }
}

// Buang blok <think> (model reasoning) agar tidak bocor ke frontend.
function cleanRawContent(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function cleanContent(text) {
  return cleanRawContent(text);
}

// ================== Mapping error Groq -> respons frontend ==================
function mapGroqError(err) {
  if (!(err instanceof GroqApiError)) {
    return { status: 502, code: 'ai_unavailable', message: 'Layanan AI sedang bermasalah. Coba lagi beberapa saat lagi.' };
  }
  switch (err.code) {
    case 'timeout':
      return { status: 504, code: 'timeout', message: 'Layanan AI tidak merespons dalam batas waktu. Coba lagi dengan pertanyaan lebih singkat.' };
    case 'network_error':
      return { status: 502, code: 'ai_unavailable', message: 'Backend tidak dapat menghubungi layanan AI (kesalahan jaringan). Coba lagi beberapa saat.' };
    case 'api_key_invalid':
      return { status: 401, code: 'api_key_invalid', message: 'API key Groq tidak valid. Periksa GROQ_API_KEY di backend.' };
    case 'api_key_forbidden':
      return { status: 403, code: 'api_key_forbidden', message: 'API key Groq tidak punya akses ke model/endpoint ini. Periksa pengaturan akun di console.groq.com.' };
    case 'model_not_found':
      return { status: 404, code: 'model_unavailable', message: 'Model Groq yang dikonfigurasi tidak tersedia. Periksa GROQ_MODEL / GROQ_VISION_MODEL di server/.env.' };
    case 'request_too_large':
      return { status: 413, code: 'request_too_large', message: 'Ukuran request terlalu besar untuk layanan AI. Kirim kurang/kompres lampiran.' };
    case 'rate_limited_api':
      return {
        status: 429,
        code: 'quota_exceeded',
        message: 'Batas penggunaan Groq API telah tercapai'
          + (err.retryAfterSec ? ` — coba lagi setelah ${err.retryAfterSec} detik.` : '. Tunggu beberapa saat, lalu coba lagi.')
          + ' Penggunaan mengikuti kuota/limits akun Groq yang aktif.',
        retryAfterSec: err.retryAfterSec
      };
    case 'ai_unavailable':
      return { status: 503, code: 'model_busy', message: 'Model AI sedang bermasalah/beban tinggi di Groq. Tunggu beberapa saat lalu coba lagi.' };
    case 'bad_request':
      return { status: 422, code: 'bad_request_ai', message: 'Groq menolak request (format/parameter tidak valid). Periksa konfigurasi model di server/.env.' };
    default:
      return { status: err.status ? 502 : 502, code: 'ai_unavailable', message: 'Layanan AI sedang bermasalah. Coba lagi beberapa saat lagi.' };
  }
}

// ================== Status endpoint ==================
// Cache pemeriksaan koneksi Groq (hemat kuota; tidak memblokir respons).
let groqProbe = { checkedAt: 0, reachable: null, ok: null, status: 0, reason: '' };
let probeRunning = false;
function probeGroqAsync(force = false) {
  if (probeRunning) return;
  if (!force && Date.now() - groqProbe.checkedAt < 60000) return;
  if (!isKeyConfigured()) return;
  probeRunning = true;
  groqProbeModels({ apiKey: config.groqApiKey, baseUrl: config.groqBaseUrl })
    .then((r) => { groqProbe = { checkedAt: Date.now(), reachable: r.reachable, ok: r.ok, status: r.status, reason: r.reason || '' }; })
    .catch(() => { groqProbe.checkedAt = Date.now(); })
    .finally(() => { probeRunning = false; });
}
probeGroqAsync(true);

app.get('/api/ai/status', (req, res) => {
  probeGroqAsync(); // refresh latar belakang bila cache > 60 dtk
  const ready = Boolean(docs) && isKeyConfigured() && groqProbe.reachable !== false;
  res.json({
    ready,
    keyConfigured: isKeyConfigured(),
    indexReady: Boolean(docs),
    provider: 'groq',
    model: config.groqModel,
    visionModel: config.groqVisionModel || config.groqModel,
    groqReachable: groqProbe.reachable,   // null = belum diperiksa, true/false
    groqCheck: groqProbe.status ? ('HTTP ' + groqProbe.status) : (groqProbe.reason || null)
  });
});

// ================== Endpoint chat ==================
app.post('/api/ai/chat', rateLimit, upload.array('files', config.maxFiles), async (req, res) => {
  if (!docs) return jsonError(res, 503, 'index_unavailable', 'Indeks dokumentasi tidak tersedia di backend.');

  // ---- Validasi pesan ----
  const message = String(req.body?.message ?? '').trim();
  if (!message && !(req.files && req.files.length)) {
    return jsonError(res, 400, 'empty_message', 'Pertanyaan tidak boleh kosong.');
  }
  if (message.length > config.maxMessageLength) {
    return jsonError(res, 400, 'message_too_long', `Pertanyaan terlalu panjang. Maksimal ${config.maxMessageLength} karakter.`);
  }

  // ---- Validasi riwayat ----
  // Frontend kirim history sebagai string JSON (multipart) atau array (JSON body).
  let historyRaw = req.body?.history ?? [];
  let history = [];
  if (Array.isArray(historyRaw)) {
    history = historyRaw;
  } else {
    try { history = JSON.parse(String(historyRaw)); } catch { return jsonError(res, 400, 'bad_history', 'Format riwayat percakapan tidak valid.'); }
  }
  if (!Array.isArray(history)) return jsonError(res, 400, 'bad_history', 'Riwayat harus berupa array.');

  // Role user/assistant asli; buang pesan terakhir yang duplikat dengan `message`
  // (frontend memasukkan pesan baru ke history sebelum mengirim).
  let cleanHistory = history
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string')
    .map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', text: String(h.text).slice(0, config.maxMessageLength) }))
    .slice(-config.maxHistory);
  const last = cleanHistory[cleanHistory.length - 1];
  if (last && last.role === 'user' && last.text === message) cleanHistory = cleanHistory.slice(0, -1);

  // ---- Validasi konteks halaman ----
  let ctxRaw = req.body?.context ?? null;
  let pageContext = null;
  if (ctxRaw && typeof ctxRaw === 'object') {
    pageContext = ctxRaw;
  } else if (typeof ctxRaw === 'string') {
    try { pageContext = JSON.parse(ctxRaw); } catch { pageContext = null; }
  }
  if (pageContext && typeof pageContext !== 'object') pageContext = null;

  // ---- Validasi lampiran ----
  const files = req.files || [];
  if (files.length > config.maxFiles) {
    return jsonError(res, 400, 'too_many_files', `Maksimal ${config.maxFiles} lampiran per pesan.`);
  }
  let totalBytes = 0;
  let imagesRawBytes = 0;
  for (const f of files) {
    totalBytes += f.size;
    if (isImageFile(f)) imagesRawBytes += f.size;
    if (f.size > config.maxFileSizeMb * 1024 * 1024) {
      return jsonError(res, 400, 'file_too_large', `File "${f.originalname}" melebihi batas ${config.maxFileSizeMb} MB.`);
    }
    if (!isAllowedName(f.originalname, mimeOf(f))) {
      return jsonError(res, 400, 'unsupported_file', `Jenis file "${f.originalname}" tidak didukung. Diterima: gambar (PNG/JPG/WEBP), PDF, dan file teks/konfigurasi/log. File .env, private key, dan sertifikat tidak diizinkan.`);
    }
  }
  if (totalBytes > config.maxTotalMb * 1024 * 1024) {
    return jsonError(res, 400, 'total_too_large', `Total ukuran lampiran melebihi ${config.maxTotalMb} MB.`);
  }
  // Batas realistis payload Groq (base64 + JSON ~ +33%; limit Groq ~20 MB)
  if (imagesRawBytes > config.maxImagesRawBytes) {
    return jsonError(res, 422, 'images_too_large',
      `Total ukuran gambar (${(imagesRawBytes / (1024 * 1024)).toFixed(1)} MB) melebihi batas kirim ke layanan AI. Kirim lebih sedikit atau kompres gambar.`);
  }

  // Pemeriksaan kredensial pada file teks
  for (const f of files) {
    if (isTextFile(f)) {
      const text = f.buffer.toString('utf8');
      if (looksBinaryText(f.buffer)) {
        return jsonError(res, 400, 'binary_file', `File "${f.originalname}" terdeteksi berkas biner, bukan teks yang didukung.`);
      }
      const secrets = detectSecrets(text);
      if (secrets.length) {
        return jsonError(res, 422, 'credentials_blocked',
          `File "${f.originalname}" dideteksi mengandung pola kredensial (${secrets.join('; ')}). Hapus atau samarkan nilai tersebut, lalu kirim ulang. Jangan kirim password, API key, token, atau private key.`);
      }
    }
  }

  // ---- Susun konten pesan user utama (format Groq/OpenAI) ----
  if (!isKeyConfigured()) {
    return jsonError(res, 503, 'service_unavailable',
      'Layanan AI belum tersedia: GROQ_API_KEY belum dikonfigurasi di backend. Hubungi pengelola website.');
  }

  const hasImages = files.some((f) => isImageFile(f));
  let model = config.groqModel;
  if (hasImages) {
    if (!config.groqVisionModel || config.groqVisionModel === config.groqModel) {
      // Model teks tidak menerima gambar; wajib vision model terpisah.
      return jsonError(res, 422, 'vision_model_missing', 'Model AI teks tidak dapat membaca gambar. Konfigurasikan GROQ_VISION_MODEL yang mendukung vision di server/.env.');
    }
    model = config.groqVisionModel;
  }

  try {
    // Ekstraksi lampiran (bisa fail per-file; perlakukan jelas).
    const textBlocks = [];
    const imageDataUrls = [];

    if (pageContext && pageContext.sectionId) {
      const ctxParts = [`[Konteks halaman] Bagian aktif: ${String(pageContext.sectionTitle || pageContext.sectionId)} (id: ${String(pageContext.sectionId)})`];
      if (pageContext.stepLabel) ctxParts.push(` Langkah aktif: ${String(pageContext.stepLabel).slice(0, 120)}`);
      textBlocks.push(ctxParts.join(' | '));
    }

    textBlocks.push(message || 'Tolong periksa lampiran yang saya kirim dan beri analisis sesuai dokumentasi UKK.');

    for (const f of files) {
      if (isTextFile(f)) {
        const text = f.buffer.toString('utf8');
        if (looksBinaryText(f.buffer)) continue;
        if (detectSecrets(text).length) continue; // sudah ditolak lebih awal; jaga-jaga
        textBlocks.push(`[Lampiran file: ${f.originalname} (${(f.size / 1024).toFixed(1)} KB)]\n---\n${text.slice(0, 200000)}\n---`);
      } else if (isPdfFile(f)) {
        const extracted = await extractPdfText(f);
        if (extracted.ok && extracted.text) {
          textBlocks.push(`[Lampiran PDF: ${f.originalname} (${(f.size / 1024).toFixed(1)} KB, ${extracted.pages} halaman, teks diekstraksi)]\n---\n${extracted.text}\n---`);
        } else {
          textBlocks.push(`[Lampiran PDF: ${f.originalname} — ${extracted.reason} Tidak ada teks yang bisa diekstraksi. Jika anggap PDF hasil scan/foto, minta pengguna mengirim screenshot halaman tertentu sebagai gambar PNG/JPG.]`);
        }
      } else if (isImageFile(f)) {
        imageDataUrls.push(`data:${mimeOf(f)};base64,${f.buffer.toString('base64')}`);
      }
    }

    // Bangun array messages Groq
    const messages = [
      { role: 'system', content: systemInstructionFor(model) },
      ...cleanHistory.map((h) => ({ role: h.role, content: h.text }))
    ];

    if (imageDataUrls.length) {
      const contentParts = [{ type: 'text', text: textBlocks.join('\n\n') }];
      for (const url of imageDataUrls) contentParts.push({ type: 'image_url', image_url: { url } });
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: textBlocks.join('\n\n') });
    }

    // ---- Jalankan agent ----
    const { reply, stats } = await runAgentOnGroq({ messages, model });
    if (!reply || !reply.trim()) {
      return jsonError(res, 502, 'empty_response', 'AI tidak mengembalikan jawaban. Coba ulangi pertanyaan.');
    }
    console.error('[chat] stage=chat-end model=' + model + ' status=200 dur=' + ((stats.durMs) / 1000).toFixed(1) + 's tools=' + stats.tools);
    // Hanya jawaban — tanpa metadata internal, tanpa stack trace.
    res.json({ reply });
  } catch (err) {
    if (process.env.AI_DEBUG_ERRORS === '1') {
      // Debug: nama/status/kode error API — tanpa key/isi percakapan.
      console.error('[groq-debug]', err?.name, err instanceof GroqApiError ? err.status : '', err?.code || '');
    }
    const mapped = mapGroqError(err);
    const headers = mapped.retryAfterSec ? { 'Retry-After': String(mapped.retryAfterSec) } : undefined;
    return res.status(mapped.status).set(headers || {}).json({ error: mapped.code, message: mapped.message });
  }
});

// Ekstraksi teks PDF di backend (Groq tidak menerima PDF).
async function extractPdfText(file) {
  const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
  try {
    const result = await parser.getText();
    const text = String(result?.text || '').replace(/\s+\n/g, '\n').trim();
    const pages = result?.pages?.length || result?.total || 0;
    if (!text || text.length < 40) {
      return { ok: false, reason: 'Halaman berupa gambar/scan (tidak ada lapisan teks). Ekstraksi OCR belum didukung backend.' };
    }
    return { ok: true, text: text.slice(0, config.pdfMaxTextChars), pages: pages || null };
  } catch (err) {
    return { ok: false, reason: 'Gagal memproses PDF (' + String(err?.message || 'format tidak valid').slice(0, 120) + ').' };
  } finally {
    try { await parser.destroy(); } catch {}
  }
}

// ================== Fallback 404 untuk /api ==================
app.use('/api', (req, res) => jsonError(res, 404, 'not_found', 'Endpoint tidak ditemukan.'));

// ================== Sajikan website statis ==================
app.use(express.static(projectRoot, { dotfiles: 'deny' }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(projectRoot, 'index.html'));
  }
  next();
});

// ================== Error handler global ==================
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return jsonError(res, 400, 'file_too_large', `File melebihi batas ${config.maxFileSizeMb} MB.`);
    if (err.code === 'LIMIT_FILE_COUNT') return jsonError(res, 400, 'too_many_files', `Maksimal ${config.maxFiles} lampiran per pesan.`);
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return jsonError(res, 400, 'unexpected_field', 'Kolom upload tidak dikenal.');
    return jsonError(res, 400, 'upload_error', 'Upload gagal: ' + err.code);
  }
  if (err.type === 'entity.too.large') return jsonError(res, 413, 'request_too_large', 'Permintaan terlalu besar.');
  console.error('[error]', err.code || err.name || 'Error'); // tanpa isi pesan/file pengguna
  return jsonError(res, 500, 'server_error', 'Terjadi kesalahan di backend. Coba lagi.');
});

const server = app.listen(config.port, () => {
  console.log(`AI Tutor backend berjalan di http://localhost:${config.port}`);
  console.log(`Provider: Groq | Model: ${config.groqModel} | Vision: ${config.groqVisionModel || '(sama dengan model utama)'} | API key: ${isKeyConfigured() ? 'terkonfigurasi' : 'BELUM'}`);
  console.log(`Indeks dokumentasi: ${docs ? docs.steps.length + ' langkah, ' + docs.sections.length + ' heading' : 'GAGAL'}`);
});

server.setTimeout(0);
