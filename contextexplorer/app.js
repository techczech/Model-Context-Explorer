/* Context Explorer: rendering and context building. Data lives in scenarios.js and real-sources.js. */
(function () {
'use strict';
const SC = window.SCENARIOS, REAL = window.CE_REAL;
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const fmt = n => Math.round(n).toLocaleString('en-GB');
const approx = t => Math.max(1, Math.ceil(t.length / 4));
/* Book scale: about 500 tokens to a printed page (stated in How it works). */
const TOK_PER_PAGE = 500;
const nPages = t => Math.round(t / TOK_PER_PAGE);
const pages = t => t < 250 ? 'under a page' : nPages(t) <= 1 ? 'about 1 page' : 'about ' + fmt(nPages(t)) + ' pages';
const tp = t => fmt(t) + ' tokens (' + pages(t) + ')';
const q = new URLSearchParams(location.search);
const FAST = q.has('fast');
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const EMBED_ID = q.get('embed');
const EMBED_I = EMBED_ID ? SC.findIndex(s => s.id === EMBED_ID) : -1;
const EMBED = EMBED_I >= 0;
const SITE = 'https://contextexplorer.semanticmachines.fyi/';

const TYPES = {
  system: 'System prompt', instructions: 'Instruction file', tools: 'Tool definitions', skills: 'Skill list', env: 'Environment',
  history: 'Conversation history', user: 'User message', call: 'Tool call', result: 'Tool result',
  retrieved: 'Retrieved snippets', skill: 'Loaded skill', subagent: 'Sub-agent summary', compaction: 'Compaction summary', plan: 'Task plan'
};
const PROV = { real: 'Real', mixed: 'Real format', estimate: 'Estimate', illustrative: 'Illustrative' };

/* ---------------------------------------------------------------- session: builds the context step by step */
class Session {
  constructor(sc) { this.sc = sc; this.reset(); }
  reset() {
    this.n = 0; this.turn = 0; this.reqInTurn = 0; this.summary = null;
    this.items = this.sc.setup.map(b => this.mk(b.type, b.label, b.text, { tokens: b.tokens, excerpt: b.excerpt, prov: b.prov }));
    this.sent = new Set(this.items.map(i => i.id));
  }
  mk(type, label, text, o) {
    o = o || {};
    return { id: 'b' + (++this.n), type, label, text, tokens: o.tokens || approx(text), excerpt: !!o.excerpt, turn: o.turn || 0, role: o.role || '', prov: o.prov || null, kept: !!o.kept };
  }
  show(items) {
    return items.map(it => {
      const c = Object.assign({}, it);
      if (it.role === 'user' && it.turn < this.turn) { c.type = 'history'; c.label = 'Earlier message: you' + (it.kept ? ' (kept word for word)' : ''); }
      if (it.role === 'assistant') { c.type = 'history'; c.label = 'Earlier reply: assistant'; }
      return c;
    });
  }
  /* mark: tag blocks that were not in the last request sent to the model */
  view(label, items, mark) {
    const blocks = this.show(items);
    blocks.forEach(b => { b.isNew = !!mark && !this.sent.has(b.id); });
    return { label, blocks, total: blocks.reduce((s, b) => s + b.tokens, 0), window: this.sc.window };
  }
  send(label, items) {
    const v = this.view(label, items, true);
    this.sent = new Set(v.blocks.map(b => b.id));
    return v;
  }
  req(what, lesson) {
    this.reqInTurn++;
    return { title: 'Request ' + this.reqInTurn + ' in turn ' + this.turn + ': sent to the model to ' + what, lesson, views: [this.send('', this.items)] };
  }
  initialReq() {
    const v = this.view('', this.items, false);
    return { title: 'Before your first message', lesson: this.sc.setupLesson || ('Nothing has been typed yet, but the model already holds ' + tp(v.total) + '. All of it is sent again with every request.'), views: [v] };
  }
  runTurn(chosen) {
    const sc = this.sc, t = sc.turns[this.turn], steps = [];
    this.turn++; this.reqInTurn = 0;
    const turn = this.turn;
    this.items.push(this.mk('user', 'User message', chosen, { turn, role: 'user' }));
    for (const ev of t.events) {
      if (ev.k === 'think' || ev.k === 'note') { steps.push({ k: ev.k, ev }); continue; }
      if (ev.k === 'tool') {
        const req = this.req('choose this tool call', t.lesson);
        steps.push({ k: 'tool', ev, req });
        const callText = ev.input ? ev.name + ' (freeform input)\n' + ev.input : JSON.stringify({ name: ev.name, arguments: ev.args }, null, 2);
        this.items.push(this.mk('call', 'Tool call: ' + ev.name, callText, { turn }));
        this.items.push(this.mk(ev.type || 'result', (ev.type === 'skill' ? 'Loaded skill: ' : ev.type === 'retrieved' ? 'Retrieved snippets: ' : 'Tool result: ') + ev.name,
          ev.result, { turn, tokens: ev.resultTokens, excerpt: !!ev.excerpt }));
        continue;
      }
      if (ev.k === 'sub') {
        this.items.push(this.mk('call', 'Tool call: spawn_subagent', JSON.stringify({ name: 'spawn_subagent', arguments: { name: ev.name, task: ev.task } }, null, 2), { turn }));
        this.items.push(this.mk('subagent', 'Sub-agent summary: ' + ev.name, ev.summary, { turn }));
        this.reqInTurn++;
        const main = this.send('Main agent', this.items);
        const sb = ev.sub.blocks.map((b, i) => ({ id: 's' + i, type: b.type, label: b.label, text: b.text, tokens: b.tokens || approx(b.text), excerpt: !!b.excerpt, prov: b.prov || null, turn: (b.type === 'system' || b.type === 'tools') ? 0 : 1, isNew: false }));
        const sub = { label: 'Sub-agent', blocks: sb, total: sb.reduce((s, b) => s + b.tokens, 0), window: sc.window, seps: { 0: 'Fresh context', 1: 'The task and its work' } };
        const req = { title: 'Main agent (what it receives next) and the sub-agent (its own context)', lesson: t.lesson, views: [main, sub] };
        steps.push({ k: 'sub', ev, req, mainTotal: main.total, subTotal: sub.total });
        continue;
      }
      if (ev.k === 'trigger') {
        const v = this.view('', this.items, true);
        const limit = Math.round(sc.window * (sc.compactAt || 0.9));
        const req = { title: 'What the next request would contain: over the compaction limit', lesson: t.lesson, views: [v], limit };
        steps.push({ k: 'trigger', ev, req, total: v.total, limit, window: sc.window });
        continue;
      }
      if (ev.k === 'summarise') {
        const pb = this.mk('user', 'Compaction prompt (added by the harness)', REAL.codexCompact.text, { turn, tokens: REAL.codexCompact.tokens,
          prov: { kind: 'real', text: 'Source: ' + REAL.codexCompact.name + '. Licence: Apache-2.0, copyright OpenAI.', url: REAL.codexCompact.url } });
        this.reqInTurn++;
        const v = this.send('', this.items.concat([pb]));
        this.summary = { text: ev.summary, tokens: ev.summaryTokens };
        const req = { title: 'Request ' + this.reqInTurn + ' in turn ' + turn + ': the harness asks the model for a summary', lesson: 'The whole context is sent once more, with the compaction prompt at the end. The reply is the summary that will replace almost everything above it.', views: [v] };
        steps.push({ k: 'summarise', ev, req, total: v.total });
        continue;
      }
      if (ev.k === 'compact') {
        const limit = Math.round(sc.window * (sc.compactAt || 0.9));
        const before = this.view('Before compaction', this.items, false);
        const keep = this.items.filter(i => i.turn === 0);
        const users = this.items.filter(i => i.role === 'user');
        const prior = users.filter(u => u.turn < turn).map(u => Object.assign({}, u, { kept: true }));
        const cur = users.filter(u => u.turn === turn);
        const sum = this.mk('compaction', 'Compaction summary', REAL.codexPrefix.text + '\n\n' + this.summary.text, { turn, tokens: REAL.codexPrefix.tokens + this.summary.tokens,
          prov: { kind: 'mixed', text: 'First paragraph: real, the prefix Codex CLI puts in front of every summary. The summary itself: illustrative, as the model might write it.', url: REAL.codexPrefix.url } });
        const re = (ev.reattach || []).map(f => this.mk('result', f.label, f.text, { turn, tokens: f.tokens, excerpt: true,
          prov: { kind: 'illustrative', text: 'Some harnesses attach the files read most recently again after compacting. Codex CLI keeps your own recent messages instead (up to 20,000 tokens).', url: REAL.codexKeepRule.url } }));
        const plan = ev.plan ? [this.mk('plan', 'Task plan', ev.plan, { turn, prov: { kind: 'illustrative', text: 'Some harnesses carry the current task list or plan into the new context.' } })] : [];
        this.items = keep.concat(prior, [sum], re, plan, cur);
        const after = this.send('After compaction', this.items);
        after.seps = { 0: 'Set up before the chat starts (unchanged)' };
        const req = { title: 'The context before and after compaction', compare: true, limit,
          lesson: 'Before: everything so far. After: the same set-up, your earlier messages word for word, the summary, the files read last, the plan and your latest message. Switch with the tabs.',
          views: [before, after] };
        steps.push({ k: 'compact', ev, req, before, after, limit });
        continue;
      }
      if (ev.k === 'answer') {
        const req = this.req('write this reply', t.lesson);
        steps.push({ k: 'answer', ev, req });
        const txt = [ev.text, ev.quote, ev.after].filter(Boolean).join('\n\n');
        this.items.push(this.mk('assistant', 'Reply', txt, { turn, role: 'assistant' }));
      }
    }
    return steps;
  }
}
/* Starting size of a scenario: everything before the first message. */
const startTotal = sc => new Session(sc).items.reduce((s, b) => s + b.tokens, 0);

/* ---------------------------------------------------------------- shared drawing: stacked bars on the window scale */
function segsHtml(v, denom) {
  return v.blocks.map(b => `<i style="width:${b.tokens / denom * 100}%;background:var(--t-${b.type})" title="${esc(b.label)}: ${fmt(b.tokens)} tokens"></i>`).join('');
}
function compareFig(views, limit, win) {
  const row = v => `<div class="cmp-row"><div class="cmp-h"><b>${esc(v.label)}</b><span>${tp(v.total)}</span></div>`
    + `<div class="cmp-bar" role="img" aria-label="${esc(v.label)}: ${fmt(v.total)} of ${fmt(win)} tokens">${segsHtml(v, win)}<span class="lim" style="left:${limit / win * 100}%"></span></div></div>`;
  return `<figure class="cmp">${views.map(row).join('')}<figcaption>Both bars span the whole ${fmt(win)}-token window (${pages(win)}). Dashed line: the compaction limit, ${fmt(limit)} tokens.</figcaption></figure>`;
}
function provHtml(p) {
  if (!p) return '';
  return `<div class="prov k-${p.kind}"><b>${PROV[p.kind]}.</b> ${esc(p.text)}${p.url ? ` <a href="${esc(p.url)}" target="_blank" rel="noopener">Open the source</a>` : ''}</div>`;
}

/* ---------------------------------------------------------------- context panel */
const ctxEl = $('#ctx'), ctxBody = $('#ctxBody'), cw = $('#cw'), backdrop = $('#backdrop');
const ctxHooks = { opened() {}, closed() {} };
let ctxOpener = null, ctxReq = null, ctxView = 0, zoom = null;

function openCtx(req, opener, view, o) {
  ctxReq = req; ctxView = view !== undefined ? view : (req.compare ? 1 : 0); ctxOpener = opener || null;
  cw.classList.add('has-ctx'); ctxEl.hidden = false; backdrop.hidden = false;
  drawCtx();
  ctxBody.scrollTop = 0;
  if (!(o && o.quiet)) $('#ctxClose').focus({ preventScroll: true });
  ctxHooks.opened();
}
function closeCtx() {
  ctxEl.hidden = true; backdrop.hidden = true; cw.classList.remove('has-ctx');
  if (ctxOpener && document.contains(ctxOpener)) ctxOpener.focus({ preventScroll: true });
  ctxHooks.closed();
}
$('#ctxClose').onclick = closeCtx;
backdrop.onclick = closeCtx;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ctxEl.hidden && !$('#embedDlg').open) closeCtx(); });

function followCtx(req) {
  if (ctxEl.hidden) return;
  const keep = ctxBody.scrollTop, sameKind = ctxReq && ctxReq.compare && req.compare;
  ctxReq = req; if (ctxView >= req.views.length) ctxView = 0;
  if (req.compare && !sameKind) ctxView = 1;
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
  let h = '';
  if (req.lesson) h += `<p class="lesson">${esc(req.lesson)}</p>`;
  if (req.compare) h += compareFig(req.views, req.limit, v.window);
  if (req.views.length > 1) {
    h += '<div class="tabs" role="group" aria-label="Context to show">' + req.views.map((x, i) => `<button type="button" class="tab${i === ctxView ? ' on' : ''}" aria-pressed="${i === ctxView}" data-v="${i}">${esc(x.label)} · ${fmt(x.total)} (${fmt(nPages(x.total))} pp.)</button>`).join('') + '</div>';
  }
  const lim = req.limit ? `<span class="lim" style="left:${req.limit / denom * 100}%"></span>` : '';
  h += `<div class="meter"><div class="tot"><b>${fmt(v.total)} tokens</b><span>${pages(v.total)}, of a ${fmt(v.window)}-token window (${pages(v.window)}): ${pct < 1 ? 'under 1' : pct.toFixed(pct < 10 ? 1 : 0)}% used</span>${pct >= 80 ? '<span class="warn">Near the limit</span>' : ''}</div>`
    + `<div class="mbar" role="img" aria-label="Context used: ${fmt(v.total)} of ${fmt(v.window)} tokens">${segsHtml(v, denom)}${zm ? '' : lim}</div>`
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
    const badge = b.prov ? `<span class="pb k-${b.prov.kind}">${PROV[b.prov.kind]}</span>` : '';
    return sep + `<details class="blk${b.isNew ? ' new' : ''}" style="--c:var(--t-${b.type})"><summary><span class="bl">${esc(b.label)}${b.isNew ? '<span class="nw">New</span>' : ''}${badge}</span><span class="tk">${fmt(b.tokens)} tokens${b.tokens >= 750 ? ' · ' + fmt(nPages(b.tokens)) + ' pp.' : ''}</span><span class="pv">${esc(first)}</span></summary><pre>${esc(b.text)}</pre>${b.excerpt ? `<div class="ex">Display shortened. The real block is about ${tp(b.tokens)}.</div>` : ''}${provHtml(b.prov)}</details>`;
  }).join('');
  ctxBody.innerHTML = h;
  ctxBody.querySelectorAll('.tab').forEach(b => b.onclick = () => { ctxView = +b.dataset.v; drawCtx(); const t = ctxBody.querySelector('.tab.on'); t && t.focus({ preventScroll: true }); });
  $('#zoom').onchange = e => { zoom = e.target.checked; drawCtx(); $('#zoom').focus({ preventScroll: true }); };
  $('#exp').onclick = () => ctxBody.querySelectorAll('.blk').forEach(d => d.open = true);
  $('#col').onclick = () => ctxBody.querySelectorAll('.blk').forEach(d => d.open = false);
}


/* ---------------------------------------------------------------- icons (sprite in index.html) */
const ic = (id, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const SCIC = { chat: 'chat', assistant: 'sparkle', agent: 'terminal', web: 'globe', files: 'folder', data: 'chart', skills: 'workflow', long: 'compress' };
const scIcon = sc => ic(SCIC[sc.id] || 'chat');
const motionOk = () => !(REDUCE || FAST);

/* ---------------------------------------------------------------- thread rows */
function ctxButton(req, label, view) {
  const b = el(`<button type="button" class="mini">${label || 'Show context'}</button>`);
  b.onclick = () => openCtx(req, b, view);
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
  if (ev.input) return `<div class="args"><b>${esc(ev.name)}</b>\n${esc(ev.input)}</div>`;
  if (ev.args && typeof ev.args.code === 'string') return `<div class="args"><b>${esc(ev.name)}</b>\n${esc(ev.args.code)}</div>`;
  if (ev.args && typeof ev.args.cmd === 'string' && Object.keys(ev.args).length === 1) return `<div class="args"><b>${esc(ev.name)}</b>\n$ ${esc(ev.args.cmd)}</div>`;
  return `<div class="args"><b>${esc(ev.name)}</b> ${esc(JSON.stringify(ev.args, null, 2))}</div>`;
}
const srcLink = (src, extra) => `<span class="srcline">Source: <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name)}</a>${extra ? '. ' + esc(extra) : ''}</span>`;
/* o: { newest, series, animate } */
function rowFor(step, o) {
  const ev = step.ev, fresh = o.newest ? ' fresh' : '';
  if (step.k === 'think') return el(`<details class="t d think${fresh}"${o.newest ? ' open' : ''}><summary>${ic('think')}Thought for ${ev.secs || 3} s</summary><div class="body">${esc(ev.text)}</div></details>`);
  if (step.k === 'tool') {
    const kind = ev.kind === 'search' ? 'search' : 'tool';
    const wrap = el(`<div class="t${fresh}" style="position:relative"></div>`);
    const det = el(`<details class="d ${kind}"${o.newest ? ' open' : ''}><summary>${ic(kind === 'search' ? 'search' : 'wrench')}${esc(ev.title)}</summary>`
      + `<div class="body">${(ev.chips && ev.chips.length) ? '<div class="srcs" style="margin-left:0">' + ev.chips.map(c => `<span class="src">${esc(c)}</span>`).join('') + '</div>' : ''}${argsHtml(ev)}<div class="res"><span class="rh">✓ ${ev.type === 'retrieved' ? 'Retrieved snippets' : 'Tool results'}${ev.resultTokens ? ' · ' + tp(ev.resultTokens) : ''}</span>${esc(ev.result)}</div></div></details>`);
    const b = ctxButton(step.req, 'Show context for this step'); b.classList.add('rowctx');
    wrap.append(det, b);
    return wrap;
  }
  if (step.k === 'sub') {
    const n = el(`<div class="t subrow${fresh}"><b>Sub-agent: ${esc(ev.name)}</b> <span class="tk">worked in its own context and returned a summary</span>`
      + `<div style="margin-top:4px"><em>Task:</em> ${esc(ev.task)}</div><ul>${ev.steps.map(s => '<li>' + esc(s) + '</li>').join('')}</ul>`
      + `<div class="res"><span class="rh">✓ Summary returned to the main agent</span>${esc(ev.summary)}</div>`
      + `<div class="tk" style="margin-top:6px">Sub-agent context: ${tp(step.subTotal)}. Main context: ${tp(step.mainTotal)}.</div></div>`);
    n.appendChild(ctxButton(step.req, 'Compare the two contexts'));
    return n;
  }
  if (step.k === 'trigger') {
    const pct = step.total / step.window * 100, lp = step.limit / step.window * 100;
    const n = el(`<div class="t harness${fresh}"><b>Auto-compaction triggered.</b> The next request would hold ${tp(step.total)}. Codex CLI compacts when the context reaches 90% of the window: ${fmt(step.limit)} of ${fmt(step.window)} tokens. It fires before the window is full, so there is room left for the summary request, the summary and the next reply.`
      + `<div class="gauge" role="img" aria-label="${fmt(step.total)} of ${fmt(step.window)} tokens used; limit ${fmt(step.limit)}"><i style="width:${Math.min(100, pct)}%"></i><span class="lim" style="left:${lp}%"></span></div>`
      + `<div class="gauge-s"><span>0</span><span>${Math.round(pct)}% used · limit ${Math.round(lp)}%</span><span>${fmt(step.window)}</span></div>`
      + srcLink(REAL.codexCompactRule) + '</div>');
    n.appendChild(ctxButton(step.req, 'Show the full context'));
    return n;
  }
  if (step.k === 'summarise') {
    const n = el(`<div class="t harness${fresh}"><b>The harness asks the model for a summary.</b> It sends the whole context once more, ${tp(step.total)}, with this request at the end, word for word from Codex CLI:`
      + `<div class="quote">${esc(REAL.codexCompact.text)}</div>${srcLink(REAL.codexCompact, 'Apache-2.0')}`
      + `<details class="sumd"${o.newest ? ' open' : ''}><summary>The model's summary (illustrative, about ${fmt(ev.summaryTokens)} tokens)</summary><div class="quote">${esc(ev.summary)}</div></details></div>`);
    n.appendChild(ctxButton(step.req, 'Show what was sent'));
    return n;
  }
  if (step.k === 'compact') {
    const n = el(`<div class="t harness${fresh}"><b>New context built: ${fmt(step.before.total)} → ${fmt(step.after.total)} tokens</b> (${pages(step.before.total)} → ${pages(step.after.total)}).`
      + compareFig([step.before, step.after], step.limit, step.before.window)
      + `<ul class="cmp-list"><li><b>Unchanged:</b> the set-up: instructions, tools, AGENTS.md, skill list and environment.</li>`
      + `<li><b>Added:</b> the summary, your earlier messages word for word, the files read last, the task plan and your latest message.</li>`
      + `<li><b>Dropped:</b> ${esc(ev.lost || 'everything else.')}</li></ul>`
      + `<span class="srcline">Codex CLI keeps the summary and your own recent messages (up to 20,000 tokens): <a href="${esc(REAL.codexKeepRule.url)}" target="_blank" rel="noopener">source</a>. The re-attached files and the plan follow what some other harnesses do; here they are illustrative.</span></div>`);
    n.appendChild(ctxButton(step.req, 'Show before and after', 1));
    return n;
  }
  if (step.k === 'note') return el(`<div class="t harness note${fresh}"><b>${esc(ev.title)}</b>${textBlocks(ev.text)}</div>`);
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
const PLAN_LABEL = { trigger: 'Auto-compaction triggered', summarise: 'The harness asks for a summary', compact: 'New context built' };
function planOf(sc) {
  const plan = [];
  sc.turns.forEach((t, ti) => {
    plan.push({ k: 'user', turn: ti, label: 'Turn ' + (ti + 1) + ': your message', words: nWords(t.choices[0]) });
    t.events.forEach((ev, ei) => {
      const base = { k: ev.k, turn: ti, ei };
      if (ev.k === 'think') plan.push({ ...base, label: 'Thought', words: nWords(ev.text) });
      else if (ev.k === 'tool') plan.push({ ...base, label: ev.title, words: nWords(ev.result) + nWords(ev.input || JSON.stringify(ev.args)) });
      else if (ev.k === 'sub') plan.push({ ...base, label: 'Sub-agent: ' + ev.name, words: nWords(ev.summary) + nWords(ev.task) });
      else if (PLAN_LABEL[ev.k]) plan.push({ ...base, label: PLAN_LABEL[ev.k], words: ev.k === 'summarise' ? 60 + nWords(ev.summary) / 3 : 60 });
      else if (ev.k === 'note') plan.push({ ...base, label: ev.title, words: nWords(ev.text) });
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
  $('#bEx').hidden = !atEnd || EMBED;
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
    const b = el(`<button type="button" class="pk" role="listitem"><span class="pk-ic">${scIcon(s)}</span><span class="n">Example ${i + 1}</span><b>${esc(s.title)}</b><span class="d">${esc(s.short)}</span><span class="tn">Starts at ${tp(startTotal(s))} · ${s.turns.length} turns · ${stepCount(s)} steps</span></button>`);
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
  if (!EMBED) history.replaceState(null, '', '#' + sc.id);
  $('#ttl').textContent = sc.title;
  $('#ttlIc').innerHTML = scIcon(sc);
  $('#model').textContent = sc.model || 'Example agent';
  $('#fullLink').href = SITE + '#' + sc.id;
  drawRecent(); drawDots(chat);
  const n = o.step ? o.step - 1 : (o.last ? chat.plan.length - 1 : 0);
  showStep(chat, n, {});
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
if (THEMES.includes(q.get('theme'))) theme = q.get('theme');   /* ?theme= wins for this page only, not stored */
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

/* ---------------------------------------------------------------- embed: ?embed=<id>&step=<n>&context=open&theme=light|dark */
const dlg = $('#embedDlg');
function embedBase() {
  const l = location;
  return /^https?:$/.test(l.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(l.hostname) ? l.origin + l.pathname : SITE;
}
function embedUrl() {
  const p = new URLSearchParams({ embed: chat.sc.id });
  if ($('#eStep').checked) p.set('step', chat.n + 1);
  if ($('#eCtx').checked) p.set('context', 'open');
  if ($('#eTheme').value) p.set('theme', $('#eTheme').value);
  return embedBase() + '?' + p.toString();
}
function drawEmbed() {
  const url = embedUrl();
  $('#eStepN').textContent = 'step ' + (chat.n + 1) + ' of ' + chat.plan.length;
  $('#eCode').value = `<iframe src="${url}" title="Context Explorer: ${chat.sc.title}" width="960" height="600" style="border:0;max-width:100%" loading="lazy"></iframe>`;
  const a = $('#eLink'); a.href = url; a.textContent = url;
  $('#eCopied').textContent = '';
}
$('#embedBtn').onclick = () => { stop(chat); updateControls(chat); drawEmbed(); dlg.showModal(); $('#eCode').select(); };
['eStep', 'eCtx', 'eTheme'].forEach(id => { $('#' + id).onchange = drawEmbed; });
$('#eCopy').onclick = async () => {
  const c = $('#eCode');
  try { await navigator.clipboard.writeText(c.value); $('#eCopied').textContent = 'Copied.'; }
  catch (e) { c.select(); $('#eCopied').textContent = 'Select the code and copy it.'; }
};
$('#eClose').onclick = () => dlg.close();
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

/* ---------------------------------------------------------------- start */
if (EMBED) {
  if (q.get('step') === 'last') select(EMBED_I, { last: true });
  else select(EMBED_I, { step: Math.max(1, parseInt(q.get('step'), 10) || 1) });
  if (q.get('context') === 'open') openCtx(chat.latest, $('#ctxTop'), undefined, { quiet: true });
} else {
  drawPicker();
  const hash = location.hash.slice(1), hi = SC.findIndex(s => s.id === hash);
  select(hi >= 0 ? hi : 0, { last: hi >= 0 });
  if (hi >= 0) requestAnimationFrame(() => $('#app').scrollIntoView({ behavior: 'instant', block: 'start' }));
  spy();
}
})();
