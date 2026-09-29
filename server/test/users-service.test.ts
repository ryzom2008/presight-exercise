import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUserService } from '../src/services/users.js';
import { parseUserQuery } from '../src/validation/userQuery.js';

test('service accepts a mocked repository and preserves the active query and filter counts', () => {
  const query = parseUserQuery({
    q: 'Ana',
    hobbies: ['Reading', 'Cooking'],
    nationalities: ['French'],
    sort: 'age',
    direction: 'desc',
    offset: 20,
    limit: 1,
  });
  const users = [
    {
      id: 7,
      avatar: 'avatar.svg',
      first_name: 'Ana',
      last_name: 'Smith',
      age: 30,
      nationality: 'French',
      hobbies: ['Cooking', 'Reading'],
    },
  ];
  const filterOptions = {
    hobbies: [{ value: 'Reading', count: 23 }],
    nationalities: [{ value: 'French', count: 23 }],
  };
  const service = createUserService({
    find: (received) => {
      assert.deepEqual(received, query);
      return { users, total: 23 };
    },
    filterOptions: () => filterOptions,
  });
  assert.deepEqual(service.getFilterOptions(query), filterOptions);
  assert.deepEqual(service.findUsers(query), {
    users,
    pagination: { total: 23, limit: 1, offset: 20, hasMore: true, nextOffset: 21 },
  });
});

test('service stops pagination for an empty page beyond the last result', () => {
  const service = createUserService({
    find: () => ({ users: [], total: 3 }),
    filterOptions: () => ({ hobbies: [], nationalities: [] }),
  });
  const result = service.findUsers(parseUserQuery({ offset: 20 }));
  assert.deepEqual(result.pagination, {
    total: 3,
    limit: 20,
    offset: 20,
    hasMore: false,
    nextOffset: null,
  });
});
