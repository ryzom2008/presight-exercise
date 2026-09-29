import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/connection.js';
import { sortFields } from '../src/validation/userQuery.js';

const ignoreRequestLog = () => {};

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
  return { db, api: request(createApp(db, undefined, ignoreRequestLog)) };
};

test('HTTP defaults return user shape, metadata and filter options; health and JSON 404 remain available', async () => {
  const { db, api } = fixture();
  try {
    const { body } = await api.post('/api/users/search').send({}).expect(200);
    assert.equal(body.users.length, 6);
    assert.deepEqual(body.pagination, {
      total: 6,
      limit: 20,
      offset: 0,
      hasMore: false,
      nextOffset: null,
    });
    assert.deepEqual(body.users.find((user: { id: number }) => user.id === 5).hobbies, []);
    assert.deepEqual(
      body.users.find((user: { id: number }) => user.id === 1),
      {
        id: 1,
        avatar: 'avatar:1',
        first_name: 'Alex',
        last_name: 'Smith',
        age: 30,
        nationality: 'British',
        hobbies: ['Reading', 'Swimming'],
      },
    );
    assert.equal('filterOptions' in body, false);
    const options = (await api.post('/api/users/filter-options').send({}).expect(200)).body;
    assert.deepEqual(options.hobbies, [
      { value: 'Reading', count: 4 },
      { value: 'Swimming', count: 4 },
      { value: 'Chess', count: 1 },
    ]);
    assert.deepEqual(options.nationalities, [
      { value: 'French', count: 3 },
      { value: 'British', count: 2 },
      { value: 'German', count: 1 },
    ]);
    await api.get('/api/users').expect(404);
    await api.post('/api/users/search').expect(200);
    await api.get('/api/health').expect(200, { status: 'ok' });
    await api.get('/api/unknown').expect(404, { error: { message: 'API route not found' } });
  } finally {
    db.close();
  }
});

test('text searches first name, last name and full name with literal SQL wildcard characters', async () => {
  const { db, api } = fixture();
  try {
    for (const [q, expected] of [
      [' ALEX ', [1, 2]],
      ['smith', [1, 2, 4]],
      ['alex smith', [1, 2]],
      ['%', [5]],
      ['_', [5]],
      ['\\', [5]],
      ["' OR 1=1 --", []],
    ] as [string, number[]][]) {
      const { body } = await api.post('/api/users/search').send({ q }).expect(200);
      assert.deepEqual(
        body.users.map((user: { id: number }) => user.id),
        expected,
      );
      assert.equal(body.pagination.total, expected.length);
    }
  } finally {
    db.close();
  }
});

test('nationality OR, hobby AND and text combine; counts include only matching users across all pages', async () => {
  const { db, api } = fixture();
  try {
    const filters = {
      nationalities: ['British', 'French'],
      hobbies: ['reading', 'swimming'],
      limit: 1,
    };
    const first = (await api.post('/api/users/search').send(filters).expect(200)).body;
    assert.equal(first.pagination.total, 3);
    assert.equal(first.pagination.hasMore, true);
    assert.deepEqual(
      first.users.map((user: { id: number }) => user.id),
      [1],
    );
    const options = (
      await api
        .post('/api/users/filter-options')
        .send({ nationalities: filters.nationalities, hobbies: filters.hobbies })
        .expect(200)
    ).body;
    assert.deepEqual(options.hobbies, [
      { value: 'Reading', count: 3 },
      { value: 'Swimming', count: 3 },
      { value: 'Chess', count: 1 },
    ]);
    assert.deepEqual(options.nationalities, [
      { value: 'French', count: 2 },
      { value: 'British', count: 1 },
    ]);
    const second = (
      await api
        .post('/api/users/search')
        .send({ ...filters, offset: first.pagination.nextOffset })
        .expect(200)
    ).body;
    assert.equal('filterOptions' in second, false);
    assert.equal(second.pagination.total, 3);
    const narrowed = (
      await api
        .post('/api/users/search')
        .send({ ...filters, q: 'ana' })
        .expect(200)
    ).body;
    assert.equal(narrowed.pagination.total, 2);
    const narrowedOptions = (
      await api
        .post('/api/users/filter-options')
        .send({ q: 'ana', hobbies: filters.hobbies, nationalities: filters.nationalities })
        .expect(200)
    ).body;
    assert.deepEqual(narrowedOptions.nationalities, [{ value: 'French', count: 2 }]);
    const duplicate = (
      await api
        .post('/api/users/search')
        .send({ hobbies: ['Reading', 'reading'] })
        .expect(200)
    ).body;
    assert.equal(duplicate.pagination.total, 4);
  } finally {
    db.close();
  }
});

test('all fields and both directions paginate through ties without missing or duplicate users', async () => {
  const { db, api } = fixture();
  try {
    const rows = db.prepare('SELECT * FROM users').all() as Record<string, string | number>[];
    for (const sort of sortFields) {
      for (const direction of ['asc', 'desc']) {
        const sign = direction === 'asc' ? 1 : -1;
        const expected = [...rows]
          .sort((a, b) => {
            const left = typeof a[sort] === 'string' ? (a[sort] as string).toLowerCase() : a[sort]!;
            const right =
              typeof b[sort] === 'string' ? (b[sort] as string).toLowerCase() : b[sort]!;
            return sign * (left < right ? -1 : left > right ? 1 : Number(a.id) - Number(b.id));
          })
          .map((row) => row.id);
        const actual: number[] = [];
        let offset: number | null = 0;
        for (let index = 0; index < rows.length; index++) {
          const response = await api
            .post('/api/users/search')
            .send({ sort, direction, limit: 1, offset })
            .expect(200);
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
  } finally {
    db.close();
  }
});

test('offset supports direct jumps, partial final pages, and offsets beyond the result set', async () => {
  const { db, api } = fixture();
  try {
    const all = (await api.post('/api/users/search').expect(200)).body;
    for (const offset of [2, 5, 6, 100, Number.MAX_SAFE_INTEGER]) {
      const { body } = await api.post('/api/users/search').send({ offset, limit: 2 }).expect(200);
      assert.deepEqual(body.users, all.users.slice(offset, offset + 2));

      assert.deepEqual(body.pagination, {
        total: 6,
        offset,
        limit: 2,
        hasMore: offset < 4,
        nextOffset: offset < 4 ? offset + 2 : null,
      });
    }
  } finally {
    db.close();
  }
});

test('empty results return empty filter options and terminal pagination', async () => {
  const { db, api } = fixture();
  try {
    for (const query of [
      { hobbies: ['Unknown'] },
      { nationalities: ['Unknown'] },
      { q: 'nobody' },
      { nationalities: ['German'], hobbies: ['Reading'] },
    ]) {
      const { body } = await api.post('/api/users/search').send(query).expect(200);
      const options = (await api.post('/api/users/filter-options').send(query).expect(200)).body;
      assert.deepEqual(options, { hobbies: [], nationalities: [] });
      assert.deepEqual(body, {
        users: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false, nextOffset: null },
      });
    }
    db.exec('DELETE FROM users');
    assert.equal((await api.post('/api/users/search').expect(200)).body.pagination.total, 0);
  } finally {
    db.close();
  }
});

test('top 20 filter options use count descending, then alphabetical ties, and change with filters', async () => {
  const db = openDatabase(':memory:');
  const api = request(createApp(db, undefined, ignoreRequestLog));
  try {
    for (let id = 1; id <= 25; id++) {
      const value = `Value ${String(id).padStart(2, '0')}`;
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        'avatar',
        'Person',
        'Name',
        30,
        value,
      );
      db.prepare('INSERT INTO hobbies VALUES (?, ?)').run(id, value);
      db.prepare('INSERT INTO user_hobbies VALUES (?, ?)').run(id, id);
    }
    db.exec(`INSERT INTO users VALUES (26, 'avatar', 'Extra', 'Name', 30, 'Value 25');
      INSERT INTO user_hobbies VALUES (26,25);`);
    const { body } = await api.post('/api/users/filter-options').send({}).expect(200);
    const expected = [
      { value: 'Value 25', count: 2 },
      ...Array.from({ length: 19 }, (_, i) => ({
        value: `Value ${String(i + 1).padStart(2, '0')}`,
        count: 1,
      })),
    ];

    assert.deepEqual(body.hobbies, expected);
    assert.deepEqual(body.nationalities, expected);
    const filtered = (
      await api
        .post('/api/users/filter-options')
        .send({ nationalities: ['Value 24'] })
        .expect(200)
    ).body;
    assert.deepEqual(filtered.hobbies, [{ value: 'Value 24', count: 1 }]);
    assert.deepEqual(filtered.nationalities, [{ value: 'Value 24', count: 1 }]);
  } finally {
    db.close();
  }
});

test('invalid filters and pagination parameters return structured 400 errors', async () => {
  const { db, api } = fixture();
  try {
    const invalid = [
      { limit: 0 },
      { limit: 101 },
      { limit: 1.5 },
      { limit: '20' },
      { limit: -1 },
      { sort: 'id' },
      { sort: 'age;DROP TABLE users' },
      { direction: 'up' },
      { sort: ['age'] },
      { q: ['a', 'b'] },
      { page: 2 },
      { hobbies: [''] },
      { nationalities: [''] },
      { hobbies: 'Reading' },
      { nationalities: 'French' },
      { hobbies: [1] },
      { q: 'a'.repeat(201) },
      { hobbies: ['a'.repeat(101)] },
      { hobbies: Array(11).fill('Reading') },
      { nationalities: Array(51).fill('French') },
      { cursor: 'obsolete' },
      { offset: -1 },
      { offset: 1.5 },
      { offset: '0' },
      { offset: Number.MAX_SAFE_INTEGER + 1 },
      { limit: null },
      { q: {} },
      [],
    ];
    for (const query of invalid) {
      const { body } = await api.post('/api/users/search').send(query).expect(400);
      assert.equal(body.error.code, 'INVALID_QUERY', JSON.stringify(query));
      assert.equal(typeof body.error.message, 'string');
    }
    assert.equal((db.prepare('SELECT count(*) AS n FROM users').get() as { n: number }).n, 6);
  } finally {
    db.close();
  }
});

test('internal database failures return JSON without exposing SQL or stack traces', async () => {
  const { db, api } = fixture();
  db.close();
  const { body } = await api.post('/api/users/search').expect(500);
  assert.deepEqual(body, { error: { code: 'INTERNAL_ERROR', message: 'Unable to load users' } });
});

test('malformed JSON and oversized bodies return structured errors', async () => {
  const { db, api } = fixture();
  try {
    const malformed = await api.post('/api/users/search').type('json').send('{').expect(400);
    assert.equal(malformed.body.error.code, 'INVALID_JSON');
    const oversized = await api
      .post('/api/users/search')
      .send({ q: 'a'.repeat(17000) })
      .expect(413);
    assert.equal(oversized.body.error.code, 'BODY_TOO_LARGE');
    await api.post('/api/users/search').type('text').send('hello').expect(415);
  } finally {
    db.close();
  }
});

test('filter options accepts only filters, validates them, and matches text literally', async () => {
  const { db, api } = fixture();
  try {
    for (const body of [
      { sort: 'age' },
      { limit: 20 },
      { offset: 0 },
      { hobbies: 'Reading' },
      { nationalities: [1] },
      { q: [] },
    ]) {
      const response = await api.post('/api/users/filter-options').send(body).expect(400);
      assert.equal(response.body.error.code, 'INVALID_QUERY');
    }
    const result = await api.post('/api/users/filter-options').send({ q: '%' }).expect(200);
    assert.deepEqual(result.body, { hobbies: [], nationalities: [{ value: 'British', count: 1 }] });
    await api.post('/api/users/filter-options').type('text').send('hello').expect(415);
    await api.post('/api/users/filter-options').type('json').send('{').expect(400);
  } finally {
    db.close();
  }
});
