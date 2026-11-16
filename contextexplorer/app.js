/* Context Explorer: rendering and context building. Data lives in scenarios.js. */
(function () {
'use strict';
const SC = window.SCENARIOS;
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const fmt = n => Math.round(n).toLocaleString('en-GB');
const approx = t => Math.max(1, Math.ceil(t.length / 4));
const q = new URLSearchParams(location.search);
const FAST = q.has('fast');
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DELAY = FAST ? 0 : (REDUCE ? 150 : 550);

const TYPES = {
  system: 'System prompt', instructions: 'Instruction file', tools: 'Tool definitions', skills: 'Skill list',
  history: 'Conversation history', user: 'User message', call: 'Tool call', result: 'Tool result',
  retrieved: 'Retrieved snippets', skill: 'Loaded skill', subagent: 'Sub-agent summary', compaction: 'Compaction summary'
};

/* ---------------------------------------------------------------- session: builds the context step by step */
class Session {
  constructor(sc) { this.sc = sc; this.reset(); }
  reset() {
    this.n = 0; this.turn = 0; this.prevIds = new Set(); this.lastIds = new Set();
    const sc = this.sc, base = [];
    base.push(this.mk('system', 'System prompt', sc.system));
    if (sc.instructions) base.push(this.mk('instructions', 'Instruction file: ' + sc.instructions.file, sc.instructions.text));
    if (sc.tools) base.push(this.mk('tools', 'Tool definitions',
      JSON.stringify(sc.tools, null, 2) + (sc.toolsNote ? '\n\n// ' + sc.toolsNote : ''),
      sc.toolsTokens ? { tokens: sc.toolsTokens, excerpt: true } : {}));
    if (sc.skills) base.push(this.mk('skills', 'Skill list (names and descriptions only)',
      'Skills available. To use one, read its SKILL.md file under .agents/skills/<name>/.\n\n' + sc.skills.map(s => '- ' + s[0] + ': ' + s[1]).join('\n')));
    this.items = base;
  }
  mk(type, label, text, o) {
    o = o || {};
    return { id: 'b' + (++this.n), type, label, text, tokens: o.tokens || approx(text), excerpt: !!o.excerpt, turn: o.turn || 0, role: o.role || '' };
  }
  show(items) {
    return items.map(it => {
      const c = Object.assign({}, it);
      if (it.role === 'user' && it.turn < this.turn) { c.type = 'history'; c.label = 'Earlier message: you'; }
      if (it.role === 'assistant') { c.type = 'history'; c.label = 'Earlier reply: assistant'; }
      return c;
    });
  }
  view(label, items, win, flag) {
    const blocks = this.show(items);
    const has = flag && this.turn > 1;
    blocks.forEach(b => { b.isNew = has && !this.prevIds.has(b.id); });
    return { label, blocks, total: blocks.reduce((s, b) => s + b.tokens, 0), window: win || this.sc.window };
  }
  req(title, lesson, items) {
    const v = this.view('', items || this.items, null, true);
    return { title, lesson, views: [v] };
  }
  initialReq() {
    return { title: 'Before your first message', lesson: 'Nothing has been typed yet, but the model already holds these parts. They are sent again with every request.',
      views: [this.view('', this.items, null, false)] };
  }
  runTurn(chosen) {
    const sc = this.sc, t = sc.turns[this.turn], steps = [];
    this.turn++;
    this.prevIds = this.lastIds;
    const turn = this.turn;
    this.items.push(this.mk('user', 'User message', chosen, { turn, role: 'user' }));
    let lastReq = null;
    for (const ev of t.events) {
      if (ev.k === 'think') { steps.push({ k: 'think', ev }); continue; }
      if (ev.k === 'tool') {
        const req = this.req('Sent to the model to choose this tool call (turn ' + turn + ')', t.lesson);
        lastReq = req;
        steps.push({ k: 'tool', ev, req });
        this.items.push(this.mk('call', 'Tool call: ' + ev.name, JSON.stringify({ name: ev.name, arguments: ev.args }, null, 2), { turn }));
        this.items.push(this.mk(ev.type || 'result', (ev.type === 'skill' ? 'Loaded skill: ' : ev.type === 'retrieved' ? 'Retrieved snippets: ' : 'Tool result: ') + ev.name,
          ev.result, { turn, tokens: ev.resultTokens, excerpt: !!ev.excerpt }));
        continue;
      }
      if (ev.k === 'sub') {
        this.items.push(this.mk('call', 'Tool call: spawn_subagent', JSON.stringify({ name: 'spawn_subagent', arguments: { name: ev.name, task: ev.task } }, null, 2), { turn }));
        this.items.push(this.mk('subagent', 'Sub-agent summary: ' + ev.name, ev.summary, { turn }));
        const main = this.view('Main agent', this.items, null, true);
        const sb = ev.sub.blocks.map((b, i) => ({ id: 's' + i, type: b.type, label: b.label, text: b.text, tokens: b.tokens || approx(b.text), excerpt: !!b.excerpt, turn: (b.type === 'system' || b.type === 'tools') ? 0 : 1, isNew: false }));
        const sub = { label: 'Sub-agent', blocks: sb, total: sb.reduce((s, b) => s + b.tokens, 0), window: sc.window, seps: { 0: 'Fresh context', 1: 'The task and its work' } };
        const req = { title: 'Main agent (what it receives next) and the sub-agent (its own context)', lesson: t.lesson, views: [main, sub] };
        lastReq = req;
        steps.push({ k: 'sub', ev, req, mainTotal: main.total, subTotal: sub.total });
        continue;
      }
      if (ev.k === 'compact') {
        const before = this.view('Before compaction', this.items, null, true);
        const keep = this.items.filter(i => i.turn === 0);
        const user = this.mk('user', 'User message', chosen, { turn, role: 'user' });
        const comp = this.mk('compaction', 'Compaction summary', ev.text, { turn, tokens: ev.tokens, excerpt: true });
        this.items = keep.concat([comp, user]);
        const after = this.view('After compaction', this.items, null, true);
        const req = { title: 'Sent to the model before and after compaction', lesson: t.lesson, views: [before, after] };
        lastReq = req;
        steps.push({ k: 'compact', ev, req, before: before.total, after: after.total });
        continue;
      }
      if (ev.k === 'answer') {
        const req = this.req('Sent to the model to write this reply (turn ' + turn + ')', t.lesson);
        lastReq = req;
        steps.push({ k: 'answer', ev, req });
        const txt = [ev.text, ev.quote, ev.after].filter(Boolean).join('\n\n');
        this.items.push(this.mk('assistant', 'Reply', txt, { turn, role: 'assistant' }));
      }
    }
    this.lastIds = new Set(lastReq.views[lastReq.views.length === 2 && lastReq.views[0].label === 'Before compaction' ? 1 : 0].blocks.map(b => b.id));
    if (lastReq.views[0].label === 'Main agent') this.lastIds = new Set(lastReq.views[0].blocks.map(b => b.id));
    return steps;
  }
}

/* ---------------------------------------------------------------- context panel */
const ctxEl = $('#ctx'), ctxBody = $('#ctxBody'), cw = $('#cw'), backdrop = $('#backdrop');
const ctxHooks = { opened() {}, closed() {} };
let ctxOpener = null, ctxReq = null, ctxView = 0, zoom = null;

function openCtx(req, opener, view) {
  ctxReq = req; ctxView = view || 0; ctxOpener = opener || null;
  cw.classList.add('has-ctx'); ctxEl.hidden = false; backdrop.hidden = false;
  drawCtx();
  ctxBody.scrollTop = 0;
  $('#ctxClose').focus({ preventScroll: true });
  ctxHooks.opened();
}
function closeCtx() {
  ctxEl.hidden = true; backdrop.hidden = true; cw.classList.remove('has-ctx');
  if (ctxOpener && document.contains(ctxOpener)) ctxOpener.focus({ preventScroll: true });
  ctxHooks.closed();
}
$('#ctxClose').onclick = closeCtx;
backdrop.onclick = closeCtx;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ctxEl.hidden) closeCtx(); });

function followCtx(req) {
  if (ctxEl.hidden) return;
  const keep = ctxBody.scrollTop;
  ctxReq = req; if (ctxView >= req.views.length) ctxView = 0;
  drawCtx();
  const nb = ctxBody.querySelectorAll('.blk.new');
  if (nb.length) { const l = nb[nb.length - 1]; ctxBody.scrollTop = Math.max(0, l.offsetTop - ctxBody.clientHeight + l.offsetHeight + 24); }
  else ctxBody.scrollTop = keep;
}
function drawCtx() {
  const req = ctxReq, v = req.views[ctxView];
  $('#ctxSub').textContent = req.title;
  const pct = v.total / v.window * 100;
  const zm = zoom === null ? pct < 10 : zoom;
  const denom = zm ? Math.max(v.total, 1) : v.window;
  const byType = {};
  v.blocks.forEach(b => { byType[b.type] = (byType[b.type] || 0) + b.tokens; });
  const legend = Object.keys(byType).sort((a, b) => byType[b] - byType[a])
    .map(t => `<li><span class="sw" style="--c:var(--t-${t})"></span>${TYPES[t]} <b>${fmt(byType[t])}</b> <span style="color:var(--muted)">${Math.round(byType[t] / v.total * 100)}%</span></li>`).join('');
  const segs = v.blocks.map(b => `<i style="width:${b.tokens / denom * 100}%;background:var(--t-${b.type})" title="${esc(b.label)}: ${fmt(b.tokens)} tokens"></i>`).join('');
  let h = '';
  if (req.views.length > 1) {
    h += '<div class="tabs" role="group" aria-label="Context to show">' + req.views.map((x, i) => `<button type="button" class="tab${i === ctxView ? ' on' : ''}" aria-pressed="${i === ctxView}" data-v="${i}">${esc(x.label)} · ${fmt(x.total)}</button>`).join('') + '</div>';
  }
  if (req.lesson) h += `<p class="lesson">${esc(req.lesson)}</p>`;
  h += `<div class="meter"><div class="tot"><b>${fmt(v.total)} tokens</b><span>of a ${fmt(v.window)}-token window (${pct < 1 ? '<1' : pct.toFixed(pct < 10 ? 1 : 0)}%)</span>${pct >= 80 ? '<span class="warn">Near the limit</span>' : ''}</div>`
    + `<div class="mbar" role="img" aria-label="Context used: ${fmt(v.total)} of ${fmt(v.window)} tokens">${segs}</div>`
    + `<div class="scale"><span>0</span><span>${fmt(denom)}</span></div>`
    + `<label class="zoom"><input type="checkbox" id="zoom"${zm ? ' checked' : ''}> Zoom the bar to the part in use (otherwise it spans the whole window)</label>`
    + `<ul class="legend">${legend}</ul></div>`;
  h += '<div class="bl-tools"><button type="button" class="mini" id="exp">Expand all</button><button type="button" class="mini" id="col">Collapse all</button></div>';
  let last = null;
  h += v.blocks.map(b => {
    let sep = '';
    if (b.turn !== last) {
      const names = v.seps || {};
      sep = `<h3 class="turnsep">${esc(names[b.turn] || (b.turn === 0 ? 'Set up before the chat starts' : 'Turn ' + b.turn))}</h3>`;
      last = b.turn;
    }
    const first = b.text.replace(/\s+/g, ' ').trim().slice(0, 100);
    return sep + `<details class="blk${b.isNew ? ' new' : ''}" style="--c:var(--t-${b.type})"><summary><span class="bl">${esc(b.label)}${b.isNew ? '<span class="nw">New</span>' : ''}</span><span class="tk">${fmt(b.tokens)} tokens</span><span class="pv">${esc(first)}</span></summary><pre>${esc(b.text)}</pre>${b.excerpt ? `<div class="ex">Display shortened. The real block is about ${fmt(b.tokens)} tokens.</div>` : ''}</details>`;
  }).join('');
  ctxBody.innerHTML = h;
  ctxBody.querySelectorAll('.tab').forEach(b => b.onclick = () => { ctxView = +b.dataset.v; drawCtx(); const t = ctxBody.querySelector('.tab.on'); t && t.focus({ preventScroll: true }); });
  $('#zoom').onchange = e => { zoom = e.target.checked; drawCtx(); $('#zoom').focus({ preventScroll: true }); };
  $('#exp').onclick = () => ctxBody.querySelectorAll('.blk').forEach(d => d.open = true);
  $('#col').onclick = () => ctxBody.querySelectorAll('.blk').forEach(d => d.open = false);
}


/* ---------------------------------------------------------------- icons (sprite in index.html) */
const ic = (id, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const SCIC = { chat: 'chat', web: 'globe', files: 'folder', data: 'chart', skills: 'workflow', long: 'compress' };
const scIcon = sc => ic(SCIC[sc.id] || 'chat');
const motionOk = () => !(REDUCE || FAST);

/* ---------------------------------------------------------------- thread rows */
function ctxButton(req, label) {
  const b = el(`<button type="button" class="mini">${label || 'Show context'}</button>`);
  b.onclick = () => openCtx(req, b);
  return b;
}
function textBlocks(text) {
  const out = [];
  text.split(/\n\n+/).forEach(par => {
    const lines = par.split('\n');
    if (lines.every(l => l.startsWith('- '))) out.push('<ul>' + lines.map(l => '<li>' + esc(l.slice(2)) + '</li>').join('') + '</ul>');
    else out.push('<p>' + lines.map(esc).join('<br>') + '</p>');
  });
  return out.join('');
}
function argsHtml(ev) {
  if (ev.args && typeof ev.args.code === 'string') return `<div class="args"><b>${esc(ev.name)}</b>\n${esc(ev.args.code)}</div>`;
  return `<div class="args"><b>${esc(ev.name)}</b> ${esc(JSON.stringify(ev.args, null, 2))}</div>`;
}
/* o: { newest, series, animate } */
function rowFor(step, o) {
  const ev = step.ev, fresh = o.newest ? ' fresh' : '';
  if (step.k === 'think') return el(`<details class="t d think${fresh}"${o.newest ? ' open' : ''}><summary>${ic('think')}Thought for ${ev.secs || 3} s</summary><div class="body">${esc(ev.text)}</div></details>`);
  if (step.k === 'tool') {
    const kind = ev.kind === 'search' ? 'search' : 'tool';
    const wrap = el(`<div class="t${fresh}" style="position:relative"></div>`);
    const det = el(`<details class="d ${kind}"${o.newest ? ' open' : ''}><summary>${ic(kind === 'search' ? 'search' : 'wrench')}${esc(ev.title)}</summary>`
      + `<div class="body">${(ev.chips && ev.chips.length) ? '<div class="srcs" style="margin-left:0">' + ev.chips.map(c => `<span class="src">${esc(c)}</span>`).join('') + '</div>' : ''}${argsHtml(ev)}<div class="res"><span class="rh">✓ ${ev.type === 'retrieved' ? 'Retrieved snippets' : 'Tool results'}</span>${esc(ev.result)}</div></div></details>`);
    const b = ctxButton(step.req, 'Show context for this step'); b.classList.add('rowctx');
    wrap.append(det, b);
    return wrap;
  }
  if (step.k === 'sub') {
    const n = el(`<div class="t subrow${fresh}"><b>Sub-agent: ${esc(ev.name)}</b> <span class="tk">worked in its own context and returned a summary</span>`
      + `<div style="margin-top:4px"><em>Task:</em> ${esc(ev.task)}</div><ul>${ev.steps.map(s => '<li>' + esc(s) + '</li>').join('')}</ul>`
      + `<div class="res"><span class="rh">✓ Summary returned to the main agent</span>${esc(ev.summary)}</div>`
      + `<div class="tk" style="margin-top:6px">Sub-agent context: ${fmt(step.subTotal)} tokens. Main context: ${fmt(step.mainTotal)} tokens.</div></div>`);
    n.appendChild(ctxButton(step.req, 'Compare the two contexts'));
    return n;
  }
  if (step.k === 'compact') {
    const n = el(`<div class="t harness${fresh}"><b>Context compacted by the harness.</b> ${esc(ev.note)} The model summarised the older turns. The context went from ${fmt(step.before)} to ${fmt(step.after)} tokens.</div>`);
    n.appendChild(ctxButton(step.req, 'Show before and after'));
    return n;
  }
  const n = el(`<div class="t b${fresh}"><div class="av" aria-hidden="true">${ic('sparkle')}</div><div class="txt">${textBlocks(ev.text)}${ev.quote ? `<div class="quote">${esc(ev.quote)}</div>` : ''}${ev.after ? textBlocks(ev.after) : ''}<div class="slot"></div><div class="acts"></div></div></div>`);
  if (ev.widget) n.querySelector('.slot').appendChild(chartWidget(ev.widget, o.series || 0, o.animate));
  n.querySelector('.acts').appendChild(ctxButton(step.req));
  return n;
}

function chartWidget(w, start, animate) {
  const root = el(`<div class="embed"><div class="ch-h">${esc(w.title)}</div><div class="ch-n">${esc(w.note)}</div><div class="tabs">${w.series.map((s, i) => `<button type="button" class="tab${i === start ? ' on' : ''}" data-i="${i}">${esc(s.name)}</button>`).join('')}</div><div class="rows"></div></div>`);
  const rows = root.querySelector('.rows');
  const label = (s, v) => s.unit === '%' ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '%' : '£' + v + 'k';
  function draw(i, anim) {
    const s = w.series[i], vals = s.data.map(d => d[1]);
    const min = Math.min(0, ...vals), max = Math.max(0, ...vals), range = max - min || 1, z = -min / range * 100, top = Math.max(...vals);
    rows.innerHTML = s.data.map(d => `<div class="brow"><span>${esc(d[0])}</span><div class="btrack"><span class="zero" style="left:${z}%"></span><div class="bar" style="left:${z}%;width:0;background:${d[1] < 0 ? 'var(--muted)' : d[1] === top ? 'var(--c2)' : 'var(--c1)'}"></div></div><span class="num">${label(s, d[1])}</span></div>`).join('');
    const bars = rows.querySelectorAll('.bar');
    const set = () => s.data.forEach((d, k) => { const wd = Math.abs(d[1]) / range * 100; bars[k].style.left = (d[1] >= 0 ? z : z - wd) + '%'; bars[k].style.width = wd + '%'; });
    if (anim && motionOk()) setTimeout(set, 30); else { bars.forEach(b => b.style.transition = 'none'); set(); }
    rows.setAttribute('role', 'img');
    rows.setAttribute('aria-label', s.name + ': ' + s.data.map(d => d[0] + ' ' + label(s, d[1])).join(', '));
  }
  root.querySelectorAll('.tab').forEach(b => b.onclick = () => { root.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b)); draw(+b.dataset.i, true); });
  draw(start, animate);
  return root;
}

/* ---------------------------------------------------------------- step plan: one entry per DOM unit in reading order */
const nWords = s => (String(s || '').trim().match(/\S+/g) || []).length;
function planOf(sc) {
  const plan = [];
  sc.turns.forEach((t, ti) => {
    plan.push({ k: 'user', turn: ti, label: 'Turn ' + (ti + 1) + ': your message', words: nWords(t.choices[0]) });
    t.events.forEach((ev, ei) => {
      const base = { k: ev.k, turn: ti, ei };
      if (ev.k === 'think') plan.push({ ...base, label: 'Thought', words: nWords(ev.text) });
      else if (ev.k === 'tool') plan.push({ ...base, label: ev.title, words: nWords(ev.result) + nWords(JSON.stringify(ev.args)) });
      else if (ev.k === 'sub') plan.push({ ...base, label: 'Sub-agent: ' + ev.name, words: nWords(ev.summary) + nWords(ev.task) });
      else if (ev.k === 'compact') plan.push({ ...base, label: 'Context compacted', words: nWords(ev.note) + 20 });
      else {
        plan.push({ ...base, label: 'Answer', words: nWords(ev.text) + nWords(ev.quote) });
        if (ev.widget && ev.widget.series.length > 1) ev.widget.series.forEach((s, si) => { if (si) plan.push({ k: 'widget', turn: ti, ei, series: si, label: 'Chart view: ' + s.name, words: 8 }); });
      }
    });
  });
  return plan;
}

/* ---------------------------------------------------------------- chat player: one showStep, one timer per chat */
const thread = $('#thread'), chipbox = $('#chipbox'), dotsEl = $('#dots');
let chat = null, cur = 0;

function newChat(sc, speed) {
  return { sc, plan: planOf(sc), n: 0, playing: false, speed: speed || 'slow', timer: null, streaming: false, chosen: {}, latest: null };
}
function clearTimer(c) { if (c.timer) { clearTimeout(c.timer); c.timer = null; } c.streaming = false; }
function holdMs(c, n) {
  if (FAST) return 15;
  let s = Math.min(9, 2.5 + 0.25 * c.plan[n].words / 10);
  if (c.speed === 'normal') s *= 0.6;
  return s * 1000;
}
function scrollDown() { thread.scrollTop = thread.scrollHeight; }

function schedule(c) {
  if (!c.playing) return;
  if (c.n >= c.plan.length - 1) { c.playing = false; updateControls(c); return; }
  c.timer = setTimeout(() => { c.timer = null; showStep(c, c.n + 1, { stream: true }); }, holdMs(c, c.n));
}
function streamRow(c, row, done) {
  const txt = row.querySelector('.txt'), items = [], seq = [];
  const walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT);
  let nd;
  while ((nd = walker.nextNode())) {
    if (nd.parentElement.closest('.slot,.acts')) continue;
    const it = { nd };
    nd.data.split(/(\s+)/).forEach(p => seq.push([it, p]));
    items.push(it); nd.data = '';
  }
  const per = 1000 / (c.speed === 'normal' ? 20 : 12);
  let k = 0;
  row.classList.add('streaming'); c.streaming = true;
  const tick = () => {
    let w = 0;
    while (k < seq.length && w < 1) { const [it, p] = seq[k++]; it.nd.data += p; if (p.trim()) w++; }
    scrollDown();
    if (k >= seq.length) { c.streaming = false; c.timer = null; row.classList.remove('streaming'); done(); }
    else c.timer = setTimeout(tick, per);
  };
  tick();
}

function showStep(c, n, o) {
  o = o || {};
  clearTimer(c);
  const plan = c.plan, sc = c.sc;
  n = Math.max(0, Math.min(plan.length - 1, n)); c.n = n;
  const ws = {};
  for (let i = 0; i <= n; i++) if (plan[i].k === 'widget') ws[plan[i].turn + ':' + plan[i].ei] = plan[i].series;
  const session = new Session(sc);
  let latest = session.initialReq(), steps = null, newestRow = null, newestStep = null;
  thread.textContent = '';
  for (let i = 0; i <= n; i++) {
    const p = plan[i], newest = i === n;
    if (p.k === 'user') {
      const txt = c.chosen[p.turn] || sc.turns[p.turn].choices[0];
      steps = session.runTurn(txt);
      const r = el(`<div class="t u${newest ? ' fresh' : ''}"></div>`); r.textContent = txt;
      thread.appendChild(r); if (newest) newestRow = r;
      continue;
    }
    if (p.k === 'widget') continue;
    const step = steps[p.ei];
    if (step.req) latest = step.req;
    const key = p.turn + ':' + p.ei, wn = plan[n];
    const animate = newest || (wn.k === 'widget' && wn.turn === p.turn && wn.ei === p.ei);
    const r = rowFor(step, { newest, series: ws[key] || 0, animate });
    thread.appendChild(r);
    if (newest) { newestRow = r; newestStep = p; }
  }
  c.latest = latest;
  followCtx(latest);
  updateControls(c);
  drawChips(c);
  scrollDown();
  const canStream = o.stream && newestStep && newestStep.k === 'answer' && motionOk();
  if (canStream) streamRow(c, newestRow, () => {
    if (!c.playing) return;
    c.timer = setTimeout(() => { c.timer = null; if (c.playing) { if (c.n >= c.plan.length - 1) { c.playing = false; updateControls(c); } else showStep(c, c.n + 1, { stream: true }); } }, c.speed === 'normal' ? 1500 : 2500);
  });
  else schedule(c);
}
/* controls */
const bBack = $('#bBack'), bNext = $('#bNext'), bPlay = $('#bPlay'), bLabel = $('#bLabel');
function drawDots(c) {
  dotsEl.textContent = '';
  c.plan.forEach((p, i) => {
    const b = el(`<button type="button" class="dot${p.k === 'user' ? ' user' : ''}" aria-label="Step ${i + 1}: ${esc(p.label)}"></button>`);
    b.onclick = () => { stop(c); showStep(c, i, {}); };
    dotsEl.appendChild(b);
  });
}
function updateControls(c) {
  const N = c.plan.length, p = c.plan[c.n], atEnd = c.n >= N - 1;
  bLabel.textContent = '';
  bLabel.append(el(`<b>Step ${c.n + 1} of ${N}</b>`), document.createTextNode(' · ' + p.label));
  $('#cLabel').textContent = 'Step ' + (c.n + 1) + ' of ' + N + ' · ' + p.label;
  bBack.disabled = c.n === 0; bNext.disabled = atEnd;
  $('#cBack').disabled = bBack.disabled; $('#cNext').disabled = bNext.disabled;
  const lab = c.playing ? 'Pause' : (atEnd ? 'Play again' : 'Play');
  bPlay.innerHTML = ic(c.playing ? 'pause' : 'play') + '<span>' + lab + '</span>';
  bPlay.setAttribute('aria-label', lab); bPlay.setAttribute('aria-pressed', String(c.playing));
  dotsEl.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('cur', i === c.n); d.classList.toggle('done', i < c.n);
    if (i === c.n) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
  });
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sp === c.speed)));
  $('#bEx').hidden = !atEnd;
}
function drawChips(c) {
  const p = c.plan[c.n];
  chipbox.textContent = '';
  if (p.k !== 'user') { chipbox.hidden = true; return; }
  const t = c.sc.turns[p.turn], shown = c.chosen[p.turn] || t.choices[0];
  chipbox.hidden = false;
  chipbox.appendChild(el('<p class="lab">Your message above is a suggestion. Pick another wording to send it, or press Next. The reply is scripted, so any of them gets the same answer.</p>'));
  const box = el('<div class="chips"></div>');
  t.choices.forEach(txt => {
    const b = el(`<button type="button" class="chip" aria-pressed="${txt === shown}"></button>`); b.textContent = txt;
    b.onclick = () => { c.playing = false; c.chosen[p.turn] = txt; showStep(c, c.n + 1, { stream: true }); };
    box.appendChild(b);
  });
  chipbox.appendChild(box);
}
function stop(c) { c.playing = false; clearTimer(c); }
function pause(c) {
  if (!c.playing && !c.streaming) return;
  const was = c.streaming;
  c.playing = false; clearTimer(c);
  if (was) showStep(c, c.n, {}); else updateControls(c);
}
function play(c) {
  if (c.playing) { pause(c); return; }
  if (c.n >= c.plan.length - 1) { c.playing = true; showStep(c, 0, { stream: true }); return; }
  c.playing = true; updateControls(c);
  schedule(c);
}
const goNext = c => { stop(c); showStep(c, c.n + 1, { stream: true }); };
const goBack = c => { stop(c); showStep(c, c.n - 1, {}); };

bBack.onclick = () => goBack(chat);
bNext.onclick = () => goNext(chat);
$('#cBack').onclick = () => goBack(chat);
$('#cNext').onclick = () => goNext(chat);
bPlay.onclick = () => play(chat);
$('#bReplay').onclick = () => { stop(chat); chat.chosen = {}; chat.playing = true; showStep(chat, 0, { stream: true }); };
$('#bAll').onclick = () => { stop(chat); showStep(chat, chat.plan.length - 1, {}); };
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { chat.speed = b.dataset.sp; updateControls(chat); if (chat.playing && !chat.streaming) { clearTimer(chat); schedule(chat); } });
{
  const ex = el('<button type="button" class="cbtn" id="bEx" hidden><span>Next example</span></button>');
  ex.insertAdjacentHTML('beforeend', ic('right'));
  ex.onclick = () => select((cur + 1) % SC.length, { last: false });
  $('#bAll').after(ex);
}
$('#bar').addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(chat); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(chat); }
  else if (e.key === ' ' && (e.target === $('#bar') || e.target === bPlay || e.target.classList.contains('dot'))) { e.preventDefault(); play(chat); }
});
thread.addEventListener('click', () => pause(chat));

/* ---------------------------------------------------------------- scenario navigation */
function stepCount(sc) { return planOf(sc).length; }
function drawRecent() {
  const box = $('#recent'); box.textContent = '';
  SC.forEach((s, i) => {
    const b = el(`<button type="button" class="cw-ri${i === cur ? ' cur' : ''}"${i === cur ? ' aria-current="true"' : ''}>${scIcon(s)}<span>${esc(s.title)}</span></button>`);
    b.onclick = () => select(i, { last: true });
    box.appendChild(b);
  });
  const st = $('#strip'); st.textContent = '';
  SC.forEach((s, i) => {
    const b = el(`<button type="button" class="sp"${i === cur ? ' aria-current="true"' : ''}>${scIcon(s)}<span>${esc(s.title)}</span></button>`);
    b.onclick = () => select(i, { last: true, scroll: true });
    st.appendChild(b);
    if (i === cur) requestAnimationFrame(() => { const l = b.offsetLeft - (st.clientWidth - b.offsetWidth) / 2; st.scrollLeft = Math.max(0, l); });
  });
  document.querySelectorAll('.pk').forEach((b, i) => { b.classList.toggle('cur', i === cur); if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
}
function drawPicker() {
  const p = $('#picker');
  SC.forEach((s, i) => {
    const b = el(`<button type="button" class="pk" role="listitem"><span class="pk-ic">${scIcon(s)}</span><span class="n">Example ${i + 1}</span><b>${esc(s.title)}</b><span class="d">${esc(s.short)}</span><span class="tn">${s.turns.length} turns · ${stepCount(s)} steps</span></button>`);
    b.onclick = () => select(i, { last: true, scroll: true });
    p.appendChild(b);
  });
}
function scrollApp() { $('#app').scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'start' }); }
function select(i, o) {
  o = o || {};
  if (chat) stop(chat);
  cur = i;
  const sc = SC[i];
  chat = newChat(sc, chat && chat.speed);
  history.replaceState(null, '', '#' + sc.id);
  $('#ttl').textContent = sc.title;
  $('#ttlIc').innerHTML = scIcon(sc);
  drawRecent(); drawDots(chat);
  showStep(chat, o.last ? chat.plan.length - 1 : 0, {});
  if (o.scroll) scrollApp();
}

ctxHooks.opened = () => { $('#ctxTop span').textContent = 'Hide context'; };
ctxHooks.closed = () => { $('#ctxTop span').textContent = 'Show context'; };
$('#ctxTop').onclick = () => { if (ctxEl.hidden) openCtx(chat.latest, $('#ctxTop')); else closeCtx(); };

/* ---------------------------------------------------------------- site header: menu, theme, section highlight */
const nav = $('#siteNav'), menuBtn = $('#menuBtn');
function setMenu(open) {
  nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-menu');
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
}
menuBtn.onclick = () => setMenu(!nav.classList.contains('open'));
nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
document.addEventListener('click', e => { if (nav.classList.contains('open') && !e.target.closest('.site')) setMenu(false); });

const THEMES = ['', 'light', 'dark'], themeBtn = $('#themeBtn');
let theme = '';
try { theme = localStorage.getItem('ce-theme') || ''; } catch (e) {}
if (!THEMES.includes(theme)) theme = '';
function applyTheme() {
  const root = document.documentElement;
  if (theme) root.setAttribute('data-theme', theme); else root.removeAttribute('data-theme');
  themeBtn.querySelector('use').setAttribute('href', '#i-' + (theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor'));
  themeBtn.setAttribute('aria-label', 'Colour theme: ' + (theme || 'follows the system') + '. Press to change.');
}
themeBtn.onclick = () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % 3];
  try { theme ? localStorage.setItem('ce-theme', theme) : localStorage.removeItem('ce-theme'); } catch (e) {}
  applyTheme();
};
applyTheme();

const secs = ['scenarios', 'how', 'about'].map(id => document.getElementById(id)), navLinks = [...nav.querySelectorAll('a')];
let spyQueued = false;
function spy() {
  spyQueued = false;
  let on = null;
  secs.forEach(s => { if (s.getBoundingClientRect().top <= 140) on = s.id; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) on = 'about';
  navLinks.forEach(a => { if (a.dataset.sec === on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
}
addEventListener('scroll', () => { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); } }, { passive: true });
addEventListener('resize', spy);

/* ---------------------------------------------------------------- start */
drawPicker();
const hash = location.hash.slice(1), hi = SC.findIndex(s => s.id === hash);
select(hi >= 0 ? hi : 0, { last: hi >= 0 });
if (hi >= 0) requestAnimationFrame(() => $('#app').scrollIntoView({ behavior: 'instant', block: 'start' }));
spy();
})();
