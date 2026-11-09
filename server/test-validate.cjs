// Pengujian endpoint chat tanpa API key (validasi bekerja sebelum panggilan AI).
const http = require('http');

function post(name, buf, mime) {
  const b = '----b' + Date.now() + Math.random();
  const pre = Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="message"\r\n\r\nperiksa file ini\r\n');
  const fileHead = Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="files"; filename="' + name + '"\r\nContent-Type: ' + mime + '\r\n\r\n');
  const end = Buffer.from('\r\n--' + b + '--\r\n');
  const body = Buffer.concat([pre, fileHead, buf, end]);
  return new Promise((res) => {
    const req = http.request({
      host: 'localhost', port: 3001, path: '/api/ai/chat', method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + b, 'Content-Length': body.length }
    }, (r) => {
      let out = '';
      r.on('data', (c) => (out += c));
      r.on('end', () => res({ code: r.statusCode, body: out }));
    });
    req.end(body);
  });
}

(async () => {
  console.log('exe file       :', await post('virus.exe', Buffer.from('MZ'), 'application/octet-stream').then(JSON.stringify));
  console.log('env file       :', await post('.env', Buffer.from('SECRET=1'), 'text/plain').then(JSON.stringify));
  console.log('secret in txt  :', await post('config.txt', Buffer.from('password = supersecret123'), 'text/plain').then(JSON.stringify));
  console.log('oversized log  :', await post('big.log', Buffer.alloc(11 * 1024 * 1024, 104), 'text/plain').then(JSON.stringify));
  console.log('valid txt      :', await post('note.txt', Buffer.from('apache2 listens on port 80'), 'text/plain').then(JSON.stringify));
  console.log('valid png      :', await post('shot.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64)]), 'image/png').then(JSON.stringify));
})();
