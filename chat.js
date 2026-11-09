// ============================================================
// AI Tutor UKK — Frontend chat agent
// API key TIDAK ADA di sini; hanya memakai backend /api/ai.
// ============================================================

(function () {
  'use strict';

  // ---------- Elemen ----------
  var fab = document.getElementById('ai-chat-btn');
  var panel = document.getElementById('ai-panel');
  var closeBtn = document.getElementById('ai-close');
  var minimizeBtn = document.getElementById('ai-minimize');
  var newChatBtn = document.getElementById('ai-new-chat');
  var statusEl = document.getElementById('ai-status');
  var alertEl = document.getElementById('ai-alert');
  var msgEl = document.getElementById('ai-messages');
  var emptyEl = document.getElementById('ai-empty');
  var quickList = document.getElementById('ai-quick-list');
  var inputEl = document.getElementById('ai-input');
  var sendBtn = document.getElementById('ai-send');
  var attachBar = document.getElementById('ai-attach-bar');
  var uploadBtn = document.getElementById('ai-upload-btn');
  var cameraBtn = document.getElementById('ai-camera-btn');
  var fileInput = document.getElementById('ai-file-input');
  var cameraInput = document.getElementById('ai-camera-input');

  // ---------- Batas ----------
  var MAX_FILES = 3;
  var MAX_FILE_MB = 10;
  var MAX_TOTAL_MB = 20;
  var MAX_MESSAGE = 4000;
  var REQUEST_TIMEOUT_MS = 120000;

  var ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt', 'md', 'csv', 'json',
    'conf', 'ini', 'log', 'sh', 'bash', 'sql', 'yaml', 'yml', 'js', 'ts', 'html', 'css', 'xml', 'toml', 'env.example'];

  // Pola kredensial klien — server memeriksa ulang (sumber keputusan tetap server).
  var SECRET_RE = [
    /-----BEGIN[A-Z ]*PRIVATE KEY-----/,
    /-----BEGIN CERTIFICATE-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
    /\bAIza[A-Za-z0-9_-]{30,}\b/,
    /Bearer\s+[A-Za-z0-9._-]{25,}/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
    /^\s*(?:password|passwd|pwd|db_password|api[_-]?key|apikey|secret|access[_-]?token)\s*[:=]/im
  ];

  var QUICK_PROMPTS = [
    'Bimbing saya mulai dari awal praktek UKK ini.',
    'Jelaskan langkah yang sedang saya kerjakan.',
    'Bantu analisis screenshot error yang saya kirim.',
    'Bantu konfigurasi VM Web server.',
    'Bantu konfigurasi VM Database server.',
    'Jelaskan backup otomatis menggunakan cron.'
  ];

  // ---------- State ----------
  var history = [];         // {role:'user'|'assistant', text}
  var pendingFiles = [];    // File di memori hanya sesi kirim berjalan
  var sending = false;
  var apiBase = null;       // null = belum resolve
  var serviceReady = null;  // tri-state: null/belum, true, false
  var modelLabel = '';

  try {
    var saved = sessionStorage.getItem('ukk-chat-history');
    if (saved) {
      history = JSON.parse(saved) || [];
      if (!Array.isArray(history)) history = [];
    }
  } catch (e) { /* sessionStorage tidak tersedia */ }

  // ---------- Helper ----------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fileSizeLabel(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function extOf(name) {
    var b = String(name).toLowerCase().split('/').pop();
    if (b === '.env.example') return 'env.example';
    var p = b.split('.');
    return p.length > 1 ? p.pop() : '';
  }

  function kindColor(name) {
    var ext = extOf(name);
    if (['png', 'jpg', 'jpeg', 'webp'].indexOf(ext) !== -1) return 'IMG';
    if (ext === 'pdf') return 'PDF';
    return ext.toUpperCase().slice(0, 5) || 'FILE';
  }

  function saveHistory() {
    try { sessionStorage.setItem('ukk-chat-history', JSON.stringify(history.slice(-24))); } catch (e) {}
  }

  // Konteks halaman: heading aktif dari scroll-spy + sub-heading aktif
  function getPageContext() {
    var ctx = {};
    var actives = document.querySelectorAll('.sidebar-nav a.active');
    var first = actives[0];
    if (first) {
      ctx.sectionId = (first.getAttribute('href') || '').replace('#', '');
      ctx.sectionTitle = first.getAttribute('title') || first.textContent;
    }
    var last = actives[actives.length - 1];
    if (last && last !== first) {
      ctx.sectionId = (last.getAttribute('href') || '').replace('#', '');
      ctx.sectionTitle = last.getAttribute('title') || last.textContent;
    }
    if (location.hash) {
      ctx.sectionId = location.hash.replace('#', '');
      ctx.sectionTitle = (document.getElementById(ctx.sectionId) || {}).textContent || undefined;
    }
    // Judul langkah aktif terakhir yang terlihat di viewport
    var steps = document.querySelectorAll('.step');
    for (var i = 0; i < steps.length; i++) {
      var r = steps[i].getBoundingClientRect();
      if (r.top > 0 && r.top < window.innerHeight * 0.4) {
        var badge = steps[i].querySelector('.step-badge');
        if (badge) ctx.stepLabel = badge.textContent;
        var heading = steps[i].previousElementSibling;
        while (heading) {
          if (/^H[23]$/.test(heading.tagName)) break;
          heading = heading.previousElementSibling;
        }
        if (heading && heading.id) {
          ctx.sectionId = heading.id;
          ctx.sectionTitle = heading.textContent;
        }
        break;
      }
    }
    return (ctx.sectionId || ctx.stepLabel) ? ctx : null;
  }

  // ---------- Markdown-lite renderer ----------
  function renderMarkdown(text) {
    var escaped = escapeHtml(text);
    var blocks = escaped.split(/```/);
    var html = '';
    for (var i = 0; i < blocks.length; i++) {
      if (i % 2 === 1) {
        // Blok kode — baris pertama bisa berupa label bahasa
        var lines = blocks[i].split('\n');
        var lang = '';
        if (lines.length > 1 && /^[\w-]{0,12}$/.test(lines[0].trim()) && lines[0].trim() !== '') {
          lang = lines[0].trim().replace(/[^a-z-]/gi, '');
          lines = lines.slice(1);
        }
        var code = lines.join('\n').replace(/^\n+|\n+$/g, '');
        html += '<div class="ai-code"><header><span>' + escapeHtml(lang || 'code') + '</span>' +
          '<button type="button" class="ai-code-copy">Copy</button></header>' +
          '<pre><code>' + escapeHtml(code) + '</code></pre></div>';
      } else {
        var seg = blocks[i];
        // Simpan inline code agar tidak terformat ulang
        var inlineCodes = [];
        seg = seg.replace(/`([^`\n]+)`/g, function (m, c) {
          inlineCodes.push(c);
          return '\u0000IC' + (inlineCodes.length - 1) + '\u0000';
        });
        // Bold
        seg = seg.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Link markdown ke anchor dokumentasi (#id valid)
        seg = seg.replace(/\[([^\]]+)\]\((#?[^)\s]+)\)/g, function (all, label, href) {
          if (href.charAt(0) === '#') {
            var id = href.slice(1);
            if (document.getElementById(id)) {
              return '<a href="./index.html#' + escapeHtml(id) + '">' + label + '</a>';
            }
            return label;
          }
          return label; // hanya anchor lokal yang dirender sebagai link
        });
        seg = seg.replace(/\u0000IC(\d+)\u0000/g, function (m, i) {
          return '<code class="ai-inline-code">' + inlineCodes[Number(i)] + '</code>';
        });
        seg = seg.split(/\n{2,}/).map(function (para) {
          var t = para.trim();
          if (!t) return '';
          return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
        }).join('');
        html += seg;
      }
    }
    return html;
  }

  function attachCodeCopy(container) {
    var btns = container.querySelectorAll('.ai-code-copy');
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener('click', function () {
        var pre = btn.closest('.ai-code').querySelector('pre');
        navigator.clipboard.writeText(pre.textContent).then(function () {
          var prev = btn.textContent;
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = prev;
            btn.classList.remove('copied');
          }, 1600);
        });
      });
    });
  }

  function scrollToBottom() {
    msgEl.scrollTop = msgEl.scrollHeight;
  }

  function addMessage(role, text, extraHtml) {
    if (emptyEl && emptyEl.parentNode) emptyEl.parentNode.removeChild(emptyEl);
    var wrap = document.createElement('div');
    wrap.className = 'ai-msg ' + (role === 'user' ? 'user' : 'ai-bot' + (extraHtml && extraHtml.isError ? ' error' : ''));
    wrap.innerHTML = '<div class="ai-bubble">' + (role === 'user' ? escapeHtml(text).replace(/\n/g, '<br>') : renderMarkdown(text)) + '</div>';
    if (role === 'assistant') {
      // Baris "Sumber:" dipindah ke blok .ai-sources (dihapus dari bubble)
      var m = text.match(/^Sumber:.*$/im);
      if (m) {
        // Render ulang bubble tanpa baris sumber
        var bubble = wrap.querySelector('.ai-bubble');
        var bodyText = text.replace(m[0], '').replace(/\n{2,}$/g, '\n');
        bubble.innerHTML = renderMarkdown(bodyText);
        var s = document.createElement('div');
        s.className = 'ai-sources';
        s.innerHTML = renderMarkdown(m[0]).replace(/^<p>|<\/p>$/g, '');
        wrap.appendChild(s);
      }
    }
    msgEl.appendChild(wrap);
    attachCodeCopy(wrap);
    scrollToBottom();
    return wrap;
  }

  function showAlert(message) {
    alertEl.hidden = false;
    alertEl.textContent = message;
  }

  function hideAlert() {
    alertEl.hidden = true;
  }

  // ---------- Status layanan ----------
  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'ai-status' + (cls ? ' ' + cls : '');
  }

  // Kandidat base URL backend, urut prioritas:
  // 1) window.AI_API_BASE  — bisa diiset tanpa mengubah source code
  // 2) same-origin HANYA bila website dilayani backend (port 3001)
  // 3) http://<host>:3001 — default Apache/XAMPP split setup
  // Same-origin Apache (port 80) sengaja TIDAK jadi kandidat karena
  // /api/* tidak ada di Apache -> sebabnya POST 404.
  function getCandidates() {
    var list = [];
    if (window.AI_API_BASE) {
      list.push(String(window.AI_API_BASE).replace(/\/+$/, ''));
    }
    if (window.location.port === '3001') {
      list.push('');
    }
    var host = window.location.hostname || 'localhost';
    var proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    var def = proto + '//' + (host === '' ? 'localhost' : host) + ':3001';
    if (list.indexOf(def) === -1) list.push(def);
    return list;
  }

  function probeStatus(base) {
    return fetch(base + '/api/ai/status')
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (status) {
        return status && 'model' in status ? status : null;
      })
      .catch(function () { return null; });
  }

  // POST dengan fallback antar-kandidat + membedakan error:
  // {ok:true,data} | {ok:false, status: sedang HTTP atau 0 = jaringan, data}
  function aiChatPost(fd, timeoutMs) {
    var candidates = apiBase !== null ? [apiBase].concat(getCandidates().filter(function (c) { return c !== apiBase; })) : getCandidates();
    var triedIdx = 0;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);

    function attempt(base) {
      return fetch(base + '/api/ai/chat', {
        method: 'POST',
        body: fd,
        signal: controller.signal
      }).then(function (res) {
        if (res.ok) {
          apiBase = base;
          serviceReady = true;
          return res.json().then(function (data) {
            clearTimeout(timer);
            return { ok: true, data: data, status: 200 };
          });
        }
        // 404/405 → endpoint tidak ada di base ini; coba kandidat lain
        if ((res.status === 404 || res.status === 405 || res.status === 502) && triedIdx < candidates.length - 1) {
          triedIdx++;
          return attempt(candidates[triedIdx]);
        }
        clearTimeout(timer);
        apiBase = base;
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: false, status: res.status, data: data };
        });
      }).catch(function (err) {
        if (err && err.name === 'AbortError') {
          clearTimeout(timer);
          return { ok: false, status: 0, aborted: true, data: {} };
        }
        // Jaringan terputus / CORS — coba kandidat berikutnya
        if (triedIdx < candidates.length - 1) {
          triedIdx++;
          return attempt(candidates[triedIdx]);
        }
        clearTimeout(timer);
        return { ok: false, status: 0, network: true, data: {} };
      });
    }

    return attempt(candidates[0]);
  }

  function refreshStatus() {
    setStatus('Memeriksa layanan\u2026');
    var candidates = apiBase !== null ? [apiBase].concat(getCandidates().filter(function (c) { return c !== apiBase; })) : getCandidates();
    function probeNext(i) {
      if (i >= candidates.length) {
        apiBase = candidates[0];
        serviceReady = false;
        setStatus('Layanan AI tidak aktif', 'err');
        showAlert('Layanan AI belum terhubung. Backend AI Tutor belum berjalan \u2014 jalankan backend di folder server/ (lihat AI_TUTOR_SETUP.md).');
        return;
      }
      probeStatus(candidates[i]).then(function (status) {
        if (!status) { probeNext(i + 1); return; }
        apiBase = candidates[i];
        serviceReady = Boolean(status.ready);
        modelLabel = status.model || '';
        if (status.ready) {
          setStatus('Online \u00b7 ' + modelLabel, 'ok');
          hideAlert();
        } else if (status.indexReady === false) {
          setStatus('Konfigurasi bermasalah', 'err');
          showAlert('Backend berjalan tetapi indeks dokumentasi gagal dibaca. Periksa konfigurasi backend.');
        } else {
          setStatus('AI belum dikonfigurasi', 'err');
          showAlert('Layanan AI belum siap: GROQ_API_KEY belum diisi pada backend. Fitur chat memerlukan konfigurasi itu (lihat AI_TUTOR_SETUP.md).');
        }
      });
    }
    probeNext(0);
  }

  // ---------- Attachment ----------
  function renderAttachBar() {
    if (!pendingFiles.length) {
      attachBar.hidden = true;
      attachBar.innerHTML = '';
      return;
    }
    attachBar.hidden = false;
    attachBar.innerHTML = '';
    pendingFiles.forEach(function (item, idx) {
      var chip = document.createElement('span');
      chip.className = 'ai-attach-chip';
      var kindOk = item.preflightOk;
      chip.innerHTML = (item.thumbUrl
        ? '<img class="ai-attach-thumb" src="' + item.thumbUrl + '" alt="">'
        : '<span class="kind' + (kindOk ? '' : ' bad') + '">' + escapeHtml(item.kind) + '</span>') +
        '<span class="name">' + escapeHtml(item.name) + '</span>' +
        '<span class="size">' + fileSizeLabel(item.file.size) + '</span>' +
        '<button type="button" class="ai-attach-remove" aria-label="Hapus lampiran">&times;</button>';
      chip.querySelector('.ai-attach-remove').addEventListener('click', function () {
        if (item.thumbUrl) { try { URL.revokeObjectURL(item.thumbUrl); } catch (e) {} }
        pendingFiles.splice(idx, 1);
        renderAttachBar();
      });
      attachBar.appendChild(chip);
    });
    var warn = pendingFiles.filter(function (p) { return !p.preflightOk; }).map(function (p) { return p.error; });
    if (warn.length) {
      showAlert(warn[0]);
    } else {
      hideAlert();
    }
  }

  function preflight(file) {
    var ext = extOf(file.name);
    var kind = kindColor(file.name);
    if (BLOCKED_EXTENSIONS_CLIENT.indexOf(ext) !== -1) {
      return { ok: false, error: 'File "' + file.name + '" berpotensi berisi kredensial (.env, private key, sertifikat) \u2014 tidak ikut dikirim.' };
    }
    if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
      return { ok: false, error: 'Jenis file "' + file.name + '" tidak didukung. Diterima: gambar PNG/JPG/WEBP, PDF, dan file teks/konfigurasi/log.' };
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return { ok: false, error: 'File "' + file.name + '" melebihi ' + MAX_FILE_MB + ' MB.' };
    }
    var total = pendingFiles.reduce(function (s, p) { return s + p.file.size; }, 0) + file.size;
    if (pendingFiles.length >= MAX_FILES) {
      return { ok: false, error: 'Maksimal ' + MAX_FILES + ' lampiran per pesan.' };
    }
    if (total > MAX_TOTAL_MB * 1024 * 1024) {
      return { ok: false, error: 'Total lampiran melebihi ' + MAX_TOTAL_MB + ' MB.' };
    }
    return { ok: true, error: null };
  }

  function BLOCKED_EXTENSIONS_CLIENT(ext) {
    return ['env', 'pem', 'key', 'p12', 'pfx', 'crt', 'cer', 'der', 'jks'].indexOf(ext) !== -1;
  }

  function addFilesFrom(list) {
    Array.prototype.forEach.call(list, function (file) {
      var pf = preflight(file);
      var entry = { file: file, name: file.name, kind: kindColor(file.name), preflightOk: pf.ok, error: pf.error, preflightData: pf, thumbUrl: null };
      if (/^image\/(png|jpe?g|webp)$/i.test(file.type) && pf.ok) {
        try { entry.thumbUrl = URL.createObjectURL(file); } catch (e) {}
      }
      pendingFiles.push(entry);
      if (!pf.ok) showAlert(pf.error);
    });
    pendingFiles = pendingFiles.filter(function (p) { return p.preflightOk; });
    renderAttachBar();
  }

  function clearPendingFiles() {
    pendingFiles.forEach(function (p) {
      if (p.thumbUrl) { try { URL.revokeObjectURL(p.thumbUrl); } catch (e) {} }
    });
    pendingFiles = [];
    renderAttachBar();
  }

  uploadBtn.addEventListener('click', function () { fileInput.value = ''; fileInput.click(); });
  cameraBtn.addEventListener('click', function () { cameraInput.value = ''; cameraInput.click(); });
  fileInput.addEventListener('change', function () { addFilesFrom(fileInput.files || []); });
  cameraInput.addEventListener('change', function () { addFilesFrom(cameraInput.files || []); });

  // Seret file ke panel juga
  ['dragover', 'drop'].forEach(function (evName) {
    panel.addEventListener(evName, function (e) {
      e.preventDefault();
      if (evName === 'drop' && e.dataTransfer && e.dataTransfer.files) {
        addFilesFrom(e.dataTransfer.files);
      }
    });
  });

  // ---------- Kirim ----------
  function setSending(state) {
    sending = state;
    sendBtn.disabled = state;
    inputEl.disabled = state;
  }

  function clearQuickList() {
    if (emptyEl && emptyEl.parentNode) {
      emptyEl.parentNode.removeChild(emptyEl);
    }
  }

  function restoreEmpty() {
    if (!document.getElementById('ai-empty')) {
      msgEl.insertBefore(emptyEl, msgEl.firstChild);
    }
  }

  function sendMessage(text) {
    text = (text || inputEl.value || '').trim();
    if (!text && !pendingFiles.length) return;
    if (sending) return;

    if (serviceReady === false) {
      refreshStatus(); // status mungkin basi — tetap coba kirim, aiChatPost punya fallback
    }

    clearQuickList();
    addMessage('user', text);

    var userAttach = pendingFiles.map(function (p) {
      return { id: 'c' + Math.random().toString(36).slice(2), name: p.name, kind: p.kind };
    });
    if (userAttach.length) {
      var lastMsg = msgEl.lastElementChild;
      var strip = document.createElement('div');
      strip.className = 'ai-attach-strip';
      strip.innerHTML = userAttach.map(function (a) {
        return '<span class="ai-attach-chip-mini"><span>' + escapeHtml(a.kind) + '</span> ' + escapeHtml(a.name) + '</span>';
      }).join('');
      lastMsg.insertBefore(strip, lastMsg.firstChild);
    }

    history.push({ role: 'user', text: text || '(lampiran)' });

    var fd = new FormData();
    fd.append('message', text);
    fd.append('history', JSON.stringify(history.slice(-16)));
    var pageCtx = getPageContext();
    if (pageCtx) fd.append('context', JSON.stringify(pageCtx));
    pendingFiles.forEach(function (p) { fd.append('files', p.file, p.name); });

    clearPendingFiles();
    inputEl.value = '';
    autosize();

    var thinking = document.createElement('div');
    thinking.className = 'ai-thinking';
    thinking.innerHTML = 'AI sedang membaca dokumentasi <span class="dots"><span></span><span></span><span></span></span>';
    msgEl.appendChild(thinking);
    scrollToBottom();

    setSending(true);

    aiChatPost(fd, REQUEST_TIMEOUT_MS).then(function (result) {
      if (result.ok) {
        var reply = String(result.data.reply || '');
        addMessage('assistant', reply);
        history.push({ role: 'assistant', text: reply });
        saveHistory();
        hideAlert();
      } else if (result.aborted) {
        addMessage('assistant', 'Permintaan melebihi batas waktu (' + Math.round(REQUEST_TIMEOUT_MS / 1000) + ' detik). Coba lagi dengan pertanyaan lebih singkat atau lebih sedikit lampiran.', { isError: true });
      } else if (result.network || result.status === 0) {
        serviceReady = false;
        addMessage('assistant',
          'Layanan AI tidak dapat dijangkau (request gagal sebelum masuk ke backend).\n\n' +
          'Kemungkinan: backend Node.js belum berjalan, alamatnya salah, atau diblokir. Backend yang benar: http://localhost:3001/api/ai/chat \u2014 lihat AI_TUTOR_SETUP.md.', { isError: true });
      } else if (result.status === 404 || result.status === 405) {
        serviceReady = false;
        addMessage('assistant',
          'Endpoint AI tidak ditemukan (HTTP ' + result.status + ').\n\n' +
          'Biasanya karena backend belum berjalan atau URL yang dipakai frontend salah. Refresh halaman ini setelah backend berjalan.', { isError: true });
      } else if (result.status >= 500) {
        addMessage('assistant',
          (result.data && result.data.message) || 'Kesalahan pada backend AI (HTTP ' + result.status + '). Coba lagi beberapa saat.', { isError: true });
      } else {
        var msg = (result.data && result.data.message) || 'Terjadi kesalahan pada layanan AI (HTTP ' + result.status + ').';
        addMessage('assistant', msg, { isError: true });
        if (result.status === 429) {
          // Kuota/rate limit — status tetap; cukup tampilkan pesan.
        }
      }
    }).finally(function () {
      if (thinking.parentNode) thinking.parentNode.removeChild(thinking);
      setSending(false);
      inputEl.focus();
      scrollToBottom();
    });
  }

  sendBtn.addEventListener('click', function () { sendMessage(); });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function autosize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }
  inputEl.addEventListener('input', autosize);

  // ---------- Quick prompts ----------
  QUICK_PROMPTS.forEach(function (q) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-quick';
    btn.textContent = q;
    btn.addEventListener('click', function () {
      sendMessage(q);
    });
    quickList.appendChild(btn);
  });

  // ---------- New chat ----------
  newChatBtn.addEventListener('click', function () {
    history = [];
    clearPendingFiles();
    try { sessionStorage.removeItem('ukk-chat-history'); } catch (e) {}
    msgEl.querySelectorAll('.ai-msg, .ai-thinking').forEach(function (el) { el.remove(); });
    restoreEmpty();
    hideAlert();
    inputEl.focus();
  });

  // ---------- Open / minimize / close panel ----------
  // Launcher (fab) selalu muncul saat panel tertutup/diminimalkan.
  // Tiga kondisi: expanded (openPanel), minimized (minimizeBtn), closed (closeBtn/Escape).
  // Riwayat, pesan, lampiran pending, dan request in-flight TIDAK disentuh.
  var panelState = 'closed'; // 'closed' | 'minimized' | 'open'

  function setLauncherState() {
    var minimized = panelState === 'minimized';
    var label = minimized ? 'AI Tutor diminimalkan \u2014 klik untuk buka kembali' : 'Buka AI Tutor';
    fab.setAttribute('aria-label', label);
    fab.setAttribute('title', minimized ? 'Buka kembali AI Tutor' : 'Buka AI Tutor');
  }

  function openPanel() {
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    fab.style.display = 'none';
    document.body.classList.add('ai-dock-open');
    panelState = 'open';
    refreshStatus();
    if (history.length && !msgEl.querySelector('.ai-msg')) {
      // Pulihkan percakapan tersimpan
      history.forEach(function (h) { addMessage(h.role === 'assistant' ? 'assistant' : 'user', h.text); });
    }
    inputEl.focus();
    if (window.innerWidth <= 600) {
      document.body.style.overflow = 'hidden'; // tanpa scroll ganda saat panel fullscreen
    }
  }

  function hidePanel(state) {
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    fab.style.display = '';
    document.body.classList.remove('ai-dock-open');
    document.body.style.overflow = '';
    panelState = state;
    setLauncherState();
    fab.focus(); // kembalikan fokus ke launcher
  }

  fab.addEventListener('click', openPanel);
  minimizeBtn.addEventListener('click', function () { hidePanel('minimized'); });
  closeBtn.addEventListener('click', function () { hidePanel('closed'); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) hidePanel('closed');
  });

  // ---------- Init history render saat load ----------
  if (history.length) {
    // Tidak render otomatis saat init; akan dirender saat panel dibuka (openPanel).
  }
})();
