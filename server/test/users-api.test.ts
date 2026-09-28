import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/connection.js';
import { sortFields } from '../src/users/query.js';

const fixture = () => {
  const db = openDatabase(':memory:');
  db.exec(`
    INSERT INTO users VALUES
      (1, 'avatar:1', 'Alex', 'Smith', 30, 'British'),
      (2, 'avatar:2', 'alex', 'Smith', 30, 'French'),
      (3, 'avatar:3', 'Ana', 'Jones', 25, 'French'),
      (4, 'avatar:4', 'Zoe', 'Smith', 40, 'German'),
      (5, 'avatar:5', '100%_Real', 'Back\\slash', 25, 'British'),
      (6, 'avatar:6', 'Ana', 'Jones', 25, 'French');
    INSERT INTO hobbies VALUES (1, 'Reading'), (2, 'Swimming'), (3, 'Chess');
    INSERT INTO user_hobbies VALUES (1,1), (1,2), (2,1), (3,1), (3,2), (3,3), (4,2), (6,1), (6,2);
  `);
  return { db, api: request(createApp(db)) };
};

test('HTTP defaults return user shape, metadata and filter options; health and JSON 404 remain available', async () => {
  const { db, api } = fixture();
  try {
    const { body } = await api.get('/api/users').expect(200);
    assert.equal(body.users.length, 6);
    assert.deepEqual(body.pagination, { total: 6, limit: 20, offset: 0, hasMore: false, nextOffset: null });
    assert.deepEqual(body.users.find((user: { id: number }) => user.id === 5).hobbies, []);
    assert.deepEqual(body.users.find((user: { id: number }) => user.id === 1), {
      id: 1, avatar: 'avatar:1', first_name: 'Alex', last_name: 'Smith', age: 30,
      nationality: 'British', hobbies: ['Reading', 'Swimming'],
    });
    assert.deepEqual(body.filterOptions.hobbies, [
      { value: 'Reading', count: 4 }, { value: 'Swimming', count: 4 }, { value: 'Chess', count: 1 },
    ]);
    assert.deepEqual(body.filterOptions.nationalities, [
      { value: 'French', count: 3 }, { value: 'British', count: 2 }, { value: 'German', count: 1 },
    ]);
    await api.get('/api/health').expect(200, { status: 'ok' });
    await api.get('/api/unknown').expect(404, { error: { message: 'API route not found' } });
  } finally { db.close(); }
});

test('text searches first name, last name and full name with literal SQL wildcard characters', async () => {
  const { db, api } = fixture();
  try {
    for (const [q, expected] of [
      [' ALEX ', [1, 2]], ['smith', [1, 2, 4]], ['alex smith', [1, 2]],
      ['%', [5]], ['_', [5]], ['\\', [5]], ["' OR 1=1 --", []],
    ] as [string, number[]][]) {
      const { body } = await api.get('/api/users').query({ q }).expect(200);
      assert.deepEqual(body.users.map((user: { id: number }) => user.id), expected);
      assert.equal(body.pagination.total, expected.length);
    }
  } finally { db.close(); }
});

test('nationality OR, hobby AND and text combine; counts include only matching users across all pages', async () => {
  const { db, api } = fixture();
  try {
    const url = '/api/users?nationality=British&nationality=French&hobby=reading&hobby=swimming&limit=1';
    const first = (await api.get(url).expect(200)).body;
    assert.equal(first.pagination.total, 3);
    assert.equal(first.pagination.hasMore, true);
    assert.deepEqual(first.users.map((user: { id: number }) => user.id), [1]);
    assert.deepEqual(first.filterOptions.hobbies, [
      { value: 'Reading', count: 3 }, { value: 'Swimming', count: 3 }, { value: 'Chess', count: 1 },
    ]);
    assert.deepEqual(first.filterOptions.nationalities, [{ value: 'French', count: 2 }, { value: 'British', count: 1 }]);
    const second = (await api.get(url).query({ offset: first.pagination.nextOffset }).expect(200)).body;
    assert.deepEqual(second.filterOptions, first.filterOptions);
    assert.equal(second.pagination.total, 3);
    const narrowed = (await api.get(`${url}&q=ana`).expect(200)).body;
    assert.equal(narrowed.pagination.total, 2);
    assert.deepEqual(narrowed.filterOptions.nationalities, [{ value: 'French', count: 2 }]);
    const duplicate = (await api.get('/api/users?hobby=Reading&hobby=reading').expect(200)).body;
    assert.equal(duplicate.pagination.total, 4);
  } finally { db.close(); }
});

test('all fields and both directions paginate through ties without missing or duplicate users', async () => {
  const { db, api } = fixture();
  try {
    const rows = db.prepare('SELECT * FROM users').all() as Record<string, string | number>[];
    for (const sort of sortFields) {
      for (const direction of ['asc', 'desc']) {
        const sign = direction === 'asc' ? 1 : -1;
        const expected = [...rows].sort((a, b) => {
          const left = typeof a[sort] === 'string' ? (a[sort] as string).toLowerCase() : a[sort]!;
          const right = typeof b[sort] === 'string' ? (b[sort] as string).toLowerCase() : b[sort]!;
          return sign * (left < right ? -1 : left > right ? 1 : Number(a.id) - Number(b.id));
        }).map((row) => row.id);
        const actual: number[] = [];
        let offset: number | null = 0;
        for (let index = 0; index < rows.length; index++) {
          const response = await api.get('/api/users').query({ sort, direction, limit: 1, offset }).expect(200);
          actual.push(...response.body.users.map((user: { id: number }) => user.id));
          assert.equal(response.body.pagination.total, 6);
          assert.equal(response.body.pagination.hasMore, index < rows.length - 1);
          offset = response.body.pagination.nextOffset;
          assert.equal(offset, index < rows.length - 1 ? index + 1 : null);
        }
        assert.equal(offset, null);
        assert.deepEqual(actual, expected, `${sort} ${direction}`);
      }
    }
  } finally { db.close(); }
});

test('offset supports direct jumps, partial final pages, and offsets beyond the result set', async () => {
  const { db, api } = fixture();
  try {
    const all = (await api.get('/api/users').expect(200)).body;
    for (const offset of [2, 5, 6, 100, Number.MAX_SAFE_INTEGER]) {
      const { body } = await api.get('/api/users').query({ offset, limit: 2 }).expect(200);
      assert.deepEqual(body.users, all.users.slice(offset, offset + 2));
      assert.deepEqual(body.filterOptions, all.filterOptions);
      assert.deepEqual(body.pagination, {
        total: 6, offset, limit: 2, hasMore: offset < 4,
        nextOffset: offset < 4 ? offset + 2 : null,
      });
    }
  } finally { db.close(); }
});

test('empty results return empty filter options and terminal pagination', async () => {
  const { db, api } = fixture();
  try {
    for (const query of ['hobby=Unknown', 'nationality=Unknown', 'q=nobody', 'nationality=German&hobby=Reading']) {
      const { body } = await api.get(`/api/users?${query}`).expect(200);
      assert.deepEqual(body, {
        users: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false, nextOffset: null },
        filterOptions: { hobbies: [], nationalities: [] },
      });
    }
    db.exec('DELETE FROM users');
    assert.equal((await api.get('/api/users').expect(200)).body.pagination.total, 0);
  } finally { db.close(); }
});

test('top 20 filter options use count descending, then alphabetical ties, and change with filters', async () => {
  const db = openDatabase(':memory:');
  const api = request(createApp(db));
  try {
    for (let id = 1; id <= 25; id++) {
      const value = `Value ${String(id).padStart(2, '0')}`;
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(id, 'avatar', 'Person', 'Name', 30, value);
      db.prepare('INSERT INTO hobbies VALUES (?, ?)').run(id, value);
      db.prepare('INSERT INTO user_hobbies VALUES (?, ?)').run(id, id);
    }
    db.exec(`INSERT INTO users VALUES (26, 'avatar', 'Extra', 'Name', 30, 'Value 25');
      INSERT INTO user_hobbies VALUES (26,25);`);
    const { body } = await api.get('/api/users?limit=1').expect(200);
    const expected = [{ value: 'Value 25', count: 2 }, ...Array.from({ length: 19 }, (_, i) => ({
      value: `Value ${String(i + 1).padStart(2, '0')}`, count: 1,
    }))];
    assert.equal(body.pagination.total, 26);
    assert.deepEqual(body.filterOptions.hobbies, expected);
    assert.deepEqual(body.filterOptions.nationalities, expected);
    const filtered = (await api.get('/api/users?nationality=Value%2024').expect(200)).body;
    assert.deepEqual(filtered.filterOptions.hobbies, [{ value: 'Value 24', count: 1 }]);
    assert.deepEqual(filtered.filterOptions.nationalities, [{ value: 'Value 24', count: 1 }]);
  } finally { db.close(); }
});

test('invalid filters and pagination parameters return structured 400 errors', async () => {
  const { db, api } = fixture();
  try {
    const invalid = [
      'limit=0', 'limit=101', 'limit=1.5', 'limit=abc', 'limit=-1', 'limit=',
      'sort=id', 'sort=age%3BDROP%20TABLE%20users', 'direction=up', 'sort=age&sort=age',
      'q=a&q=b', 'page=2', 'hobby=', 'nationality=', 'hobby[]=Reading',
      `q=${'a'.repeat(201)}`, `hobby=${'a'.repeat(101)}`,
      Array.from({ length: 11 }, () => 'hobby=Reading').join('&'),
      Array.from({ length: 51 }, () => 'nationality=French').join('&'),
      'cursor=obsolete', 'offset=-1', 'offset=1.5', 'offset=abc', 'offset=',
      'offset=9007199254740992', 'offset=1e2', 'offset=0&offset=1', 'limit=1&limit=2',
    ];
    for (const query of invalid) {
      const { body } = await api.get(`/api/users?${query}`).expect(400);
      assert.equal(body.error.code, 'INVALID_QUERY', query);
      assert.equal(typeof body.error.message, 'string');
    }
    assert.equal((db.prepare('SELECT count(*) AS n FROM users').get() as { n: number }).n, 6);
  } finally { db.close(); }
});

test('internal database failures return JSON without exposing SQL or stack traces', async () => {
  const { db, api } = fixture();
  db.close();
  const { body } = await api.get('/api/users').expect(500);
  assert.deepEqual(body, { error: { code: 'INTERNAL_ERROR', message: 'Unable to load users' } });
});
