// Menjalankan server.js sebagai proses terpisah yang tidak mati saat shell ditutup.
// Pemakaian: node run-detached.cjs
// Aman dari double-run: bila port backend sudah dipakai, tidak spawn instance baru.
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

// Baca PORT dari server/.env bila ada, default 3001.
let port = 3001;
try {
  const envTxt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  const m = envTxt.match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
  if (m) port = Number(m[1]);
} catch {}

function portBusy(p, cb) {
  const s = net.connect(p, '127.0.0.1');
  s.setTimeout(1500);
  s.on('connect', () => { s.destroy(); cb(true); });
  s.on('timeout', () => { s.destroy(); cb(false); });
  s.on('error', () => cb(false));
}

portBusy(port, (busy) => {
  if (busy) {
    console.log('Port ' + port + ' sudah dipakai — backend kemungkinan sudah berjalan. Tidak menjalankan instance baru.');
    return;
  }
  const log = fs.openSync(path.join(__dirname, 'server.log'), 'a');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env }
  });
  child.unref();
  console.log('detached PID:', child.pid, '(port ' + port + ', log: server/server.log)');
});
