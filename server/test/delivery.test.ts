import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/connection.js';

const ignoreRequestLog = () => {};

test('seed CLI preserves edited data across processes and the API reads it after reopening', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'presight-delivery-'));
  const path = join(directory, 'directory.sqlite');
  const seed = () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/db/seed-cli.ts', '--count', '31'],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...process.env, DATABASE_PATH: path },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    assert.match(seed(), /Seeded 31 users/);
    const original = openDatabase(path);
    try {
      original.prepare('UPDATE users SET first_name = ? WHERE id = 1').run('PersistenceMarker');
    } finally {
      original.close();
    }
    assert.match(seed(), /Kept 31 existing users/);
    const reopened = openDatabase(path);
    try {
      const response = await request(createApp(reopened, undefined, ignoreRequestLog))
        .post('/api/users/search')
        .send({ q: 'PersistenceMarker' })
        .expect(200);
      assert.equal(response.body.pagination.total, 1);
      assert.equal(response.body.users[0].id, 1);
      assert.deepEqual(response.body.users[0].hobbies, []);
      assert.equal(reopened.pragma('integrity_check', { simple: true }), 'ok');
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('production static serving supports URL state without swallowing API errors', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'presight-client-'));
  const db = openDatabase(':memory:');
  try {
    writeFileSync(join(directory, 'index.html'), '<!doctype html><div id="root">Directory</div>');
    writeFileSync(join(directory, 'app.js'), 'console.log("directory");');
    const app = createApp(db, directory, ignoreRequestLog);
    await request(app).get('/?q=Alice&sort=age').expect(200).expect('Content-Type', /html/);
    await request(app)
      .get('/app.js')
      .expect(200)
      .expect('Content-Type', /javascript/);
    await request(app).get('/api/health').expect(200, { status: 'ok' });
    await request(app).get('/api/missing').expect(404).expect('Content-Type', /json/);
    await request(app)
      .post('/api/users/search')
      .send({ sort: 'invalid' })
      .expect(400)
      .expect('Content-Type', /json/);
    await request(app).get('/missing.js').expect(404);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
