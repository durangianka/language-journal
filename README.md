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

For future schema changes, `pnpm db:generate` writes migrations to `drizzle/`
and `pnpm db:migrate` applies them using `DATABASE_URL`. There are no tables or
migrations in this scaffold, so neither command is needed for setup.

## Architecture

to be written
