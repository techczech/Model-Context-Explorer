import assert from 'node:assert/strict';
import { chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];
page.on('pageerror', () => failures.push('page error'));
let requests = 0;
await page.route('**/*', async route => {
  const url = route.request().url();
  if (url.startsWith('http://127.0.0.1:4176/')) return route.continue();
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    requests++;
    assert.equal(route.request().headers()['x-goog-api-key'], 'synthetic-browser-key');
    return route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: 'Mocked browser response.' }] } }] } });
  }
  failures.push('unexpected external dependency');
  return route.abort();
});
try {
  await page.goto('http://127.0.0.1:4176/');
  await page.getByRole('heading', { name: 'Model Context Explorer', exact: true, level: 1 }).waitFor();
  await page.goto('http://127.0.0.1:4176/#/chat/normal');
  await page.getByPlaceholder('Type your message...').fill('keyless question');
  await page.locator('button[type=submit]').last().click();
  await page.getByText('Enter your Gemini API key in API settings before generating.', { exact: true }).waitFor();
  assert.equal(requests, 0);
  await page.locator('summary').click();
  await page.getByLabel('Gemini API key').fill('synthetic-browser-key');
  await page.getByRole('button', { name: 'Use key', exact: true }).click();
  assert.equal(await page.getByLabel('Gemini API key').inputValue(), '');
  for (const scenario of ['normal', 'data', 'search', 'document']) {
    await page.goto(`http://127.0.0.1:4176/#/chat/${scenario}`);
    await page.getByPlaceholder('Type your message...').fill('test question');
    await page.locator('button[type=submit]').last().click();
    await page.getByText('Mocked browser response.', { exact: true }).last().waitFor();
  }
  assert.equal(requests, 4);
  await page.getByRole('button', { name: 'Clear key', exact: true }).click();
  const saved = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  assert.ok(!saved.includes('synthetic-browser-key'));
  await page.goto('http://127.0.0.1:4176/#/history');
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  await page.getByText('Mocked browser response.', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Show Context', exact: true }).first().click();
  await page.getByText('System Prompt', { exact: true }).waitFor();
  await page.reload();
  await page.locator('summary').filter({ hasText: 'key required' }).waitFor();
  assert.deepEqual(failures, []);
  console.log('Browser passed: keyless mount/rejection; four mocked scenario flows; memory-only key; clear; keyless saved history/context; reload resets key; no external asset dependencies or page errors.');
} finally { await browser.close(); }
