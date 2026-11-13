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
`POSTGRES_USER`, `POSTGRES_PASSWORD`, or `POSTGRES_DB`, also update `DATABASE_URL`
and `TEST_DATABASE_URL` (keeping its database name `journal_test`).
Leave `AI_PROVIDER_API_KEY` empty until a provider is chosen.

Start Postgres on host port 5433 and run the app:

```sh
pnpm db:up
pnpm db:migrate
pnpm dev
```

Both `pnpm dev` and `pnpm start` bind only to `APP_HOST`, which defaults to
`100.66.182.87`, the owner's Tailscale address. Open <http://100.66.182.87:3000>
on this computer or a phone connected to the same Tailscale network.
The Tailscale interface must be available when starting with the default address.
Set `APP_HOST=127.0.0.1` in `.env` or your shell for access only on this computer:

```powershell
$env:APP_HOST = "127.0.0.1"
pnpm dev
```

Then open <http://127.0.0.1:3000>. Browser tests set this loopback override themselves.
Postgres data persists in a named Docker volume. `docker compose down` stops it.

## Checks

Run `pnpm format` to format files. Prettier uses its defaults with a print width of 100.
ESLint keeps the Next.js Core Web Vitals and TypeScript rules, and fails on warnings.

```sh
pnpm format:check
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

The browser tests build and start their own production server on port 3100.
They need a running Postgres container, but no AI key.

For schema changes, `pnpm db:generate` writes migrations to `drizzle/`
and `pnpm db:migrate` applies them using `DATABASE_URL`.

## Test layers and database isolation

- `pnpm test`: unit tests with mocked external dependencies. Database clients,
  sockets and fetch are blocked unless a test supplies its own mock.
- `pnpm test:integration`: real Postgres and repository code, with no browser.
- `pnpm test:e2e`: the real app, Chromium, server actions and Postgres, with no
  mocked responses. The app server receives `TEST_DATABASE_URL` as `DATABASE_URL`.

Start Postgres before running either database suite:

```sh
pnpm db:up
pnpm test:integration
pnpm test:e2e
```

Both database suites load `DATABASE_URL` and `TEST_DATABASE_URL` from the environment
or `.env`. Set `TEST_DATABASE_URL=postgres://journal:journal@localhost:5433/journal_test`
for the default local container. Setup creates the database if missing, applies the
committed Drizzle migrations and empties its public tables before every run and
again at teardown. Migration history is preserved. The database user needs
`CREATEDB` permission for the first run (the local container user has it).

Startup refuses missing URLs, a database name without the `_test` suffix, the same
database name as development (even with different credentials or loopback aliases),
a different server or port, and URL query parameters that could override the target.
No development tables are reset. Run database suites one at a time because they
share `journal_test`. An interrupted run is cleaned at the next startup. Playwright
never reuses an existing app server and uses one worker for shared database failure tests.

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
