import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Typed mappings for the existing database. schema.ts owns migrations,
// including indexes, collations, constraints, and triggers.
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  avatar: text('avatar').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  age: integer('age').notNull(),
  nationality: text('nationality').notNull(),
});

export const hobbies = sqliteTable('hobbies', {
  id: integer('id').primaryKey(),
  value: text('value').notNull(),
});

export const userHobbies = sqliteTable(
  'user_hobbies',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hobbyId: integer('hobby_id')
      .notNull()
      .references(() => hobbies.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.hobbyId] })],
);
