import type { FilterOptionsResponse, DirectoryUser } from '@presight/shared';
import type Database from 'better-sqlite3';
import { asc, count, desc, eq, inArray } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { hobbies, userHobbies, users } from '../db/tables.js';
import type { UserQuery, UserFilters } from '../validation/userQuery.js';
import { buildUserFilter, buildUserOrderBy } from './queryBuilder.js';

// Fetch hobbies for the whole page in one query, including users with none.
const withHobbies = (
  db: BetterSQLite3Database,
  page: (typeof users.$inferSelect)[],
): DirectoryUser[] => {
  if (!page.length) return [];
  const rows = db
    .select({ userId: userHobbies.userId, value: hobbies.value })
    .from(userHobbies)
    .innerJoin(hobbies, eq(hobbies.id, userHobbies.hobbyId))
    .where(
      inArray(
        userHobbies.userId,
        page.map((user) => user.id),
      ),
    )
    .orderBy(asc(hobbies.value))
    .all();
  const byUser = new Map<number, string[]>();
  for (const row of rows) {
    const values = byUser.get(row.userId) ?? [];
    values.push(row.value);
    byUser.set(row.userId, values);
  }
  return page.map((user) => ({ ...user, hobbies: byUser.get(user.id) ?? [] }));
};

export interface UserSearchResult {
  users: DirectoryUser[];
  total: number;
}

export interface UserRepository {
  find: (query: UserQuery) => UserSearchResult;
  filterOptions: (filters: UserFilters) => FilterOptionsResponse;
  findById: (id: number) => DirectoryUser | null;
}

export const createUserRepository = (sqlite: Database.Database): UserRepository => {
  const db = drizzle(sqlite);
  return {
    // Keep the page, hobbies, and total in one SQLite snapshot.
    find: (query) =>
      db.transaction((tx) => {
        const filter = buildUserFilter(tx, query);
        const page = tx
          .select()
          .from(users)
          .where(filter)
          .orderBy(...buildUserOrderBy(query))
          .limit(query.limit)
          .offset(query.offset)
          .all();
        const total = tx.select({ total: count() }).from(users).where(filter).get()!.total;
        return { users: withHobbies(tx, page), total };
      }),
    filterOptions: (filters) =>
      db.transaction((tx) => {
        const filter = buildUserFilter(tx, filters);
        // Ignore this group's own selection so other nationalities remain available.
        const nationalityFilter = buildUserFilter(tx, { ...filters, nationalities: [] });
        return {
          hobbies: tx
            .select({ value: hobbies.value, count: count() })
            .from(users)
            .innerJoin(userHobbies, eq(userHobbies.userId, users.id))
            .innerJoin(hobbies, eq(hobbies.id, userHobbies.hobbyId))
            .where(filter)
            .groupBy(hobbies.id)
            .orderBy(desc(count()), asc(hobbies.value))
            .limit(20)
            .all(),
          nationalities: tx
            .select({ value: users.nationality, count: count() })
            .from(users)
            .where(nationalityFilter)
            .groupBy(users.nationality)
            .orderBy(desc(count()), asc(users.nationality))
            .limit(20)
            .all(),
        };
      }),
    findById: (id) =>
      db.transaction((tx) => {
        const user = tx.select().from(users).where(eq(users.id, id)).get();
        if (!user) return null;
        return withHobbies(tx, [user])[0]!;
      }),
  };
};
