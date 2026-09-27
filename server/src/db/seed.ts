import type Database from "better-sqlite3";
import { firstNames, hobbies, lastNames, nationalities } from "./seed-data.js";

export interface SeedOptions {
  count?: number;
  seed?: number;
  reset?: boolean;
}

const randomGenerator = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const avatar = (first: string, last: string, id: number): string => {
  const colors = ["#245c49", "#315b87", "#785589", "#92542e", "#526c3b"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${colors[id % colors.length]}"/><text x="48" y="50" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="32" fill="white">${first[0]}${last[0]}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

export const seedDatabase = (
  db: Database.Database,
  options: SeedOptions = {},
) => {
  const { count = 2000, seed = 42, reset = false } = options;
  if (!Number.isSafeInteger(count) || count < 1 || count > 100000) {
    throw new Error("Seed count must be an integer between 1 and 100000");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("Seed must be an integer between 0 and 4294967295");
  }

  return db
    .transaction(() => {
      const existing = db
        .prepare("SELECT count(*) AS count FROM users")
        .get() as { count: number };
      if (existing.count > 0 && !reset)
        return { inserted: false, count: existing.count };
      if (reset)
        db.exec(
          "DELETE FROM user_hobbies; DELETE FROM users; DELETE FROM hobbies;",
        );

      const random = randomGenerator(seed);
      const pick = <T>(values: T[]): T =>
        values[Math.floor(random() * values.length)]!;
      const insertHobby = db.prepare(
        "INSERT OR IGNORE INTO hobbies(value) VALUES (?)",
      );
      for (const hobby of hobbies) insertHobby.run(hobby);
      const hobbyIds = hobbies.map(
        (value) =>
          (
            db.prepare("SELECT id FROM hobbies WHERE value = ?").get(value) as {
              id: number;
            }
          ).id,
      );
      const insertUser = db.prepare(`
      INSERT INTO users(id, avatar, first_name, last_name, age, nationality)
      VALUES (@id, @avatar, @first_name, @last_name, @age, @nationality)
    `);
      const insertLink = db.prepare(
        "INSERT INTO user_hobbies(user_id, hobby_id) VALUES (?, ?)",
      );

      for (let id = 1; id <= count; id++) {
        const first = pick(firstNames);
        const last = pick(lastNames);
        insertUser.run({
          id,
          avatar: avatar(first, last, id),
          first_name: first,
          last_name: last,
          age: 18 + Math.floor(random() * 63),
          nationality: pick(nationalities),
        });
        // Cycling guarantees coverage of 0–10 hobbies for any seed with >= 11 users.
        const hobbyCount = (id - 1) % 11;
        const available = [...hobbyIds];
        for (let index = 0; index < hobbyCount; index++) {
          const selected = Math.floor(random() * available.length);
          const [hobbyId] = available.splice(selected, 1);
          insertLink.run(id, hobbyId!);
        }
      }
      return { inserted: true, count };
    })
    .immediate();
};
