import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/connection.js';
import type { HttpRequestLog } from '../src/middleware/requestLogger.js';

test('request logging emits structured completion records and a matching response ID', async () => {
  const db = openDatabase(':memory:');
  const logs: HttpRequestLog[] = [];
  const api = request(createApp(db, undefined, (entry) => logs.push(entry)));
  try {
    const health = await api.get('/api/health').expect(200);
    await api.post('/api/users/search').send({ limit: 0 }).expect(400);

    assert.match(health.headers['x-request-id'], /^[0-9a-f-]{36}$/);
    assert.equal(logs.length, 2);
    assert.deepEqual(
      logs.map(({ event, method, path, status }) => ({ event, method, path, status })),
      [
        { event: 'http_request', method: 'GET', path: '/api/health', status: 200 },
        { event: 'http_request', method: 'POST', path: '/api/users/search', status: 400 },
      ],
    );
    assert.equal(logs[0]?.requestId, health.headers['x-request-id']);
    assert.ok(logs.every(({ durationMs }) => Number.isFinite(durationMs) && durationMs >= 0));
  } finally {
    db.close();
  }
});
