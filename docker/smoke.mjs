// Run against either the disposable CI container or the public deployment.
import assert from 'node:assert/strict';

const base = process.argv[2];
assert.ok(base, 'Usage: node docker/smoke.mjs <base-url>');
const request = (path, options = {}) =>
  fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(15_000) });

const health = await request('/api/health');
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'ok' });

const page = await request('/');
assert.equal(page.status, 200);
assert.match(page.headers.get('content-type'), /text\/html/);
assert.match(await page.text(), /id="root"/);

const search = await request('/api/users/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: '', limit: 10 }),
});
assert.equal(search.status, 200);
const result = await search.json();
assert.ok(result.users.length > 0 && result.users.length <= 10);
assert.ok(result.pagination.total >= result.users.length);
console.log('Health, frontend, and database search passed.');
