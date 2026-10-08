import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/db/connection.js';
import { createUserRepository } from '../src/repositories/users.js';
import { parseUserQuery } from '../src/validation/userQuery.js';

test('Drizzle binds filter values and preserves literal LIKE searches without API validation', () => {
  const db = openDatabase(':memory:');
  try {
    db.exec(`
      INSERT INTO users VALUES
        (1, 'avatar', 'Alex', 'Smith', 30, 'French'),
        (2, 'avatar', '100%_Real', 'Back\u005c\u005cslash', 25, 'British');
      INSERT INTO hobbies VALUES (1, 'Reading');
      INSERT INTO user_hobbies VALUES (1, 1);
    `);
    const repository = createUserRepository(db);
    const defaults = parseUserQuery({});
    for (const q of ['%', '_', '\\']) {
      const result = repository.find({ ...defaults, q });
      assert.equal(result.total, 1);
      assert.deepEqual(
        result.users.map((user) => user.id),
        [2],
      );
      assert.deepEqual(result.users[0]!.hobbies, []);
    }
    const attack = "' OR 1=1 --";
    for (const filter of [{ q: attack }, { nationalities: [attack] }, { hobbies: [attack] }]) {
      assert.deepEqual(repository.find({ ...defaults, ...filter }), { users: [], total: 0 });
    }
    const result = repository.find({
      ...defaults,
      q: 'alex smith',
      nationalities: ['french'],
      hobbies: ['reading'],
    });
    assert.equal(result.total, 1);
    assert.deepEqual(result.users[0]!.hobbies, ['Reading']);
  } finally {
    db.close();
  }
});
