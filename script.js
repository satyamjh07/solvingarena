/* ═══════════════════════════════════════════════════════
   ZEROday v2 — Main Script (File-based PYQ + Booklets)
   ═══════════════════════════════════════════════════════

   FOLDER STRUCTURE EXPECTED:
   ─────────────────────────────────────────────────────
   PYQs/
     physics/
       manifest.json          ← ["Kinematics", "Electrostatics", ...]
       Kinematics.json        ← array of question objects
       Electrostatics.json
     chemistry/
       manifest.json
       Chemical Bonding.json
     mathematics/
       manifest.json
       Calculus.json

   Booklets/
     manifest.json            ← array of booklet descriptor objects (see below)
     Chemistry_Zara_Hatke/
       manifest.json          ← booklet meta + subjects descriptor (see below)
       Inorganic/
         manifest.json        ← ["Chemical Bonding", "Coordination Compounds", ...]
         Chemical Bonding.json
         Coordination Compounds.json
       Organic/
         manifest.json
         ...

   ─────────────────────────────────────────────────────
   Booklets/manifest.json format:
   [
     {
       "id": "chem-hatke",
       "folder": "Chemistry_Zara_Hatke",
       "title": "Chemistry Zara Hatke Questions",
       "icon": "⚗️",
       "description": "Curated inorganic chemistry questions.",
       "tags": ["Chemistry", "Inorganic"]
     }
   ]

   Booklets/Chemistry_Zara_Hatke/manifest.json format:
   {
     "subjects": {
       "Inorganic": { "label": "Inorganic", "icon": "🔬", "desc": "...", "comingSoon": false },
       "Organic":   { "label": "Organic",   "icon": "🌿", "desc": "...", "comingSoon": true  }
     }
   }

   Booklets/Chemistry_Zara_Hatke/Inorganic/manifest.json format:
   ["Chemical Bonding", "Coordination Compounds", "Periodic Table"]

   Question object format (same for PYQs and Booklets):
   {
     "id": "phy_kin_001",
     "chapter": "Kinematics",
     "difficulty": "easy",          ← "easy" | "medium" | "hard"
     "type": "mcq",                 ← "mcq" | "integer"
     "text": "Question text with $LaTeX$ supported",
     "image": "",                   ← optional image URL / relative path
     "options": [                   ← only for mcq
       { "text": "$5\\,\\text{m/s}$" },
       { "text": "$10\\,\\text{m/s}$" }
     ],
     "correct": 1,                  ← 0-based index, only for mcq
     "answer": 10,                  ← numerical answer, only for integer
     "explanation": "Solution text with **bold** and $LaTeX$"
   }
   ═══════════════════════════════════════════════════════ */

// ── Storage & Stats ──────────────────────────────────────

const STORAGE_KEY = 'zeroday_v2';

const defaultStats = {
  score: 0, streak: 0,
  total: 0, correct: 0, wrong: 0,
  subjects: {
    physics:     { total: 0, correct: 0, chapters: {} },
    chemistry:   { total: 0, correct: 0, chapters: {} },
    mathematics: { total: 0, correct: 0, chapters: {} }
  }
};

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return JSON.parse(JSON.stringify(defaultStats));
}

function saveStats(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let stats = loadStats();

// ── Question state (shared for PYQ + Booklet) ─────────────
const qState = {
  mode: 'pyq',           // 'pyq' | 'booklet'
  subject: 'physics',
  chapter: null,
  questions: [],
  index: 0,
  answered: false,
  statuses: []           // 'unseen' | 'correct' | 'wrong' | 'skipped'
};

// ── Booklet navigation state ───────────────────────────────
const bookletNav = {
  bookletId: null,
  bookletFolder: null,
  subjectKey: null,
  chapterName: null
};

// ═══════════════════════════════════════════════════════
//  Generic JSON Fetcher
// ═══════════════════════════════════════════════════════

async function fetchJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[ZEROday] Could not fetch ${path}:`, e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
//  Navigation
// ═══════════════════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  const nb = document.querySelector(`.nav-btn[data-screen="${id}"]`);
  if (nb) nb.classList.add('active');
  if (id === 'home') updateDashboard();
  if (id === 'booklet') showBookletLanding();
}

document.querySelectorAll('[data-screen]').forEach(el => {
  el.addEventListener('click', () => showScreen(el.dataset.screen));
});
document.querySelectorAll('[data-goto]').forEach(el => {
  el.addEventListener('click', () => showScreen(el.dataset.goto));
});

// ═══════════════════════════════════════════════════════
//  Dashboard
// ═══════════════════════════════════════════════════════

function updateDashboard() {
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-correct').textContent = stats.correct;
  document.getElementById('stat-wrong').textContent = stats.wrong;
  document.getElementById('stat-score').textContent = stats.score;
  document.getElementById('nav-score').textContent = '⚡ ' + stats.score;
  document.getElementById('stat-streak').textContent = `🔥 ${stats.streak} streak`;
  const acc = stats.total > 0 ? Math.round(stats.correct / stats.total * 100) : 0;
  document.getElementById('stat-accuracy').textContent = `${acc}% accuracy`;

  const greetings = ['Keep pushing! 🚀','Stay focused! 🎯','You got this! 💪','Practice makes perfect! ✨'];
  document.getElementById('greeting-sub').textContent = greetings[Math.floor(Date.now()/3600000) % greetings.length];

  ['physics','chemistry','mathematics'].forEach(sub => {
    const d = stats.subjects[sub] || { total:0, correct:0 };
    const pct = d.total > 0 ? Math.round(d.correct / d.total * 100) : 0;
    const key = sub === 'mathematics' ? 'math' : sub.slice(0,4);
    const barEl = document.getElementById(`bar-${key}`);
    const txtEl = document.getElementById(`bar-${key}-txt`);
    if (barEl) barEl.style.width = pct + '%';
    if (txtEl) txtEl.textContent = `${d.correct} / ${d.total}`;
  });

  const allChapters = [];
  Object.entries(stats.subjects).forEach(([sub, sd]) => {
    Object.entries(sd.chapters || {}).forEach(([ch, cd]) => {
      if (cd.total > 0) allChapters.push({ sub, ch, ...cd, acc: Math.round(cd.correct/cd.total*100) });
    });
  });
  allChapters.sort((a,b) => b.correct - a.correct);
  const top5 = allChapters.slice(0, 5);
  const el = document.getElementById('top-chapters');
  if (top5.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p style="font-size:0.85rem">Solve some questions to see your chapter rankings!</p></div>`;
  } else {
    el.innerHTML = top5.map((c, i) => `
      <div class="chapter-item">
        <div>
          <span class="chapter-rank">#${i+1}</span>
          <span style="margin-left:0.4rem">${c.ch}</span>
          <span style="color:var(--muted);font-size:0.78rem;margin-left:0.3rem">(${c.sub})</span>
        </div>
        <span class="chapter-score">${c.correct}/${c.total} · ${c.acc}%</span>
      </div>
    `).join('');
  }
}

// ═══════════════════════════════════════════════════════
//  PYQ System — file-based
// ═══════════════════════════════════════════════════════

// Cache fetched chapter data so we don't re-fetch on every click
const _pyqCache = {};

async function buildChapterList(subject) {
  const el = document.getElementById('chapter-list');
  el.innerHTML = `<div class="loading-state">Loading chapters…</div>`;

  const chapters = await fetchJSON(`PYQs/${subject}/manifest.json`);

  if (!chapters || chapters.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:0.8rem;font-size:0.83rem">No chapters found.<br>Make sure <code>PYQs/${subject}/manifest.json</code> exists.</div>`;
    return;
  }

  el.innerHTML = chapters.map(ch => `
    <button class="chapter-btn" data-chapter="${ch}">${ch}</button>
  `).join('');

  el.querySelectorAll('.chapter-btn').forEach(btn => {
    btn.addEventListener('click', () => selectChapter(btn.dataset.chapter));
  });
}

async function selectChapter(ch) {
  const subject = document.querySelector('.subject-btn.active').dataset.subject;
  const cacheKey = `${subject}/${ch}`;

  // Show loading state
  document.getElementById('empty-state-q').classList.add('hidden');
  document.getElementById('q-content').classList.add('hidden');
  document.getElementById('q-nav-grid').innerHTML = `<span style="color:var(--muted);font-size:0.8rem">Loading…</span>`;

  document.querySelectorAll('.chapter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.chapter === ch);
  });

  // Fetch if not cached
  if (!_pyqCache[cacheKey]) {
    // Encode spaces as %20 for the URL but keep display name as-is
    const fileName = encodeURIComponent(ch) + '.json';
    const data = await fetchJSON(`PYQs/${subject}/${fileName}`);
    if (!data) {
      document.getElementById('empty-state-q').classList.remove('hidden');
      document.getElementById('empty-state-q').innerHTML = `
        <h3>Could not load questions</h3>
        <p>Make sure <code>PYQs/${subject}/${ch}.json</code> exists.</p>
      `;
      document.getElementById('q-nav-grid').innerHTML = '';
      document.getElementById('qnav-title').textContent = 'Questions';
      return;
    }
    _pyqCache[cacheKey] = data;
  }

  qState.mode = 'pyq';
  qState.chapter = ch;
  qState.subject = subject;
  qState.questions = _pyqCache[cacheKey];
  qState.index = 0;
  qState.answered = false;
  qState.statuses = qState.questions.map(() => 'unseen');

  document.getElementById('qnav-title').textContent = `${ch} (${qState.questions.length})`;
  buildQNav();
  document.getElementById('empty-state-q').classList.add('hidden');
  document.getElementById('q-content').classList.remove('hidden');
  loadQuestion();
}

document.querySelectorAll('.subject-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qState.subject = btn.dataset.subject;
    buildChapterList(btn.dataset.subject);
    document.getElementById('empty-state-q').classList.remove('hidden');
    document.getElementById('q-content').classList.add('hidden');
    document.getElementById('q-nav-grid').innerHTML = '';
    document.getElementById('qnav-title').textContent = 'Questions';
  });
});

// ═══════════════════════════════════════════════════════
//  Question Rendering (shared PYQ + Booklet)
// ═══════════════════════════════════════════════════════

function getCtx() {
  if (qState.mode === 'booklet') {
    const bc = document.getElementById('booklet-content');
    return { $: id => bc.querySelector('#' + id) };
  }
  return { $: id => document.getElementById(id) };
}

function formatText(text) {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function renderMath(el) {
  if (!el) return;
  setTimeout(() => {
    if (window.renderMathInElement) {
      renderMathInElement(el, {
        delimiters: [
          { left:'$$', right:'$$', display:true },
          { left:'$', right:'$', display:false }
        ],
        throwOnError: false
      });
    }
  }, 30);
}

function buildQNav() {
  const { $ } = getCtx();
  const grid = $('q-nav-grid');
  if (!grid) return;
  grid.innerHTML = qState.questions.map((q, i) => `
    <button class="q-box ${qState.statuses[i]} ${i === qState.index ? 'current' : ''}"
      data-idx="${i}">${i+1}</button>
  `).join('');
  grid.querySelectorAll('.q-box').forEach(btn => {
    btn.addEventListener('click', () => jumpToQuestion(+btn.dataset.idx));
  });
}

function updateQNav() {
  const { $ } = getCtx();
  const grid = $('q-nav-grid');
  if (!grid) return;
  grid.querySelectorAll('.q-box').forEach((box, i) => {
    box.className = `q-box ${qState.statuses[i]} ${i === qState.index ? 'current' : ''}`;
  });
}

function jumpToQuestion(idx) {
  qState.index = idx;
  qState.answered = false;
  loadQuestion();
  updateQNav();
}

function loadQuestion() {
  const q = qState.questions[qState.index];
  if (!q) return;

  const { $ } = getCtx();

  qState.answered = false;
  $('btn-next').disabled = true;
  $('integer-feedback').textContent = '';
  $('integer-input').value = '';
  $('integer-input').className = 'integer-input';
  $('explanation-box').classList.remove('show');
  $('q-card').classList.remove('pop-anim');

  const diffClass = { easy:'badge-easy', medium:'badge-medium', hard:'badge-hard' }[q.difficulty] || '';
  const typeClass = q.type === 'integer' ? 'badge-integer' : 'badge-mcq';
  $('q-meta').innerHTML = `
    <span class="q-badge badge-chapter">${q.chapter}</span>
    <span class="q-badge ${diffClass}">${q.difficulty}</span>
    <span class="q-badge ${typeClass}">${q.type === 'integer' ? 'Numerical' : 'MCQ'}</span>
  `;
  $('q-text').innerHTML = formatText(q.text);

  const imgEl = $('q-image');
  if (q.image) { imgEl.src = q.image; imgEl.classList.remove('hidden'); }
  else { imgEl.classList.add('hidden'); }

  if (q.type === 'integer') {
    $('options-grid').classList.add('hidden');
    $('integer-wrap').classList.remove('hidden');
  } else {
    $('integer-wrap').classList.add('hidden');
    $('options-grid').classList.remove('hidden');
    renderOptions(q);
  }

  $('q-progress').textContent = `${qState.index+1} / ${qState.questions.length}`;
  renderMath($('q-card'));
}

function renderOptions(q) {
  const keys = ['A','B','C','D','E'];
  const { $ } = getCtx();
  const grid = $('options-grid');
  grid.innerHTML = q.options.map((opt, i) => `
    <button class="option-btn" data-idx="${i}" type="button">
      <span class="option-key">${keys[i]}</span>
      <span class="option-text">${opt.text || ''}${opt.image ? `<img src="${opt.image}" class="q-image" style="margin-top:0.4rem"/>` : ''}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMCQAnswer(+btn.dataset.idx));
  });
}

function handleMCQAnswer(selected) {
  if (qState.answered) return;
  qState.answered = true;
  const q = qState.questions[qState.index];
  const isCorrect = selected === q.correct;
  const { $ } = getCtx();

  $('options-grid').querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.add('disabled');
    if (i === q.correct) btn.classList.add('correct');
    if (i === selected && selected !== q.correct) btn.classList.add('wrong');
  });
  finalize(isCorrect, q);
}

function setupIntegerCheck() {
  const { $ } = getCtx();
  const btn = $('btn-check-int');
  if (!btn) return;
  // Remove old listener by cloning
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);
  fresh.addEventListener('click', () => {
    if (qState.answered) return;
    const ctx = getCtx();
    const val = ctx.$('integer-input').value.trim();
    if (!val) return;
    qState.answered = true;
    const q = qState.questions[qState.index];
    const isCorrect = Number(val) === Number(q.answer);
    ctx.$('integer-input').classList.add(isCorrect ? 'correct' : 'wrong');
    const fb = ctx.$('integer-feedback');
    fb.className = 'integer-feedback ' + (isCorrect ? 'correct' : 'wrong');
    fb.textContent = isCorrect ? '✓ Correct!' : `✗ Wrong. Answer: ${q.answer}`;
    finalize(isCorrect, q);
  });
}

function finalize(isCorrect, q) {
  qState.statuses[qState.index] = isCorrect ? 'correct' : 'wrong';
  updateQNav();

  const { $ } = getCtx();
  const sub = (q.subject || qState.subject || 'chemistry').toLowerCase();
  const ch = q.chapter;
  stats.total++;
  if (isCorrect) {
    stats.correct++;
    stats.streak++;
    stats.score += 4;
    $('q-card').classList.add('pop-anim');
    setTimeout(() => $('q-card').classList.remove('pop-anim'), 350);
  } else {
    stats.wrong++;
    stats.streak = 0;
    stats.score = Math.max(0, stats.score - 1);
  }

  if (!stats.subjects[sub]) stats.subjects[sub] = { total:0, correct:0, chapters:{} };
  stats.subjects[sub].total++;
  if (isCorrect) stats.subjects[sub].correct++;
  if (!stats.subjects[sub].chapters[ch]) stats.subjects[sub].chapters[ch] = { total:0, correct:0 };
  stats.subjects[sub].chapters[ch].total++;
  if (isCorrect) stats.subjects[sub].chapters[ch].correct++;

  saveStats(stats);
  document.getElementById('nav-score').textContent = '⚡ ' + stats.score;

  const expBox = $('explanation-box');
  const expText = $('explanation-text');
  if (q.explanation) {
    expText.innerHTML = formatText(q.explanation);
    expBox.classList.add('show');
    renderMath(expBox);
  }
  $('btn-next').disabled = false;
}

// ── PYQ Next / Skip (static buttons in index.html) ────────
document.getElementById('btn-next').addEventListener('click', () => {
  if (qState.index < qState.questions.length - 1) {
    qState.index++;
  } else {
    qState.index = 0;
  }
  qState.answered = false;
  loadQuestion();
  updateQNav();
});

document.getElementById('btn-skip').addEventListener('click', () => {
  if (qState.statuses[qState.index] === 'unseen') {
    qState.statuses[qState.index] = 'skipped';
  }
  updateQNav();
  if (qState.index < qState.questions.length - 1) {
    qState.index++;
  } else {
    qState.index = 0;
  }
  qState.answered = false;
  loadQuestion();
  updateQNav();
});

// Wire up integer check for PYQ screen (static button)
document.getElementById('btn-check-int').addEventListener('click', () => {
  if (qState.answered || qState.mode !== 'pyq') return;
  const val = document.getElementById('integer-input').value.trim();
  if (!val) return;
  qState.answered = true;
  const q = qState.questions[qState.index];
  const isCorrect = Number(val) === Number(q.answer);
  document.getElementById('integer-input').classList.add(isCorrect ? 'correct' : 'wrong');
  const fb = document.getElementById('integer-feedback');
  fb.className = 'integer-feedback ' + (isCorrect ? 'correct' : 'wrong');
  fb.textContent = isCorrect ? '✓ Correct!' : `✗ Wrong. Answer: ${q.answer}`;
  finalize(isCorrect, q);
});

// ═══════════════════════════════════════════════════════
//  Booklet System — file-based
// ═══════════════════════════════════════════════════════

// Cache booklet question data
const _bookletCache = {};

// ── Landing: list all booklets ─────────────────────────────
async function showBookletLanding() {
  const wrap = document.getElementById('booklet-content');
  wrap.innerHTML = `<div class="loading-state">Loading booklets…</div>`;

  const booklets = await fetchJSON('Booklets/manifest.json');

  if (!booklets || booklets.length === 0) {
    wrap.innerHTML = `
      <div class="booklet-landing">
        <div class="booklet-landing-header">
          <h1>📚 Booklets</h1>
          <p>No booklets found. Add <code>Booklets/manifest.json</code> and your booklet folders.</p>
        </div>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="booklet-landing">
      <div class="booklet-landing-header">
        <h1>📚 Booklets</h1>
        <p>Curated question sets designed for deep conceptual mastery</p>
      </div>
      <div class="booklet-grid">
        ${booklets.map(b => `
          <div class="booklet-card chem-hatke" data-booklet-id="${b.id}" data-booklet-folder="${b.folder}" role="button" tabindex="0">
            <div class="booklet-card-icon">${b.icon || '📒'}</div>
            <div class="booklet-card-title">${b.title}</div>
            <div class="booklet-card-desc">${b.description || ''}</div>
            <div class="booklet-card-meta">
              ${(b.tags || []).map(t => `<span class="booklet-tag">${t}</span>`).join('')}
              <span class="booklet-tag live">Live</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  wrap.querySelectorAll('[data-booklet-id]').forEach(card => {
    card.addEventListener('click', () => showBookletSubjects(card.dataset.bookletId, card.dataset.bookletFolder));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') showBookletSubjects(card.dataset.bookletId, card.dataset.bookletFolder); });
  });
}

// ── Subjects inside a booklet ─────────────────────────────
async function showBookletSubjects(bookletId, bookletFolder) {
  bookletNav.bookletId = bookletId;
  bookletNav.bookletFolder = bookletFolder;

  const wrap = document.getElementById('booklet-content');
  wrap.innerHTML = `<div class="loading-state">Loading subjects…</div>`;

  const meta = await fetchJSON(`Booklets/${bookletFolder}/manifest.json`);

  if (!meta || !meta.subjects) {
    wrap.innerHTML = `<div class="empty-state"><h3>Could not load booklet</h3><p>Make sure <code>Booklets/${bookletFolder}/manifest.json</code> exists with a "subjects" key.</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="booklet-subject-wrap">
      <button class="back-btn" id="back-to-booklets">← All Booklets</button>
      <div class="booklet-subject-header">
        <div>
          <h2>${meta.icon || '📒'} ${meta.title || bookletFolder}</h2>
          <div class="booklet-subject-subtitle">Select a subject to explore question sets</div>
        </div>
      </div>
      <div class="booklet-subject-grid">
        ${Object.entries(meta.subjects).map(([key, sub]) => `
          <div class="booklet-subject-card ${key.toLowerCase()}" data-subject="${key}" role="button" tabindex="0"
            style="${sub.comingSoon ? 'opacity:0.6;cursor:default' : ''}">
            <div class="bsc-icon">${sub.icon || '📂'}</div>
            <div class="bsc-name">${sub.label || key}</div>
            <div class="bsc-desc">${sub.desc || ''}</div>
            <div><span class="bsc-badge ${sub.comingSoon ? 'soon' : 'live'}">${sub.comingSoon ? 'Coming Soon' : 'Live'}</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('back-to-booklets').addEventListener('click', showBookletLanding);
  wrap.querySelectorAll('[data-subject]').forEach(card => {
    const key = card.dataset.subject;
    const sub = meta.subjects[key];
    if (!sub.comingSoon) {
      card.addEventListener('click', () => showBookletChapters(bookletId, bookletFolder, key, sub.label || key));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') showBookletChapters(bookletId, bookletFolder, key, sub.label || key); });
    }
  });
}

// ── Chapters inside a subject ─────────────────────────────
async function showBookletChapters(bookletId, bookletFolder, subjectKey, subjectLabel) {
  bookletNav.subjectKey = subjectKey;

  const wrap = document.getElementById('booklet-content');
  wrap.innerHTML = `<div class="loading-state">Loading chapters…</div>`;

  const chapters = await fetchJSON(`Booklets/${bookletFolder}/${subjectKey}/manifest.json`);

  if (!chapters || chapters.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><h3>No chapters found</h3><p>Make sure <code>Booklets/${bookletFolder}/${subjectKey}/manifest.json</code> exists (array of chapter names).</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="booklet-chapter-wrap">
      <button class="back-btn" id="back-to-subjects">← Back</button>
      <div class="booklet-chapter-header">
        <h2>📂 ${subjectLabel}</h2>
      </div>
      <div class="booklet-chapter-grid">
        ${chapters.map(chName => `
          <div class="booklet-chapter-card" data-chapter="${chName}" role="button" tabindex="0">
            <div class="bcc-icon">📋</div>
            <div class="bcc-name">${chName}</div>
            <div class="bcc-desc">Click to start</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('back-to-subjects').addEventListener('click', () => showBookletSubjects(bookletId, bookletFolder));
  wrap.querySelectorAll('[data-chapter]').forEach(card => {
    card.addEventListener('click', () => startBookletChapter(bookletId, bookletFolder, subjectKey, card.dataset.chapter));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') startBookletChapter(bookletId, bookletFolder, subjectKey, card.dataset.chapter); });
  });
}

// ── Start solving a booklet chapter ───────────────────────
async function startBookletChapter(bookletId, bookletFolder, subjectKey, chapterName) {
  bookletNav.chapterName = chapterName;

  const wrap = document.getElementById('booklet-content');
  wrap.innerHTML = `<div class="loading-state">Loading questions…</div>`;

  const cacheKey = `${bookletFolder}/${subjectKey}/${chapterName}`;
  if (!_bookletCache[cacheKey]) {
    const fileName = encodeURIComponent(chapterName) + '.json';
    const data = await fetchJSON(`Booklets/${bookletFolder}/${subjectKey}/${fileName}`);
    if (!data) {
      wrap.innerHTML = `<div class="empty-state"><h3>Could not load questions</h3><p>Make sure <code>Booklets/${bookletFolder}/${subjectKey}/${chapterName}.json</code> exists.</p></div>`;
      return;
    }
    _bookletCache[cacheKey] = data;
  }

  const questions = _bookletCache[cacheKey];

  // Set shared qState to booklet mode
  qState.mode = 'booklet';
  qState.subject = subjectKey.toLowerCase();
  qState.chapter = chapterName;
  qState.questions = questions;
  qState.index = 0;
  qState.answered = false;
  qState.statuses = questions.map(() => 'unseen');

  renderBookletSolver(bookletId, bookletFolder, subjectKey, chapterName, questions);
}

// ── Render the booklet solver UI ──────────────────────────
function renderBookletSolver(bookletId, bookletFolder, subjectKey, chapterName, questions) {
  const wrap = document.getElementById('booklet-content');

  wrap.innerHTML = `
    <div class="pyq-wrap">

      <!-- Left panel -->
      <div>
        <button class="back-btn" id="bk-back-chapters">← Chapters</button>
        <div class="subject-panel">
          <h3>Booklet</h3>
          <div style="color:var(--text);font-weight:600;padding:0.4rem 0">${chapterName}</div>
          <div style="color:var(--muted);font-size:0.8rem;margin-bottom:0.8rem">${subjectKey}</div>
          <div class="booklet-divider"></div>
          <div class="booklet-progress-ring">
            <div class="booklet-progress-stat">
              <div class="booklet-progress-val" id="bk-stat-correct" style="color:var(--green)">0</div>
              <div class="booklet-progress-lbl">Correct</div>
            </div>
            <div style="color:var(--border);font-size:1.2rem">·</div>
            <div class="booklet-progress-stat">
              <div class="booklet-progress-val" id="bk-stat-wrong" style="color:var(--red)">0</div>
              <div class="booklet-progress-lbl">Wrong</div>
            </div>
            <div style="color:var(--border);font-size:1.2rem">·</div>
            <div class="booklet-progress-stat">
              <div class="booklet-progress-val" style="color:var(--accent)">${questions.length}</div>
              <div class="booklet-progress-lbl">Total</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: solver (same structure as PYQ) -->
      <div class="solver-main">
        <div class="q-nav-panel">
          <div class="q-nav-header">
            <h3 id="qnav-title">${chapterName} (${questions.length})</h3>
            <div class="q-nav-legend">
              <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Correct</div>
              <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Wrong</div>
              <div class="legend-item"><div class="legend-dot" style="background:var(--yellow)"></div>Skipped</div>
              <div class="legend-item"><div class="legend-dot" style="background:var(--bg3)"></div>Unseen</div>
            </div>
          </div>
          <div class="q-nav-grid" id="q-nav-grid"></div>
        </div>

        <div class="q-card" id="q-card">
          <div id="empty-state-q" class="empty-state hidden">
            <h3>Select a question</h3>
          </div>
          <div id="q-content">
            <div class="q-meta" id="q-meta"></div>
            <div class="q-text" id="q-text"></div>
            <img id="q-image" class="q-image hidden" />
            <div class="options-grid" id="options-grid"></div>
            <div id="integer-wrap" class="integer-box hidden">
              <label>Enter your numerical answer:</label>
              <div style="display:flex;gap:0.7rem;align-items:center;flex-wrap:wrap">
                <input type="number" step="any" class="integer-input" id="integer-input" />
                <button class="btn btn-check" id="btn-check-int">Check</button>
              </div>
              <div class="integer-feedback" id="integer-feedback"></div>
            </div>
            <div class="explanation-box" id="explanation-box">
              <div class="explanation-label">✦ Solution</div>
              <div class="explanation-text" id="explanation-text"></div>
            </div>
            <div class="q-actions">
              <button class="btn btn-ghost" id="btn-skip">Skip</button>
              <button class="btn btn-primary" id="btn-next" disabled>Next →</button>
              <span class="q-progress" id="q-progress">1 / ${questions.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Back button
  document.getElementById('bk-back-chapters').addEventListener('click', () => {
    qState.mode = 'pyq'; // reset so static PYQ buttons work normally
    showBookletChapters(bookletId, bookletFolder, subjectKey, subjectKey);
  });

  // Next button
  document.getElementById('btn-next').addEventListener('click', () => {
    if (qState.index < qState.questions.length - 1) {
      qState.index++;
    } else {
      qState.index = 0;
    }
    qState.answered = false;
    loadQuestion();
    updateQNav();
    updateBookletStats();
  });

  // Skip button
  document.getElementById('btn-skip').addEventListener('click', () => {
    if (qState.statuses[qState.index] === 'unseen') {
      qState.statuses[qState.index] = 'skipped';
    }
    updateQNav();
    if (qState.index < qState.questions.length - 1) {
      qState.index++;
    } else {
      qState.index = 0;
    }
    qState.answered = false;
    loadQuestion();
    updateQNav();
    updateBookletStats();
  });

  // Integer check button (freshly injected into DOM)
  document.getElementById('btn-check-int').addEventListener('click', () => {
    if (qState.answered) return;
    const bc = document.getElementById('booklet-content');
    const val = bc.querySelector('#integer-input').value.trim();
    if (!val) return;
    qState.answered = true;
    const q = qState.questions[qState.index];
    const isCorrect = Number(val) === Number(q.answer);
    bc.querySelector('#integer-input').classList.add(isCorrect ? 'correct' : 'wrong');
    const fb = bc.querySelector('#integer-feedback');
    fb.className = 'integer-feedback ' + (isCorrect ? 'correct' : 'wrong');
    fb.textContent = isCorrect ? '✓ Correct!' : `✗ Wrong. Answer: ${q.answer}`;
    finalize(isCorrect, q);
    updateBookletStats();
  });

  buildQNav();
  loadQuestion();
  updateBookletStats();
}

function updateBookletStats() {
  const bc = document.getElementById('booklet-content');
  if (!bc) return;
  const cEl = bc.querySelector('#bk-stat-correct');
  const wEl = bc.querySelector('#bk-stat-wrong');
  if (cEl) cEl.textContent = qState.statuses.filter(s => s === 'correct').length;
  if (wEl) wEl.textContent = qState.statuses.filter(s => s === 'wrong').length;
}

// ── Add loading/empty state CSS if missing ─────────────────
(function injectUtilStyles() {
  if (document.getElementById('zd-util-styles')) return;
  const s = document.createElement('style');
  s.id = 'zd-util-styles';
  s.textContent = `
    .loading-state {
      display: flex; align-items: center; justify-content: center;
      min-height: 200px; color: var(--muted); font-size: 0.9rem;
      gap: 0.5rem;
    }
    .loading-state::before {
      content: '';
      display: inline-block; width: 16px; height: 16px;
      border: 2px solid var(--border); border-top-color: var(--accent);
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .booklet-divider { height: 1px; background: var(--border); margin: 0.8rem 0; }
    .booklet-progress-ring {
      display: flex; gap: 0.8rem; align-items: center;
      flex-wrap: wrap; padding: 0.4rem 0;
    }
    .booklet-progress-stat { text-align: center; }
    .booklet-progress-val { font-size: 1.4rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .booklet-progress-lbl { font-size: 0.7rem; color: var(--muted); margin-top: 2px; }
  `;
  document.head.appendChild(s);
})();

// ═══════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════

buildChapterList('physics');
updateDashboard();