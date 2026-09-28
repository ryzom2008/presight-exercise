import type Database from 'better-sqlite3';
import type { UserQuery } from './query.js';

interface UserRow {
  id: number;
  avatar: string;
  first_name: string;
  last_name: string;
  age: number;
  nationality: string;
}
interface FilterOption {
  value: string;
  count: number;
}

interface UserFilter {
  where: string;
  params: (string | number)[];
}

interface HobbyRow {
  user_id: number;
  value: string;
}

const placeholders = (count: number) => Array(count).fill('?').join(',');

const buildUserFilter = (query: UserQuery): UserFilter => {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (query.q) {
    const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push(`(u.first_name LIKE ? ESCAPE '\\' OR u.last_name LIKE ? ESCAPE '\\'
      OR (u.first_name || ' ' || u.last_name) LIKE ? ESCAPE '\\')`);
    params.push(pattern, pattern, pattern);
  }
  if (query.nationalities.length) {
    clauses.push(`u.nationality IN (${placeholders(query.nationalities.length)})`);
    params.push(...query.nationalities);
  }
  for (const hobby of query.hobbies) {
    clauses.push(`EXISTS (SELECT 1 FROM user_hobbies uh JOIN hobbies h ON h.id = uh.hobby_id
      WHERE uh.user_id = u.id AND h.value = ?)`);
    params.push(hobby);
  }
  return { where: clauses.length ? clauses.join(' AND ') : '1 = 1', params };
};

const countUsers = (db: Database.Database, { where, params }: UserFilter): number => {
  const row = db
    .prepare(
      `
    SELECT count(*) AS total FROM users u WHERE ${where}
  `,
    )
    .get(...params) as { total: number };
  return row.total;
};

const getTopNationalities = (
  db: Database.Database,
  { where, params }: UserFilter,
): FilterOption[] =>
  db
    .prepare(
      `
    SELECT u.nationality AS value, count(*) AS count
    FROM users u
    WHERE ${where}
    GROUP BY u.nationality
    ORDER BY count DESC, value COLLATE NOCASE ASC
    LIMIT 20
  `,
    )
    .all(...params) as FilterOption[];

const getTopHobbies = (db: Database.Database, { where, params }: UserFilter): FilterOption[] =>
  db
    .prepare(
      `
    SELECT h.value, count(*) AS count
    FROM users u
    JOIN user_hobbies uh ON uh.user_id = u.id
    JOIN hobbies h ON h.id = uh.hobby_id
    WHERE ${where}
    GROUP BY h.id
    ORDER BY count DESC, h.value COLLATE NOCASE ASC
    LIMIT 20
  `,
    )
    .all(...params) as FilterOption[];

const getUserPage = (
  db: Database.Database,
  { where, params }: UserFilter,
  query: UserQuery,
): UserRow[] => {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  return db
    .prepare(
      `
    SELECT u.* FROM users u
    WHERE ${where}
    ORDER BY u.${query.sort} ${direction}, u.id ${direction}
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, query.limit, query.offset) as UserRow[];
};

const getHobbiesByUser = (db: Database.Database, userIds: number[]): Map<number, string[]> => {
  const byUser = new Map<number, string[]>();
  if (!userIds.length) return byUser;

  const links = db
    .prepare(
      `
    SELECT uh.user_id, h.value
    FROM user_hobbies uh
    JOIN hobbies h ON h.id = uh.hobby_id
    WHERE uh.user_id IN (${placeholders(userIds.length)})
    ORDER BY h.value COLLATE NOCASE ASC
  `,
    )
    .all(...userIds) as HobbyRow[];

  for (const { user_id, value } of links) {
    const hobbies = byUser.get(user_id) ?? [];
    hobbies.push(value);
    byUser.set(user_id, hobbies);
  }
  return byUser;
};

const buildPagination = (query: UserQuery, total: number, pageLength: number) => {
  const nextOffset = query.offset + pageLength;
  const hasMore = nextOffset < total;
  return {
    total,
    limit: query.limit,
    offset: query.offset,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
  };
};

export const findUsers = (db: Database.Database, query: UserQuery) =>
  db.transaction(() => {
    const filter = buildUserFilter(query);
    const total = countUsers(db, filter);
    const page = getUserPage(db, filter, query);
    const hobbiesByUser = getHobbiesByUser(
      db,
      page.map((user) => user.id),
    );

    return {
      users: page.map((user) => ({
        ...user,
        hobbies: hobbiesByUser.get(user.id) ?? [],
      })),
      pagination: buildPagination(query, total, page.length),
      filterOptions: {
        hobbies: getTopHobbies(db, filter),
        nationalities: getTopNationalities(db, filter),
      },
    };
  })();
