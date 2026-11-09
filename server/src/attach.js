// Pemeriksaan jenis file dan pola kredensial pada konten teks.
// Lampiran pengguna hanya diproses di memori, tidak pernah disimpan ke disk.

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
export const PDF_EXTENSIONS = ['pdf'];
export const PDF_MIMES = ['application/pdf'];

export const TEXT_EXTENSIONS = [
  'txt', 'md', 'csv', 'json',
  'conf', 'ini', 'log', 'sh', 'bash', 'sql', 'yaml', 'yml',
  'js', 'ts', 'html', 'css', 'xml', 'toml'
];

// .env asli dilarang; .env.example diizinkan secara eksplisit.
export const BLOCKED_EXTENSIONS = ['env', 'pem', 'key', 'p12', 'pfx', 'crt', 'cer', 'der', 'jks', 'keystore'];

export const ALLOWED_EXTENSIONS = [
  ...IMAGE_EXTENSIONS, ...PDF_EXTENSIONS, ...TEXT_EXTENSIONS
];

export const ALLOWED_ACCEPT = [
  ...IMAGE_EXTENSIONS.map((e) => '.' + e),
  ...PDF_EXTENSIONS.map((e) => '.' + e),
  ...TEXT_EXTENSIONS.map((e) => '.' + e),
  '.env.example'
].join(',');

export function fileExtension(name) {
  const base = String(name).toLowerCase().split('/').pop();
  const parts = base.split('.');
  if (base === '.env.example') return 'env.example';
  if (parts.length < 2) return '';
  return parts.pop();
}

export function isAllowedName(name, mime) {
  const ext = fileExtension(name);
  if (BLOCKED_EXTENSIONS.includes(ext)) return false;
  if (ext === 'env.example' && !String(name).toLowerCase().endsWith('.env.example')) return false;
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false;

  // Validasi MIME untuk gambar & PDF (bila browser mengirim mime)
  if (IMAGE_EXTENSIONS.includes(ext) && mime && !IMAGE_MIMES.includes(mime)) return false;
  if (PDF_EXTENSIONS.includes(ext) && mime && !PDF_MIMES.includes(mime)) return false;

  return true;
}

const SECRET_PATTERNS = [
  { re: /-----BEGIN[A-Z ]*PRIVATE KEY-----/, reason: 'Private key (PEM)' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, reason: 'AWS Access Key ID' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, reason: 'GitHub token' },
  { re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/, reason: 'API key format sk-…' },
  { re: /\bAIza[A-Za-z0-9_-]{30,}\b/, reason: 'Google API key' },
  { re: /Bearer\s+[A-Za-z0-9._-]{25,}/, reason: 'Bearer token' },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, reason: 'JWT token' },
  {
    re: /^\s*(?:password|passwd|pwd|db_pass(?:word)?|db_password|api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token)\s*[:=]/im,
    reason: 'Assignment kredensial (password/api key/secret)'
  }
];

// Deteksi pola kredensial yang jelas pada konten teks.
export function detectSecrets(text) {
  const found = [];
  for (const { re, reason } of SECRET_PATTERNS) {
    if (re.test(text)) found.push(reason);
  }
  return found;
}

export function looksBinaryText(buf) {
  const sample = buf.slice(0, 4096);
  let suspicious = 0;
  const limit = sample.length;
  for (let i = 0; i < limit; i++) {
    const b = sample[i];
    if (b === 0) return true;
    if (b < 9 || (b > 13 && b < 32)) suspicious++;
  }
  return limit > 0 && suspicious / limit > 0.08;
}
