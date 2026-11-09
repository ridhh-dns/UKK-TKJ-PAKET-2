// ==========================================
// 1. Copy Button for Code Blocks
// ==========================================
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.code-copy');
  if (!btn) return;
  var pre = btn.closest('.code-block').querySelector('pre');
  var text = pre.textContent;
  navigator.clipboard.writeText(text).then(function () {
    var originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  });
});

// ==========================================
// 2. Lightbox (pratinjau lampiran AI Tutor)
//    Tutup via tombol close, klik latar, atau Escape.
// ==========================================
var lightbox = document.getElementById('lightbox');

if (lightbox) {
  lightbox.addEventListener('click', function (e) {
    if (
      e.target === lightbox ||
      e.target.classList.contains('lightbox-content') ||
      e.target.closest('.lightbox-close')
    ) {
      lightbox.classList.remove('open');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (lightbox.classList.contains('open') && e.key === 'Escape') {
      lightbox.classList.remove('open');
    }
  });
}

// ==========================================
// 3. Reading Progress Bar & Back to Top
// ==========================================
var progressBar = document.getElementById('progress-bar');
var backToTopBtn = document.getElementById('back-to-top');

window.addEventListener('scroll', function () {
  var scrollTop = window.scrollY || document.documentElement.scrollTop;
  var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  var scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

  if (progressBar) {
    progressBar.style.width = scrollPercent + '%';
  }

  if (backToTopBtn) {
    if (scrollTop > 400) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  }
}, { passive: true });

if (backToTopBtn) {
  backToTopBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ==========================================
// 4. Sidebar Mobile Toggle
// ==========================================
var menuBtn = document.getElementById('menu-btn');
var sidebar = document.getElementById('sidebar');
var overlay = document.getElementById('sidebar-overlay');

if (menuBtn && sidebar && overlay) {
  menuBtn.addEventListener('click', function () {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay.addEventListener('click', function () {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  sidebar.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth < 1024) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      }
    });
  });
}

// ==========================================
// 5. Sidebar Quick Search / Filter
// ==========================================
var searchInput = document.getElementById('sidebar-search');
if (searchInput) {
  searchInput.addEventListener('input', function (e) {
    var query = e.target.value.toLowerCase().trim();
    var navLinks = document.querySelectorAll('.sidebar-nav a');

    navLinks.forEach(function (link) {
      var text = link.textContent.toLowerCase();
      var li = link.closest('li') || link;
      if (!query || text.indexOf(query) !== -1) {
        li.style.display = '';
      } else {
        li.style.display = 'none';
      }
    });
  });
}

// ==========================================
// 6. Scroll-Spy (hierarkis; satu mekanisme: rAF-throttled scroll
//    + click immediate + hashchange + resize/load recompute)
// ==========================================
var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.sidebar-nav a[href^="#"]'));

var spySections = [];
spyLinks.forEach(function (link) {
  var id = link.getAttribute('href').slice(1);
  var el = document.getElementById(id);
  if (el) spySections.push({ id: id, el: el, link: link });
});
// Urut sesuai urutan dokumen agar aritmetika "bagian terakhir yang dilewati" valid.
spySections.sort(function (a, b) {
  return (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
});

var spyActiveId = '';

function setSpyActive(id) {
  if (id === spyActiveId) return;
  spyActiveId = id;
  spyLinks.forEach(function (l) { l.classList.remove('active'); });
  if (!id) return;
  var link = document.querySelector('.sidebar-nav a[href="#' + id + '"]');
  if (!link) return;
  link.classList.add('active');
  var parentList = link.closest('.nav-sub-list');
  if (parentList) {
    var groupTitle = parentList.previousElementSibling;
    if (groupTitle && groupTitle.classList.contains('nav-group-title')) {
      groupTitle.classList.add('active');
    }
  }
}

function updateSpy() {
  var scrollTop = window.scrollY || document.documentElement.scrollTop;
  var viewportH = window.innerHeight || 600;
  var docHeight = document.documentElement.scrollHeight;
  // Di dasar halaman: selalu bagian terakhir.
  var atBottom = (scrollTop + viewportH) >= (docHeight - 4);
  var trigger = scrollTop + Math.max(140, viewportH * 0.18);
  var current = null;
  for (var i = 0; i < spySections.length; i++) {
    if (spySections[i].el.getBoundingClientRect().top + scrollTop <= trigger) current = spySections[i];
  }
  if (atBottom && spySections.length) current = spySections[spySections.length - 1];
  setSpyActive(current ? current.id : '');
}

// T throttling via requestAnimationFrame — scroll handler murah.
var spyTicking = false;
function scheduleSpy() {
  if (spyTicking) return;
  spyTicking = true;
  (window.requestAnimationFrame || setTimeout)(function () {
    spyTicking = false;
    updateSpy();
  });
}

window.addEventListener('scroll', scheduleSpy, { passive: true });
window.addEventListener('resize', scheduleSpy);
window.addEventListener('load', updateSpy);

// ---- Snap-to-anchor: pastikan judul target HANYA berhenti di posisi tep
// (scroll-margin-top) bahkan jika layout berubah saat gambar lazy-load.
// Native anchor tetap berlaku; snap ini hanya koreksi pasca-jump.
var snapToken = 0;
function snapToAnchor(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var token = ++snapToken;
  var margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  var tries = 0;
  function tick() {
    if (token !== snapToken) return;           // koreksi baru menggantikan ini
    var top = el.getBoundingClientRect().top;
    var want = top - margin;
    if (Math.abs(want) > 1) window.scrollTo(0, Math.max(0, (window.scrollY || document.documentElement.scrollTop) + want));
    tries++;
    var now = el.getBoundingClientRect().top;
    // berhenti bila sudah stabil 2 frame berurutan atau mencapai batas
    (window.requestAnimationFrame || setTimeout)(function () {
      if (token !== snapToken) return;
      var stable = Math.abs(el.getBoundingClientRect().top - margin) < 1;
      if (tries < 40 && !stable) tick();
      else scheduleSpy();
    }, 0);
  }
  tick();
}

window.addEventListener('hashchange', function () {
  var id = decodeURIComponent((window.location.hash || '').slice(1));
  if (id && document.getElementById(id)) {
    // Klik nav & Back/Forward: active langsung mengikuti target.
    setSpyActive(id);
    snapToAnchor(id);
  }
  scheduleSpy();
}, false);

// Klik langkah/bagian → active state langsung diperbarui saat itu, bukan menunggu scroll.
spyLinks.forEach(function (link) {
  link.addEventListener('click', function () {
    var id = link.getAttribute('href').slice(1);
    if (document.getElementById(id)) {
      setSpyActive(id);
      // Native anchor jump instan; snap mengoreksi drift layout (gambar lazy).
      snapToAnchor(id);
    }
  });
});

// Deep-link pertama (URL ber-hash, mis. refresh di tengah Bagian 5):
// setelah semua aset termuat, pastikan target tepat di posisi kompensasi.
window.addEventListener('load', function () {
  var id = decodeURIComponent((window.location.hash || '').slice(1));
  if (id && document.getElementById(id)) snapToAnchor(id);
  else updateSpy();
});

updateSpy();

// ==========================================
// 7. Sidebar Collapse (desktop) + chip nomor bagian
// ==========================================
// Dekorasi: nomor bagian jadi chip agar tetap terlihat saat sidebar minim.
// Struktur DOM asli tetap ada; hanya dibungkus span tambahan.
document.querySelectorAll('.sidebar-nav .nav-group-title').forEach(function (link) {
  var text = link.textContent.trim();
  link.setAttribute('title', text);
  var numMatch = text.match(/\d+/);
  var chip = document.createElement('span');
  chip.className = 'nav-chip';
  chip.textContent = numMatch ? numMatch[0] : '';
  var label = document.createElement('span');
  label.className = 'nav-cat-label';
  label.textContent = text;
  link.textContent = '';
  link.appendChild(chip);
  link.appendChild(label);
});

var sidebarRoot = document.documentElement;
var collapseBtn = document.getElementById('sidebar-collapse');
var searchToggleMin = document.getElementById('sidebar-search-toggle');

function setSidebarMin(min) {
  var isDesktop = window.innerWidth >= 1024;
  if (!isDesktop) return;
  sidebarRoot.classList.toggle('sidebar-min', min);
  if (collapseBtn) {
    collapseBtn.setAttribute('aria-expanded', String(!min));
    collapseBtn.setAttribute('title', min ? 'Perbesar sidebar' : 'Perkecil sidebar');
  }
  try { localStorage.setItem('ukk-sidebar-min', min ? '1' : '0'); } catch (e) {}
}

if (collapseBtn) {
  collapseBtn.addEventListener('click', function () {
    setSidebarMin(!sidebarRoot.classList.contains('sidebar-min'));
  });
}

if (searchToggleMin) {
  searchToggleMin.addEventListener('click', function () {
    if (sidebarRoot.classList.contains('sidebar-min')) {
      setSidebarMin(false);
    }
    var input = document.getElementById('sidebar-search');
    if (input) input.focus();
  });
}

try {
  if (localStorage.getItem('ukk-sidebar-min') === '1' && window.innerWidth >= 1024) {
    sidebarRoot.classList.add('sidebar-min');
    if (collapseBtn) collapseBtn.setAttribute('aria-expanded', 'false');
  }
} catch (e) {}

window.addEventListener('resize', function () {
  if (window.innerWidth < 1024) {
    sidebarRoot.classList.remove('sidebar-min');
  }
});


// ==========================================
// 8. Theme Toggle (light/dark, persisted)
// ==========================================

var rootElement = document.documentElement;
var themeToggle = document.getElementById('theme-toggle');

var currentTheme = rootElement.getAttribute('data-theme') || 'light';

if (themeToggle) {
  themeToggle.addEventListener('click', function () {
    var nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    rootElement.setAttribute('data-theme', nextTheme);
    currentTheme = nextTheme;
    try {
      localStorage.setItem('ukk-theme', nextTheme);
    } catch (e) {}
  });
}

