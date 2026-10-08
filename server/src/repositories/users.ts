import type { FilterOptionsResponse, DirectoryUser, FilterOption } from '@presight/shared';
import type Database from 'better-sqlite3';
import type { UserQuery, UserFilters } from '../validation/userQuery.js';
import { buildUserFilter, buildUserOrderBy, type UserFilter } from './queryBuilder.js';

interface UserRow extends Omit<DirectoryUser, 'hobbies'> {
  hobbies: string;
}

const toUser = (row: UserRow): DirectoryUser => ({
  ...row,
  hobbies: JSON.parse(row.hobbies) as string[],
});

const USER_COLUMNS = `
  u.id, u.avatar, u.first_name, u.last_name, u.age, u.nationality,
  (SELECT json_group_array(h.value ORDER BY h.value COLLATE NOCASE)
   FROM user_hobbies uh JOIN hobbies h ON h.id = uh.hobby_id
   WHERE uh.user_id = u.id) AS hobbies
`;

const countUsers = (db: Database.Database, { where, params }: UserFilter): number => {
  const statement = db.prepare<(string | number)[], { total: number }>(
    `
    SELECT count(*) AS total FROM users u WHERE ${where}
  `,
  );
  const row = statement.get(...params);
  if (!row) throw new Error('Unable to count users');
  return row.total;
};

const getTopNationalities = (
  db: Database.Database,
  { where, params }: UserFilter,
): FilterOption[] => {
  const statement = db.prepare<(string | number)[], FilterOption>(
    `
    SELECT u.nationality AS value, count(*) AS count
    FROM users u
    WHERE ${where}
    GROUP BY u.nationality
    ORDER BY count DESC, value COLLATE NOCASE ASC
    LIMIT 20
  `,
  );
  return statement.all(...params);
};

const getTopHobbies = (db: Database.Database, { where, params }: UserFilter): FilterOption[] => {
  const statement = db.prepare<(string | number)[], FilterOption>(
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
  );
  return statement.all(...params);
};

const getUserPage = (
  db: Database.Database,
  { where, params }: UserFilter,
  query: UserQuery,
): UserRow[] => {
  const statement = db.prepare<(string | number)[], UserRow>(
    `
    SELECT ${USER_COLUMNS} FROM users u
    WHERE ${where}
    ${buildUserOrderBy(query)}
    LIMIT ? OFFSET ?
  `,
  );
  return statement.all(...params, query.limit, query.offset);
};

export interface UserSearchResult {
  users: DirectoryUser[];
  total: number;
}

export interface UserRepository {
  find: (query: UserQuery) => UserSearchResult;
  filterOptions: (filters: UserFilters) => FilterOptionsResponse;
}

export const createUserRepository = (db: Database.Database): UserRepository => ({
  // All queries read the same SQLite snapshot.
  find: (query) =>
    db.transaction(() => {
      const filter = buildUserFilter(query);
      return {
        users: getUserPage(db, filter, query).map(toUser),
        total: countUsers(db, filter),
      };
    })(),
  filterOptions: (filters) =>
    db.transaction(() => {
      const filter = buildUserFilter(filters);
      // Nationalities match ANY selection, so keep alternatives available to add.
      const nationalityFilter = buildUserFilter({ ...filters, nationalities: [] });
      return {
        hobbies: getTopHobbies(db, filter),
        nationalities: getTopNationalities(db, nationalityFilter),
      };
    })(),
});
