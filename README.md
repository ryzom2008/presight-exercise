# People Directory

A searchable directory of people. The React client filters by name, nationality, and hobbies, and scrolls a virtualized list. A Node.js API and SQLite database store the directory.

The server repository uses Drizzle ORM with the existing `better-sqlite3` connection.
`server/src/db/tables.ts` maps database columns to typed objects; `queryBuilder.ts`
combines filters with `and`, `or`, and `inArray`, and `repositories/users.ts` fetches
pages and counts. Drizzle binds input values automatically. Name search uses a small
parameterized SQL expression for full names and literal wildcard escaping.
Database creation and migrations remain in `server/src/db/schema.ts`; the table
mappings are not a replacement for its constraints, indexes, or triggers.

- [Exercise brief](docs/exercise.md)
- [API reference](docs/api.md)

## Run locally

Use Node.js 22 (see `.nvmrc`) and the Yarn version pinned in `package.json`.

From the repository root:

```sh
corepack enable
yarn install --immutable
yarn db:seed
```

In two terminals:

```sh
yarn dev:client
yarn dev:server
```

Open http://localhost:5173.

```sh
# Replace the directory (deletes existing directory data).
yarn db:seed --reset --count 10000 --seed 42
```

The default database is `server/data/directory.sqlite`. Seeding creates 10,000 users and
preserves existing data unless `--reset` is supplied. Set `DATABASE_PATH` to use another
database; relative paths resolve from `server/`. Use the same value for seeding and running.
Avatar fields contain stable [Pravatar](https://www.pravatar.cc/) photo URLs based on user IDs
(`https://i.pravatar.cc/400?u=presight-1`), so displaying avatars requires internet access
from the browser. Photos may repeat across users.

Check the application with `yarn test`, `yarn typecheck`, and `yarn build`.

Client and server validation limits live in `shared/index.js`, with TypeScript declarations
and API types in `shared/index.d.ts`. The shared package needs no compilation step: Vite
bundles its constants for the client, and Node loads them at runtime on the server.
The Docker image includes the shared package as a production dependency.

## Run with Docker Compose

Start Docker Desktop (or Docker Engine with Compose), then run from the repository root:

```sh
docker compose up --build -d --wait
```

Open http://localhost:3001. Express serves both the built React client and `/api`.
The first start seeds the database; later starts keep existing data. To use a different
host port, run `APP_PORT=8080 docker compose up --build -d --wait`.

```sh
docker compose logs -f app
docker compose down
```

SQLite is stored in the `directory-data` named volume, including its WAL files. Data
survives container recreation and `docker compose down`. `docker compose down -v`
deletes the volume and its data. Docker uses a separate database from local development.

```sh
# Replace the Docker directory (deletes existing directory data).
docker compose exec app node server/dist/db/seed-cli.js --reset --count 10000 --seed 42
```

To verify persistence, edit a test record, recreate the container, and query it again:

```sh
docker compose exec app node -e "const db = require('better-sqlite3')(process.env.DATABASE_PATH); db.prepare('UPDATE users SET first_name = ? WHERE id = 1').run('PersistenceCheck'); db.close()"
docker compose up -d --force-recreate --wait
curl 'http://localhost:3001/api/users/search' -H 'Content-Type: application/json' -d '{"q":"PersistenceCheck"}'
```

The response should still contain user `1`. The reset command above restores the seed data.
