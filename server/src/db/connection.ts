import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "./schema.js";

const serverDirectory = fileURLToPath(new URL("../../", import.meta.url));

export const resolveDatabasePath = (
  value = process.env.DATABASE_PATH ?? "data/directory.sqlite",
): string => {
  if (!value.trim()) throw new Error("DATABASE_PATH must not be empty");
  if (value === ":memory:") return value;
  return isAbsolute(value) ? value : resolve(serverDirectory, value);
};

export const openDatabase = (
  path = resolveDatabasePath(),
): Database.Database => {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    migrate(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
};
