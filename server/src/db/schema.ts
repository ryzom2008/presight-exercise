import type Database from 'better-sqlite3';

// Migrations run once, atomically. Add new versions rather than editing applied SQL.
export function migrate(db: Database.Database): void {
  db.transaction(() => {
    const version = db.pragma('user_version', { simple: true }) as number;
    if (version > 1) throw new Error(`Unsupported database schema version: ${version}`);
    if (version === 1) return;

    if (version < 1)
      db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        avatar TEXT NOT NULL CHECK (length(trim(avatar)) > 0),
        first_name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(first_name)) > 0),
        last_name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(last_name)) > 0),
        age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
        nationality TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(nationality)) > 0)
      ) STRICT;

      CREATE TABLE hobbies (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(value)) > 0)
      ) STRICT;

      CREATE TABLE user_hobbies (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hobby_id INTEGER NOT NULL REFERENCES hobbies(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, hobby_id)
      ) STRICT;

      CREATE INDEX users_first_name_id ON users(first_name, id);
      CREATE INDEX users_last_name_id ON users(last_name, id);
      CREATE INDEX users_age_id ON users(age, id);
      CREATE INDEX users_nationality_id ON users(nationality, id);
      CREATE INDEX user_hobbies_hobby_user ON user_hobbies(hobby_id, user_id);

      CREATE TRIGGER user_hobbies_max_insert BEFORE INSERT ON user_hobbies
      WHEN (SELECT count(*) FROM user_hobbies WHERE user_id = NEW.user_id) >= 10
      BEGIN SELECT RAISE(ABORT, 'A user can have at most 10 hobbies'); END;

      CREATE TRIGGER user_hobbies_max_update BEFORE UPDATE OF user_id ON user_hobbies
      WHEN NEW.user_id != OLD.user_id
        AND (SELECT count(*) FROM user_hobbies WHERE user_id = NEW.user_id) >= 10
      BEGIN SELECT RAISE(ABORT, 'A user can have at most 10 hobbies'); END;

      PRAGMA user_version = 1;
    `);
  }).immediate();
}
