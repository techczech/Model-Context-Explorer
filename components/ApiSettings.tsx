import React, { useState } from 'react';
import { hasVisitorKey, setVisitorKey } from '../services/visitorKey';

export default function ApiSettings() {
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(hasVisitorKey);
  const [status, setStatus] = useState('');
  return <details className="container mx-auto px-4 py-3 border-b border-slate-200 dark:border-slate-700">
    <summary className="cursor-pointer font-semibold">API settings — {ready ? 'key ready' : 'key required for AI'}</summary>
    <p className="text-sm my-2">Use your Gemini API key. Requests go directly to Google and use your account quota. The key stays in memory until this page closes. Saved conversations remain available without a key.</p>
    <form className="flex flex-wrap gap-2 items-center" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; setVisitorKey(draft); setDraft(''); setReady(true); setStatus('Key set for this page session.'); }}>
      <label htmlFor="visitor-key">Gemini API key</label>
      <input id="visitor-key" type="password" autoComplete="off" value={draft} onChange={e => setDraft(e.target.value)} className="rounded border border-slate-400 p-2 bg-white dark:bg-slate-800" />
      <button className="rounded bg-cyan-600 text-white px-3 py-2" disabled={!draft.trim()}>Use key</button>
      <button type="button" className="rounded border px-3 py-2" onClick={() => { setVisitorKey(''); setDraft(''); setReady(false); setStatus('Key cleared. Active requests cancelled.'); }}>Clear key</button>
    </form>
    <p role="status" className="text-sm mt-2">{status}</p>
  </details>;
}
