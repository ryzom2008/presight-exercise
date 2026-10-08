import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { hobbies, userHobbies, users } from '../db/tables.js';
import type { UserQuery, UserFilters } from '../validation/userQuery.js';

export const buildUserFilter = (db: BetterSQLite3Database, query: UserFilters) => {
  const conditions: SQL[] = [];

  if (query.q) {
    const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
    // A small SQL expression preserves literal wildcard escaping and full-name search.
    conditions.push(
      or(
        sql`${users.first_name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${users.last_name} LIKE ${pattern} ESCAPE '\\'`,
        sql`(${users.first_name} || ' ' || ${users.last_name}) LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }

  // Match ANY selected nationality.
  if (query.nationalities.length) {
    conditions.push(inArray(users.nationality, query.nationalities));
  }

  // Each selected hobby adds a condition: users must have ALL of them.
  for (const hobby of query.hobbies) {
    const matchingUsers = db
      .select({ userId: userHobbies.userId })
      .from(userHobbies)
      .innerJoin(hobbies, eq(hobbies.id, userHobbies.hobbyId))
      .where(eq(hobbies.value, hobby));
    conditions.push(inArray(users.id, matchingUsers));
  }

  return and(...conditions);
};

export const buildUserOrderBy = (query: UserQuery) => {
  const order = query.direction === 'asc' ? asc : desc;
  return [order(users[query.sort]), order(users.id)];
};
