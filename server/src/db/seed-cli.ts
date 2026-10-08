import { parseArgs } from 'node:util';
import { openDatabase, resolveDatabasePath } from './connection.js';
import { DEFAULT_SEED_COUNT, seedDatabase } from './seed.js';

try {
  const { values } = parseArgs({
    options: {
      count: { type: 'string', default: String(DEFAULT_SEED_COUNT) },
      seed: { type: 'string', default: '42' },
      reset: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  const path = resolveDatabasePath();
  const db = openDatabase(path);
  try {
    const result = seedDatabase(db, {
      count: Number(values.count),
      seed: Number(values.seed),
      reset: values.reset,
    });
    console.log(
      result.inserted
        ? `Seeded ${result.count} users (seed ${values.seed}) into ${path}`
        : `Kept ${result.count} existing users in ${path}. Use --reset to replace them.`,
    );
  } finally {
    db.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
