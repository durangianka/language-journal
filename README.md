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
Set `OPENAI_API_KEY` to enable saved-entry feedback and journal summaries.
Set `JEV_API_KEY` to enable the optional Jev checks described below.

Start Postgres on host port 5433 and run the app:

```sh
pnpm db:up
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. The home page is a development placeholder.
Postgres data persists in a named Docker volume. `docker compose down` stops it.

## AI providers and writing privacy

Live checks are on by default in each editor. Pausing for 2.5 seconds or leaving
the writing field sends the current draft to the app's `/api/jev` route. With
`JEV_API_KEY` configured, that route sends the full text to Jev (`jev-latest` at
`api.typesafe.ai`) to classify possible issues. The **Live checks** switch beside
the editor turns automatic checks off, cancels a waiting check and ignores any
result already in flight. A request already sent cannot be recalled. Discarding
a draft does not undo a transmission.

Saving a new entry automatically requests feedback. Feedback requests, including
manual retries, send the saved text to Jev for a language check when configured,
even when live checks are off. Jev outages fail open. Correction feedback and
journal summaries use OpenAI's Responses API with `gpt-6-luna`, configured by
the server-only `OPENAI_API_KEY`. Feedback includes the saved text snapshot,
journal language, level, focus and feedback preferences. Summaries include up to
10 active entries. OpenAI requests set `store: false`; provider-side processing
and retention remain subject to the provider's terms. Neither key is sent to
the browser.

Feedback JSON has a 4,096-output-token budget per model call and a 20-second
timeout. One SDK retry and one invalid-output repair share the existing metered
call cap. Pending feedback expires after two minutes and is marked failed on
the next read or request, including after a server restart. Retry is available
within the three-request entry limit and shared 50-model-call daily limit.
Successful feedback stays visible alongside a later failed attempt, with the
original writing snapshot that produced it.

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
