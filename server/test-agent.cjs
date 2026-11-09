// Uji agent loop (function calling) dan lampiran file
const http = require('http');

function multipart(fields, file) {
  const b = '----b' + Date.now() + Math.random();
  let parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="' + name + '"\r\n\r\n' + value + '\r\n'));
  }
  if (file) {
    parts.push(Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="files"; filename="' + file.name + '"\r\nContent-Type: text/plain\r\n\r\n'));
    parts.push(Buffer.from(file.content, 'utf8'));
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from('--' + b + '--\r\n'));
  const body = Buffer.concat(parts);
  return new Promise((res) => {
    const req = http.request({
      host: 'localhost', port: 3001, path: '/api/ai/chat', method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + b, Origin: 'http://localhost',
        'Content-Length': body.length
      }
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
  // 1) Pertanyaan dokumentasi — harus pakai tools pencarian
  let r = await multipart({ message: 'Di bagian mana cara konfigurasinya dstnat port 9090 di mikrotik? beri langkahnya ya', history: '[]' });
  console.log('== tool-call test ==', r.code);
  try {
    const j = JSON.parse(r.body);
    if (j.reply) {
      console.log('reply (600 char):\n' + j.reply.slice(0, 600));
      console.log('punya sumber anchor:', /Sumber:/.test(j.reply), /#sub-|bagian-/.test(j.reply));
    } else console.log('JSON:', JSON.stringify(j).slice(0, 400));
  } catch { console.log('RAW:', r.body.slice(0, 300)); }

  console.log('-----');

  // 2) Lampiran file konfigurasi (disamarkan kredensialnya)
  r = await multipart({
    message: 'Periksa file ini: apache sudah jalan apa belum? (file sengaja kecil)',
    history: '[]'
  }, {
    name: 'php.ini-snippet.txt',
    content: 'max_input_vars = 1\n; baris berikut belum aktifif\napache2ctl status: running ok\n'
  });
  console.log('== attach test ==', r.code);
  try {
    const j = JSON.parse(r.body);
    console.log(j.reply ? j.reply.slice(0, 400) : JSON.stringify(j).slice(0, 400));
  } catch { console.log('RAW:', r.body.slice(0, 300)); }
})();
