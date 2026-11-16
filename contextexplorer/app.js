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
const IC = {
  think: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  tool: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/></svg>'
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
let ctxOpener = null, ctxReq = null, ctxView = 0, zoom = null;

function openCtx(req, opener, view) {
  ctxReq = req; ctxView = view || 0; ctxOpener = opener || null;
  cw.classList.add('has-ctx'); ctxEl.hidden = false; backdrop.hidden = false;
  drawCtx();
  ctxBody.scrollTop = 0;
  $('#ctxClose').focus({ preventScroll: true });
}
function closeCtx() {
  ctxEl.hidden = true; backdrop.hidden = true; cw.classList.remove('has-ctx');
  if (ctxOpener && document.contains(ctxOpener)) ctxOpener.focus({ preventScroll: true });
}
$('#ctxClose').onclick = closeCtx;
backdrop.onclick = closeCtx;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ctxEl.hidden) closeCtx(); });

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

/* ---------------------------------------------------------------- thread rows */
function ctxButton(req, label) {
  const b = el(`<button type="button" class="mini">${label || 'Show context'}</button>`);
  b.onclick = () => openCtx(req, b);
  return b;
}
function textBlocks(text) {
  const out = []; let list = null;
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
function rowFor(step) {
  const ev = step.ev;
  if (step.k === 'think') return el(`<details class="t d think" open><summary>${IC.think}Thought for ${ev.secs || 3} s</summary><div class="body">${esc(ev.text)}</div></details>`);
  if (step.k === 'tool') {
    const wrap = el(`<div class="t d ${ev.kind === 'search' ? 'search' : 'tool'}" style="display:block"></div>`);
    const det = el(`<details class="d ${ev.kind === 'search' ? 'search' : 'tool'}"><summary>${IC[ev.kind === 'search' ? 'search' : 'tool']}${esc(ev.title)}</summary>`
      + `<div class="body">${(ev.chips && ev.chips.length) ? '<div class="srcs" style="margin-left:0">' + ev.chips.map(c => `<span class="src">${esc(c)}</span>`).join('') + '</div>' : ''}${argsHtml(ev)}<div class="res"><span class="rh">✓ ${ev.type === 'retrieved' ? 'Retrieved snippets' : 'Tool results'}</span>${esc(ev.result)}</div></div></details>`);
    wrap.className = 't'; wrap.style.cssText = 'position:relative';
    const b = ctxButton(step.req, 'Show context for this step'); b.classList.add('rowctx');
    wrap.append(det, b);
    return wrap;
  }
  if (step.k === 'sub') {
    const n = el(`<div class="t subrow"><b>Sub-agent: ${esc(ev.name)}</b> <span class="tk">worked in its own context and returned a summary</span>`
      + `<div style="margin-top:4px"><em>Task:</em> ${esc(ev.task)}</div><ul>${ev.steps.map(s => '<li>' + esc(s) + '</li>').join('')}</ul>`
      + `<div class="res"><span class="rh">✓ Summary returned to the main agent</span>${esc(ev.summary)}</div>`
      + `<div class="tk" style="margin-top:6px">Sub-agent context: ${fmt(step.subTotal)} tokens. Main context: ${fmt(step.mainTotal)} tokens.</div></div>`);
    n.appendChild(ctxButton(step.req, 'Compare the two contexts'));
    return n;
  }
  if (step.k === 'compact') {
    const n = el(`<div class="t harness"><b>Context compacted by the harness.</b> ${esc(ev.note)} The model summarised the older turns. The context went from ${fmt(step.before)} to ${fmt(step.after)} tokens.</div>`);
    n.appendChild(ctxButton(step.req, 'Show before and after'));
    return n;
  }
  /* answer */
  const n = el(`<div class="t b"><div class="av" aria-hidden="true">✦</div><div class="txt">${textBlocks(ev.text)}${ev.quote ? `<div class="quote">${esc(ev.quote)}</div>` : ''}${ev.after ? textBlocks(ev.after) : ''}<div class="slot"></div><div class="acts"></div></div></div>`);
  if (ev.widget) n.querySelector('.slot').appendChild(chartWidget(ev.widget));
  n.querySelector('.acts').appendChild(ctxButton(step.req));
  return n;
}

function chartWidget(w) {
  const root = el(`<div class="embed"><div class="ch-h">${esc(w.title)}</div><div class="ch-n">${esc(w.note)}</div><div class="tabs">${w.series.map((s, i) => `<button type="button" class="tab${i ? '' : ' on'}" data-i="${i}">${esc(s.name)}</button>`).join('')}</div><div class="rows"></div></div>`);
  const rows = root.querySelector('.rows');
  const label = (s, v) => s.unit === '%' ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '%' : '£' + v + 'k';
  function draw(i, first) {
    const s = w.series[i], vals = s.data.map(d => d[1]);
    const min = Math.min(0, ...vals), max = Math.max(0, ...vals), range = max - min || 1, z = -min / range * 100, top = Math.max(...vals);
    rows.innerHTML = s.data.map(d => `<div class="brow"><span>${esc(d[0])}</span><div class="btrack"><span class="zero" style="left:${z}%"></span><div class="bar" style="left:${z}%;width:0;background:${d[1] < 0 ? 'var(--muted)' : d[1] === top ? 'var(--c2)' : 'var(--c1)'}"></div></div><span class="num">${label(s, d[1])}</span></div>`).join('');
    const bars = rows.querySelectorAll('.bar');
    setTimeout(() => s.data.forEach((d, k) => { const wd = Math.abs(d[1]) / range * 100; bars[k].style.left = (d[1] >= 0 ? z : z - wd) + '%'; bars[k].style.width = wd + '%'; }), 30);
    rows.setAttribute('role', 'img');
    rows.setAttribute('aria-label', s.name + ': ' + s.data.map(d => d[0] + ' ' + label(s, d[1])).join(', '));
  }
  root.querySelectorAll('.tab').forEach(b => b.onclick = () => { root.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b)); draw(+b.dataset.i); });
  draw(0, true);
  return root;
}

/* ---------------------------------------------------------------- player */
const thread = $('#thread'), foot = $('#foot');
let cur = 0, session = null, gen = 0, busy = false, latest = null;

function drawRecent() {
  $('#recent').innerHTML = '';
  SC.forEach((s, i) => {
    const b = el(`<button type="button" class="cw-ri${i === cur ? ' cur' : ''}"${i === cur ? ' aria-current="true"' : ''}>${esc(s.title)}</button>`);
    b.onclick = () => select(i, false);
    $('#recent').appendChild(b);
  });
}
function drawPicker() {
  const p = $('#picker');
  SC.forEach((s, i) => {
    const b = el(`<button type="button" class="pk" role="listitem"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span class="d">${esc(s.short)}</span><span class="tn">${s.turns.length} turns</span></button>`);
    b.onclick = () => select(i, true);
    p.appendChild(b);
  });
}
function select(i, scroll) {
  cur = i; gen++;
  if (!ctxEl.hidden) closeCtx();
  history.replaceState(null, '', '#' + SC[i].id);
  drawRecent(); reset();
  if (scroll) { $('#app').scrollIntoView({ behavior: REDUCE || FAST ? 'auto' : 'smooth', block: 'start' }); }
}
function reset() {
  gen++; busy = false;
  const sc = SC[cur];
  session = new Session(sc);
  latest = session.initialReq();
  $('#ttl').textContent = sc.title;
  thread.innerHTML = `<p class="empty"><b>${esc(sc.title)}.</b> ${esc(sc.blurb)} Choose a message below to start. The context already holds the parts set up before the chat; press Show context to look.</p>`;
  thread.scrollTop = 0;
  drawFoot();
}
function drawFoot() {
  const sc = SC[cur];
  foot.innerHTML = '';
  if (busy) { foot.innerHTML = '<p class="lab">Replying…</p>'; return; }
  if (session.turn >= sc.turns.length) {
    foot.appendChild(el('<p class="done">End of this example. Open any Show context button above to compare the turns, or replay it.</p>'));
    const r = el('<div class="foot-row"></div>');
    const rb = el('<button type="button" class="btn">Replay</button>'); rb.onclick = reset;
    const nb = el('<button type="button" class="btn ghost">Next example →</button>'); nb.onclick = () => select((cur + 1) % SC.length, false);
    r.append(rb, nb); foot.appendChild(r);
    return;
  }
  const t = sc.turns[session.turn];
  foot.appendChild(el('<p class="lab">Suggested next messages. The reply is scripted, so any of them gets the same answer.</p>'));
  const c = el('<div class="chips"></div>');
  t.choices.forEach(txt => { const b = el(`<button type="button" class="chip">${esc(txt)}</button>`); b.onclick = () => send(txt); c.appendChild(b); });
  foot.appendChild(c);
  const r = el('<div class="foot-row"></div>');
  const nb = el('<button type="button" class="btn" id="next">Next turn</button>'); nb.onclick = () => send(t.choices[0]);
  r.append(nb, el(`<span class="tag">Turn ${session.turn + 1} of ${sc.turns.length}</span>`));
  foot.appendChild(r);
}
function scrollDown() { thread.scrollTop = thread.scrollHeight; }
function send(text) {
  if (busy) return;
  busy = true;
  const my = gen;
  const e = thread.querySelector('.empty'); if (e) e.remove();
  thread.appendChild(el(`<div class="t u">${esc(text)}</div>`));
  const steps = session.runTurn(text);
  drawFoot(); scrollDown();
  let i = 0;
  const next = () => {
    if (my !== gen) return;
    if (i >= steps.length) { busy = false; drawFoot(); const n = $('#next'); if (n && !FAST) n.focus({ preventScroll: true }); scrollDown(); return; }
    const s = steps[i++];
    thread.appendChild(rowFor(s));
    if (s.req) latest = s.req;
    scrollDown();
    DELAY ? setTimeout(next, DELAY) : next();
  };
  DELAY ? setTimeout(next, DELAY) : next();
}

$('#ctxTop').onclick = () => openCtx(latest, $('#ctxTop'));
$('#replay').onclick = reset;

drawPicker();
const hash = location.hash.slice(1), hi = SC.findIndex(s => s.id === hash);
cur = hi >= 0 ? hi : 0;
drawRecent(); reset();
})();
