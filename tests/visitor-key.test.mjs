import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '/nonexistent/model-context-explorer-test-adc.json';
await mkdir('tests/.generated', { recursive: true });
await build({ stdin: { contents: `export * from './services/geminiService'; export * from './services/visitorKey'; export { Scenario } from './types';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: 'tests/.generated/service.mjs' });
const app = await import('./.generated/service.mjs');
const originalFetch = globalThis.fetch;
let calls = [];
let responder;
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/generativelanguage.googleapis.com\//);
  calls.push({ url: String(url), options });
  return responder(url, options);
};
const reply = text => new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }), { headers: { 'Content-Type': 'application/json' } });
after(async () => { globalThis.fetch = originalFetch; app.setVisitorKey(''); await rm('tests/.generated', { recursive: true, force: true }); });
test('every scenario rejects missing credentials before any request', async () => {
  app.setVisitorKey(''); calls = [];
  for (const scenario of Object.values(app.Scenario)) await assert.rejects(app.getGeminiResponse(scenario, [], 'hello'), /Enter your Gemini API key/);
  assert.equal(calls.length, 0);
});
test('all five generation boundaries use a synthetic key and redact result/context', async () => {
  app.setVisitorKey('synthetic-visitor-key'); calls = [];
  responder = () => reply('Answer synthetic-visitor-key');
  for (const scenario of [app.Scenario.NORMAL, app.Scenario.SEARCH, app.Scenario.DOCUMENT]) {
    const result = await app.getGeminiResponse(scenario, [], 'hello');
    assert.equal(result.text, 'Answer [redacted]');
    assert.ok(!JSON.stringify(result).includes('synthetic-visitor-key'));
  }
  let step = 0;
  responder = () => ++step === 1 ? new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'code_interpreter', args: { code: '150 / 3' } } }] } }] }), { headers: { 'Content-Type': 'application/json' } }) : reply('50');
  const data = await app.getGeminiResponse(app.Scenario.DATA, [], '150 divided by 3');
  assert.equal(data.text, '50'); assert.equal(calls.length, 5);
  assert.equal(data.context.toolResult.functionResponse.response.result, 50);
  for (const call of calls) {
    assert.ok(!call.url.includes('synthetic-visitor-key'));
    assert.equal(new Headers(call.options.headers).get('x-goog-api-key'), 'synthetic-visitor-key');
  }
});
test('clear/change aborts the request and blocks the old second tool stage', async () => {
  for (const replacement of ['', 'replacement-synthetic-key']) {
    app.setVisitorKey('old-synthetic-key'); calls = [];
    responder = (_url, options) => {
      app.setVisitorKey(replacement);
      assert.equal(options.signal.aborted, true);
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'code_interpreter', args: { code: '2+2' } } }] } }] }), { headers: { 'Content-Type': 'application/json' } });
    };
    await assert.rejects(app.getGeminiResponse(app.Scenario.DATA, [], 'calculate'), /changed or was cleared/);
    assert.equal(calls.length, 1);
  }
});
test('provider errors never expose raw error details or credentials', async () => {
  app.setVisitorKey('synthetic-visitor-key');
  responder = () => new Response(JSON.stringify({ error: { code: 403, message: 'secret synthetic-visitor-key https://private.example' } }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(app.getGeminiResponse(app.Scenario.NORMAL, [], 'hello'), error => !error.message.includes('synthetic-visitor-key') && !error.message.includes('private.example'));
});
