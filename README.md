# Presight Frontend Exercise

Build a small full-stack user directory application. The goal is to evaluate how you design a searchable, filterable, paginated UI backed by persisted data and clear API boundaries.

The application should include:

- A React client.
- A Node.js API server.
- A SQLite database used as the source of truth for user data.
- Docker configuration for running the application locally.

## Scenario

Users need to browse a large directory of people, search by name, and narrow results by nationality and hobbies. The filter sidebar should help users discover useful filters based on the result set they are currently viewing.

## Requirements

### Data Model

Seed a SQLite database with enough records to make pagination, infinite scroll, search, and filter counts meaningful.

Each user should have:

- `avatar`
- `first_name`
- `last_name`
- `age`
- `nationality`
- `hobbies`, from 0 to 10 hobbies per user

Choose a data model that supports the required behavior.

SQLite must be the persisted source of user data.

### API

Expose an API that supports:

- Paginated user results.
- Text filtering from user input across `first_name` and `last_name`.
- Filtering by one or more nationalities.
- Filtering by one or more hobbies.
- Sorting by `first_name`, `last_name`, `age`, and `nationality`.
- Pagination metadata so the client can determine whether more results are available.
- Top 20 hobbies for the active text filter and filter state, including `{ value, count }`.
- Top 20 nationalities for the active text filter and filter state, including `{ value, count }`.

The top 20 values and counts must reflect the currently applied text filter and selected filters, not the global dataset.

Filter semantics:

- Multiple selected hobbies should match users who have all selected hobbies.
- Multiple selected nationalities should match users from any selected nationality.
- Text, hobby, and nationality filters should apply together.

Sorting semantics:

- Sorted results must be deterministic. Use `id` as a final tie-breaker when values are equal.
- Pagination must respect the active sort without duplicate or missing users.

### Client

Build a React interface that includes:

- A text filter input for `first_name` and `last_name`.
- A virtualized, infinitely scrolling list of user cards.
- A sidebar containing the top 20 hobbies and top 20 nationalities for the current result set, including counts.
- Controls for applying and removing hobby and nationality filters.
- Controls for choosing sort field and sort direction.
- Loading, empty, and error states.
- A responsive layout that remains usable on desktop and mobile.

User cards should follow this structure:

```text
|----------------------------------|
| avatar      first_name+last_name |
|             nationality      age |
|                                  |
|             (2 hobbies) (+n)     |
|----------------------------------|
```

Show up to 2 hobbies on the card. If the user has more hobbies, display the remaining count as `+n`.

Use a virtual scroll implementation for the list.

When the text filter or selected filters change, the client must refresh both:

- The paginated user list.
- The top 20 hobbies and nationalities in the sidebar.

The text filter value, selected hobbies, selected nationalities, sort field, and sort direction must be reflected in the URL query string. Reloading or sharing the URL should restore the same view state.

## Implementation Notes

- Keep the database setup easy to run locally.
- Include seed logic or a documented command that creates the SQLite database.
- Include a `Dockerfile` and `docker-compose.yml` that can run the application locally.

## Evaluation Focus

We will pay particular attention to:

- Correct data persistence and API behavior.
- Correct filtering, sorting, pagination, and top 20 counts.
- Smooth infinite scrolling with virtualization.
- URL-synced state.
- Clear loading, empty, and error states.
- Easy local and Docker-based setup.

## Deliverables

Please provide:

- Source code for the React client and Node.js server.
- A `Dockerfile` and `docker-compose.yml`.
- Instructions for setup, database seeding, and running locally.
- Instructions for running with Docker Compose.

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
yarn db:seed --reset --count 2000 --seed 42
```

The default database is `server/data/directory.sqlite`. Seeding creates 2,000 users and
preserves existing data unless `--reset` is supplied. Set `DATABASE_PATH` to use another
database; relative paths resolve from `server/`. Use the same value for seeding and running.
Avatar fields contain deterministic DiceBear URLs based on user IDs, so displaying avatars
requires internet access from the browser.

Check the application with `yarn test`, `yarn typecheck`, and `yarn build`.

See [API reference](docs/api.md) for endpoint requests, responses, defaults, filtering
semantics, pagination, and errors.

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
docker compose exec app node server/dist/db/seed-cli.js --reset --count 2000 --seed 42
```

To verify persistence, edit a test record, recreate the container, and query it again:

```sh
docker compose exec app node -e "const db = require('better-sqlite3')(process.env.DATABASE_PATH); db.prepare('UPDATE users SET first_name = ? WHERE id = 1').run('PersistenceCheck'); db.close()"
docker compose up -d --force-recreate --wait
curl 'http://localhost:3001/api/users/search' -H 'Content-Type: application/json' -d '{"q":"PersistenceCheck"}'
```

The response should still contain user `1`. The reset command above restores the seed data.
