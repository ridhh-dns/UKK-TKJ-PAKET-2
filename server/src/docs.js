// Indeks dokumentasi lokal — dibaca langsung dari index.html saat start server.
// Tidak ada salinan konten manual, sehingga indeks selalu mengikuti sumber.
// Tidak pakai vector DB eksternal: dokumennya kecil, pencarian kata kunci cukup.

import { readFileSync } from 'node:fs';

function stripTags(s) {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStepsFrom(blockHtml) {
  const labelMatch = blockHtml.match(/<span class="step-badge">([\s\S]*?)<\/span>/);
  const label = labelMatch ? stripTags(labelMatch[1]) : 'Langkah';

  const texts = [];
  const codeBlocks = [];
  let m;

  const preRe = /<pre><code(?:\s+class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/g;
  while ((m = preRe.exec(blockHtml)) !== null) {
    codeBlocks.push(m[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim());
  }

  const pRe = /<p>([\s\S]*?)<\/p>/g;
  while ((m = pRe.exec(blockHtml)) !== null) {
    const t = stripTags(m[1]);
    if (t) texts.push(t);
  }

  const imgMatch = blockHtml.match(/<img[^>]+src="assets\/([^"]+)"/);

  return {
    label,
    text: texts.join(' '),
    code: codeBlocks,
    image: imgMatch ? imgMatch[1] : null
  };
}

function tokenize(q) {
  return q.toLowerCase().split(/[^a-z0-9_.-]+/).filter((t) => t.length >= 2);
}

export function buildDocIndex(indexPath) {
  const html = readFileSync(indexPath, 'utf8');

  const mainMatch = html.match(/<main class="main">([\s\S]*?)<\/main>/);
  const main = mainMatch ? mainMatch[1] : html;

  // Kumpulkan marker berurutan: h2, h3, div.step
  const markers = [];
  const hRe = /<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = hRe.exec(main)) !== null) {
    markers.push({ kind: 'heading', level: Number(m[1]), id: m[2], title: stripTags(m[3]), pos: m.index, len: m[0].length });
  }
  markers.sort((a, b) => a.pos - b.pos);

  const stepStarts = [];
  const stepRe = /<div class="step">/g;
  while ((m = stepRe.exec(main)) !== null) {
    stepStarts.push(m.index);
  }

  // Temukan penutup seimbang untuk tiap <div class="step"> (nested div dihitung).
  const stepBlocks = [];
  for (const start of stepStarts) {
    let depth = 0;
    let i = start;
    let end = main.length;
    const tagRe = /<\/?div[^>]*>/g;
    tagRe.lastIndex = start;
    while ((m = tagRe.exec(main)) !== null) {
      if (m[0].startsWith('</')) depth--;
      else depth++;
      i = m.index + m[0].length;
      if (depth === 0) {
        end = m.index;
        break;
      }
    }
    stepBlocks.push({ start, end });
  }

  // Gabungkan dan urutkan semua marker dengan posisinya.
  const timeline = [
    ...markers,
    ...stepBlocks.map((s) => ({ kind: 'step', pos: s.start, start: s.start, end: s.end }))
  ].sort((a, b) => a.pos - b.pos);

  const sections = [];   // {id,title,level,parentId}
  const sectionById = new Map();
  const steps = [];      // {index,sectionId,label,text,code,image}
  let currentTop = null; // id h2 terakhir (Bagian N)
  let currentHeadingId = null;

  for (const item of timeline) {
    if (item.kind === 'heading') {
      const sec = {
        id: item.id,
        title: item.title,
        level: item.level,
        parentId: item.level === 3 ? currentTop : null
      };
      sections.push(sec);
      sectionById.set(sec.id, sec);
      if (item.level === 2) currentTop = item.id;
      currentHeadingId = item.id;
    } else {
      const st = extractStepsFrom(main.slice(item.start, item.end));
      st.index = steps.length;
      st.sectionId = currentHeadingId || currentTop;
      st.topId = currentTop;
      st.sectionTitle = currentHeadingId ? (sectionById.get(currentHeadingId)?.title || '') : (sectionById.get(currentTop)?.title || '');
      steps.push(st);
    }
  }

  // Teks lintas dan ringkasan step untuk pencarian
  const allTopId = new Set(steps.map((s) => s.topId));

  function fullTextOfStep(s) {
    return [s.label, s.sectionTitle, s.text, s.code.join(' '), s.image || ''].join('\n').toLowerCase();
  }
  const stepSearchTexts = steps.map(fullTextOfStep);

  function clip(text, max = 420) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trim() + '…' : text;
  }

  function scoreStep(s, idx, tokens) {
    let score = 0;
    const titleLower = (s.sectionTitle + ' ' + s.label).toLowerCase();
    for (const t of tokens) {
      if (titleLower.includes(t)) score += 4;
      let re;
      try { re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); } catch { continue; }
      const inText = (s.text.toLowerCase().match(re) || []).length;
      const inCode = (s.code.join(' ').toLowerCase().match(re) || []).length;
      score += Math.min(inText, 4) * 2;
      score += Math.min(inCode, 4) * 3;
    }
    return score;
  }

  function search(query, { maxResults = 5, excludeTopId = null } = {}) {
    const tokens = tokenize(query);
    if (!tokens.length) return null;
    const scored = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (excludeTopId && s.topId === excludeTopId) continue;
      const sc = scoreStep(s, i, tokens);
      if (sc > 0) scored.push({ step: s, sc });
    }
    scored.sort((a, b) => b.sc - a.sc);

    const results = [];
    for (const { step } of scored.slice(0, Math.max(1, maxResults) * 2)) {
      const snippet = step.text
        ? clip(step.text, 300)
        : (step.code.length ? 'Perintah: ' + clip(step.code.join(' / '), 240) : 'Langkah berupa screenshot konfigurasi.');
      results.push({
        label: step.label,
        sectionTitle: step.sectionTitle,
        sectionId: step.sectionId,
        anchor: '#' + step.sectionId,
        snippet,
        code: clip(step.code.join('\n'), 500),
        image: step.image
      });
      if (results.length >= maxResults) break;
    }
    return results.length ? { results } : null;
  }

  function readSection(sectionId) {
    const sec = sectionById.get(sectionId);
    if (!sec) return null;
    const parentId = sec.parentId || sectionId;
    const inSec = steps.filter((s) => s.sectionId === sectionId || (sec.level === 2 && s.topId === sectionId));
    const detail = {
      sectionId,
      title: sec.title,
      anchor: '#' + sectionId,
      level: sec.level,
      totalSteps: inSec.length,
      steps: inSec.slice(0, 20).map((s) => ({
        label: s.label,
        text: clip(s.text, 600),
        code: clip(s.code.join('\n'), 900),
        image: s.image ? 'assets/' + s.image : null,
        count: inSec.length
      })),
      truncated: inSec.length > 20 ? 'Truncated. Bila butuh langkah lebih, gunakan search_ukk_documentation dengan kata kunci lebih spesifik.' : undefined
    };
    return detail;
  }

  function relatedSteps(query, currentSectionId) {
    // Top-level bagian dari currentSectionId
    let excludeId = currentSectionId;
    let cur = sectionById.get(currentSectionId);
    while (cur && cur.parentId) {
      excludeId = cur.parentId;
      cur = sectionById.get(cur.parentId);
    }
    return search(query, { maxResults: 5, excludeTopId: excludeId });
  }

  const outline = sections.map((s) => ({ id: s.id, title: s.title, level: s.level }));
  const outlineText = sections
    .map((s) => (s.level === 2 ? '\n' : '') + `${s.level === 2 ? '## ' : '### '}${s.title} (id: ${s.id})`)
    .join('\n');

  return {
    sections,
    sectionById,
    steps,
    outline,
    outlineText,
    search,
    readSection,
    relatedSteps
  };
}
