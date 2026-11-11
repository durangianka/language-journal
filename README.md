# Language Journal

## Prerequisites

- Node.js 24 LTS
- pnpm 11.6.0 (the version pinned in `package.json`)
- Docker with Docker Compose, running Linux containers

## Setup

Clone the repository, open a terminal in its root, and install dependencies:

```sh
pnpm install
```

Copy `.env.example` to `.env` using your editor or file manager. On PowerShell:

```powershell
Copy-Item .env.example .env
```

The example credentials are for the local development database. If you change
`POSTGRES_USER`, `POSTGRES_PASSWORD`, or `POSTGRES_DB`, also update `DATABASE_URL`.
Leave `AI_PROVIDER_API_KEY` empty until a provider is chosen.

Start Postgres on host port 5433 and run the app:

```sh
pnpm db:up
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. The home page is a development placeholder.
Postgres data persists in a named Docker volume. `docker compose down` stops it.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Install Chromium once, then run the browser smoke test:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser test builds and starts its own production server on port 3100.
It needs neither a running database nor an AI key.

For schema changes, `pnpm db:generate` writes migrations to `drizzle/`
and `pnpm db:migrate` applies them using `DATABASE_URL`.

`pnpm test` runs unit tests without a database. Run the database integration test
separately after starting Postgres and applying migrations:

```sh
pnpm db:up
pnpm db:migrate
pnpm test:integration
```

The integration test uses `DATABASE_URL` from the environment or `.env`, creates
its own journal and entries, and deletes them even if an assertion fails.

## Architecture

`src/db/schema.ts` defines journals and entries. `src/lib/journal` provides
server-only create, list, and get functions, with Zod input schemas in
`schemas.ts` and plain return types in `types.ts`. Lookups return `null` when
the ID does not exist. Lists return arrays, including an empty array when there
are no matches. Entries are ordered by entry date descending, then creation time
descending. Timestamps are ISO strings; entry dates are `YYYY-MM-DD` strings.
An omitted entry date defaults to the app server's local calendar date when the
input is parsed. Entry bodies preserve the learner's whitespace and allow up to
5000 Unicode code points. No update operation is exposed yet; `updated_at`
starts at creation time.
