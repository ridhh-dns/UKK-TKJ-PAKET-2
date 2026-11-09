// Klien Groq API (OpenAI-compatible) via fetch bawaan Node 18+.
// Tidak memakai SDK; tidak ada API key dalam pesan error/log.

export class GroqApiError extends Error {
  constructor({ status = 0, code = 'ai_unavailable', message = '', retryAfterSec = null }) {
    super(message);
    this.name = 'GroqApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

// Tunnel error awal (400 dasar + hint 401) dan jaringan.
export function classifyTransportError(err) {
  if (err instanceof GroqApiError) return err;
  if (err && err.name === 'AbortError') {
    return new GroqApiError({ status: 0, code: 'timeout', message: 'TIMEOUT_API' });
  }
  return new GroqApiError({
    status: 0,
    code: 'network_error',
    message: 'Gagal menghubungi Groq API (kesalahan jaringan/DNS).'
  });
}

/**
 * Satu panggilan chat completions ke Groq.
 * - toolCallsActive: bila true, sertakan tools + tool_choice auto.
 * - deadlineMs: batas waktu tunggal untuk request ini (AbortController).
 */
export async function groqChat({
  apiKey, baseUrl, model, messages,
  tools = null, temperature = 0.4, maxCompletionTokens = 4096, deadlineMs = 90000
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const body = {
    model,
    messages,
    temperature,
    max_completion_tokens: maxCompletionTokens,
    stream: false
  };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    throw classifyTransportError(err);
  } finally {
    clearTimeout(timer);
  }

  const durMs = Date.now() - t0;
  if (!res.ok) {
    let errBody = {};
    try { errBody = await res.json(); } catch { /* body bukan JSON */ }
    const apiMsg = String(errBody?.error?.message || '').slice(0, 300);
    throw new GroqApiError({
      status: res.status,
      code: httpCodeToErrorCode(res.status),
      message: apiMsg || ('HTTP ' + res.status + ' dari Groq API'),
      retryAfterSec: Number.parseInt(res.headers.get('retry-after'), 10) || null
    });
  }

  let data;
  try { data = await res.json(); } catch {
    throw new GroqApiError({ status: 200, code: 'bad_response', message: 'Respons Groq bukan JSON valid.' });
  }
  return { data, durMs };
}

function httpCodeToErrorCode(status) {
  switch (status) {
    case 400: return 'bad_request';
    case 401: return 'api_key_invalid';
    case 403: return 'api_key_forbidden';
    case 404: return 'model_not_found';
    case 413: return 'request_too_large';
    case 429: return 'rate_limited_api';
    case 500: return 'ai_internal_error';
    case 502: return 'ai_bad_gateway';
    case 503: return 'ai_unavailable';
    case 524: return 'timeout';
    default: return 'ai_unavailable';
  }
}

// Cek koneksi aman ke Groq (daftar model) — dari status endpoint, hasil dicache.
export async function groqProbeModels({ apiKey, baseUrl, timeoutMs = 8000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(baseUrl + '/models', {
      headers: { 'Authorization': 'Bearer ' + apiKey },
      signal: controller.signal
    });
    if (res.status === 401 || res.status === 403) {
      return { reachable: true, ok: false, reason: 'api_key_invalid', status: res.status };
    }
    if (!res.ok) {
      return { reachable: true, ok: false, reason: 'http_' + res.status, status: res.status };
    }
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    const ids = Array.isArray(body?.data) ? body.data.map((m) => m?.id).filter(Boolean) : [];
    return { reachable: true, ok: true, models: ids, status: res.status };
  } catch (err) {
    return { reachable: false, ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network', status: 0 };
  } finally {
    clearTimeout(timer);
  }
}
