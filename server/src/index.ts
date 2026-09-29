import { createApp } from './app.js';
import { openDatabase } from './db/connection.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const db = openDatabase();
const app = createApp(db, process.env.CLIENT_DIST_PATH);
const server = app.listen(port, () => {
  console.info(JSON.stringify({ event: 'server_started', port }));
});

server.on('error', (error) => {
  console.error(JSON.stringify({ event: 'server_error', errorType: error.name }));
  db.close();
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
