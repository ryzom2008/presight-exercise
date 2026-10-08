import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase, resolveDatabasePath } from '../src/db/connection.js';
import { seedDatabase } from '../src/db/seed.js';

function snapshot(db: ReturnType<typeof openDatabase>) {
  return {
    users: db.prepare('SELECT * FROM users ORDER BY id').all(),
    hobbies: db.prepare('SELECT * FROM hobbies ORDER BY id').all(),
    links: db.prepare('SELECT * FROM user_hobbies ORDER BY user_id, hobby_id').all(),
  };
}

test('default seed persists 10,000 varied users and migrations preserve them on reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'presight-db-'));
  const path = join(directory, 'nested', 'directory.sqlite');
  let db = openDatabase(path);
  try {
    assert.deepEqual(seedDatabase(db), { inserted: true, count: 10000 });
    const original = snapshot(db);
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
    assert.equal(db.prepare('SELECT DISTINCT nationality FROM users').all().length, 50);
    const users = original.users as { id: number; avatar: string }[];
    assert.equal(users[0]?.avatar, 'https://i.pravatar.cc/400?u=presight-1');
    assert.equal(users.at(-1)?.avatar, 'https://i.pravatar.cc/400?u=presight-10000');
    assert.equal(new Set(users.map(({ avatar }) => avatar)).size, 10000);
    assert.equal(original.hobbies.length, 50);
    const counts = db
      .prepare(
        `SELECT DISTINCT count(h.hobby_id) AS count
      FROM users u LEFT JOIN user_hobbies h ON h.user_id = u.id
      GROUP BY u.id ORDER BY count`,
      )
      .all();
    assert.deepEqual(
      counts,
      Array.from({ length: 11 }, (_, count) => ({ count })),
    );
    db.close();
    db = openDatabase(path);
    assert.deepEqual(snapshot(db), original);
    assert.deepEqual(seedDatabase(db, { count: 5, seed: 7 }), { inserted: false, count: 10000 });
    assert.deepEqual(snapshot(db), original);
    seedDatabase(db, { reset: true });
    assert.deepEqual(snapshot(db), original);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('identical options produce identical rows; different seeds produce different users', () => {
  const a = openDatabase(':memory:');
  const b = openDatabase(':memory:');
  try {
    seedDatabase(a, { count: 55, seed: 123 });
    seedDatabase(b, { count: 55, seed: 123 });
    assert.deepEqual(snapshot(a), snapshot(b));
    seedDatabase(b, { count: 55, seed: 124, reset: true });
    assert.notDeepEqual(snapshot(a).users, snapshot(b).users);
  } finally {
    a.close();
    b.close();
  }
});

test('database enforces valid users, unique hobbies, foreign keys, and the ten-hobby limit', () => {
  const db = openDatabase(':memory:');
  try {
    seedDatabase(db, { count: 11 });
    assert.throws(() => db.prepare('UPDATE users SET age = -1 WHERE id = 1').run());
    assert.throws(() => db.prepare("UPDATE users SET first_name = ' ' WHERE id = 1").run());
    assert.throws(() => db.prepare("INSERT INTO hobbies(value) VALUES ('reading')").run());
    assert.throws(() => db.prepare('INSERT INTO user_hobbies VALUES (9999, 1)').run());
    assert.throws(() => db.prepare('INSERT INTO user_hobbies VALUES (1, 9999)').run());
    const link = db.prepare('SELECT * FROM user_hobbies WHERE user_id = 2').get() as {
      hobby_id: number;
    };
    assert.throws(() => db.prepare('INSERT INTO user_hobbies VALUES (2, ?)').run(link.hobby_id));
    const spare = db
      .prepare(
        `SELECT id FROM hobbies WHERE id NOT IN
      (SELECT hobby_id FROM user_hobbies WHERE user_id = 11) LIMIT 1`,
      )
      .get() as { id: number };
    assert.throws(
      () => db.prepare('INSERT INTO user_hobbies VALUES (11, ?)').run(spare.id),
      /at most 10/,
    );
    db.prepare('INSERT INTO user_hobbies VALUES (1, ?)').run(spare.id);
    assert.throws(
      () => db.prepare('UPDATE user_hobbies SET user_id = 11 WHERE user_id = 1').run(),
      /at most 10/,
    );
    db.prepare('DELETE FROM users WHERE id = 11').run();
    assert.deepEqual(db.prepare('SELECT * FROM user_hobbies WHERE user_id = 11').all(), []);
  } finally {
    db.close();
  }
});

test('invalid options and failed reseeding leave persisted data unchanged', () => {
  const db = openDatabase(':memory:');
  try {
    seedDatabase(db, { count: 22 });
    const before = snapshot(db);
    for (const count of [0, -1, 1.5, NaN, 100001]) {
      assert.throws(() => seedDatabase(db, { count, reset: true }), /Seed count/);
    }
    for (const seed of [-1, 1.5, NaN, 4294967296]) {
      assert.throws(() => seedDatabase(db, { seed, reset: true }), /Seed must/);
    }
    db.exec(`CREATE TRIGGER fail_seed BEFORE INSERT ON users WHEN NEW.id = 3
      BEGIN SELECT RAISE(ABORT, 'Simulated failure'); END;`);
    assert.throws(() => seedDatabase(db, { count: 10, reset: true }), /Simulated failure/);
    assert.deepEqual(snapshot(db), before);
  } finally {
    db.close();
  }
});

test('sorting and hobby lookup queries can use their indexes', () => {
  const db = openDatabase(':memory:');
  try {
    for (const field of ['first_name', 'last_name', 'age', 'nationality']) {
      const plan = db
        .prepare(`EXPLAIN QUERY PLAN SELECT id FROM users ORDER BY ${field}, id LIMIT 20`)
        .all();
      assert.match(JSON.stringify(plan), new RegExp(`users_${field}_id`));
    }
    const plan = db
      .prepare('EXPLAIN QUERY PLAN SELECT user_id FROM user_hobbies WHERE hobby_id = 1')
      .all();
    assert.match(JSON.stringify(plan), /user_hobbies_hobby_user/);
    assert.equal(
      resolveDatabasePath('data/test.sqlite'),
      resolveDatabasePath('data/directory.sqlite').replace('directory.sqlite', 'test.sqlite'),
    );
  } finally {
    db.close();
  }
});
