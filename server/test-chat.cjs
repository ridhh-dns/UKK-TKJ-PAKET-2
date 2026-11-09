// Uji chat end-to-end: POST /api/ai/chat dengan pesan 'halo' (tanpa lampiran)
const http = require('http');

function post(body) {
  return new Promise((res) => {
    const req = http.request({
      host: 'localhost', port: 3001, path: '/api/ai/chat', method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Content-Length': Buffer.byteLength(body) }
    }, (r) => {
      let out = '';
      r.on('data', (c) => (out += c));
      r.on('end', () => res({ code: r.statusCode, body: out }));
    });
    req.on('error', (e) => res({ code: 0, body: e.message }));
    req.end(body);
  });
}

(async () => {
  const body = JSON.stringify({
    message: 'halo',
    history: [],
    context: null
  });
  const t0 = Date.now();
  const res = await post(body);
  console.log('status:', res.code, 'duration:', (Date.now() - t0) / 1000 + 's');
  try {
    const data = JSON.parse(res.body);
    if (data.reply) {
      console.log('REPLY (potongan 600 char):');
      console.log(data.reply.slice(0, 600));
    } else {
      console.log('JSON:', JSON.stringify(data).slice(0, 500));
    }
  } catch {
    console.log('RAW:', res.body.slice(0, 500));
  }
})();
