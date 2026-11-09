// Konfigurasi backend dari environment variable. Nilai default aman.
// Provider AI: Groq API (OpenAI-compatible endpoint https://api.groq.com/openai/v1).

function intVal(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export const config = {
  port: intVal(process.env.PORT, 3001),

  groqApiKey: process.env.GROQ_API_KEY || '',
  // Model teks + tool calling (default produksi Groq pada dokumen resmi).
  groqModel: (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim(),
  // Model vision + tool calling: dipakai bila request mengandung gambar.
  // Kosong = pakai GROQ_MODEL untuk semua request.
  groqVisionModel: (process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b').trim(),

  groqBaseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),

  // Origin yang diizinkan dipisah koma. Kosong = hanya localhost/127.0.0.1 + same origin.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Lampiran
  maxFileSizeMb: intVal(process.env.AI_MAX_FILE_SIZE_MB, 10),
  maxTotalMb: intVal(process.env.AI_MAX_TOTAL_SIZE_MB, 20),
  maxFiles: intVal(process.env.AI_MAX_FILES, 3),
  // Batas maksimum gabungan ukuran RAW gambar yang dikirim base64 ke Groq
  // (JSON request Groq dibatasi ~20 MB; base64 menambah ~33%).
  maxImagesRawBytes: intVal(process.env.AI_MAX_IMAGES_RAW_KB, 14336) * 1024,

  // Rate limit per IP
  rateWindowSec: intVal(process.env.AI_RATE_WINDOW_SEC, 300),
  rateMax: intVal(process.env.AI_RATE_MAX, 10),

  // Percakapan & agent
  maxHistory: intVal(process.env.AI_MAX_HISTORY, 16),
  maxMessageLength: intVal(process.env.AI_MAX_MESSAGE_LENGTH, 4000),
  maxToolRounds: intVal(process.env.AI_MAX_TOOL_ROUNDS, 5),
  maxToolCallsPerRequest: intVal(process.env.AI_MAX_TOOL_CALLS, 20),

  // Timeout total satu request chat dalam ms
  aiTimeoutMs: intVal(process.env.AI_TIMEOUT_MS, 90000),

  // Ekstraksi teks PDF
  pdfMaxPages: intVal(process.env.PDF_MAX_PAGES, 40),
  pdfMaxTextChars: intVal(process.env.PDF_MAX_TEXT_CHARS, 120000),

  // Lokasi index.html — path relatif dari folder server/
  docIndexHtml: process.env.DOC_INDEX_HTML || '../index.html'
};

export const isKeyConfigured = () => Boolean(config.groqApiKey && config.groqApiKey.length > 10);
