# Language Journal

Language Journal helps one learner practise English, Spanish or Italian with short written entries and explained corrections.
Stage 1 is the write, get feedback, save and review loop: the app saves writing first, then offers a corrected version and up to three corrections.
The implementation also includes editing, a calendar, trash and restore, interface languages, feedback preferences, and a Stage 2 slice with recurring-category counts, journal summaries and a Jev pilot.

This is a local, single-user application with no login. Do not expose it publicly or add a second user before adding authentication and ownership checks (D-029).
For a ten-minute review, read this page, then the [documentation index](docs/README.md) and [decisions log](DECISIONS.md).
This handover describes `origin/main` at `35fdb92`, checked on 12 November 2026.

## Run locally

Prerequisites: Node.js 24 or newer, pnpm 11.6.0 as pinned in `package.json`, and Docker with Compose running Linux containers.
From the repository root:

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env`. In PowerShell:

```powershell
Copy-Item .env.example .env
```

Use the example's local database settings. If you change `POSTGRES_USER`, `POSTGRES_PASSWORD` or `POSTGRES_DB`, update `DATABASE_URL` and `TEST_DATABASE_URL` too.
Keep the test database separate, normally `journal_test`.
Set `OPENAI_API_KEY` for real feedback and summaries, and `JEV_API_KEY` for real Jev checks. Both keys stay on the server.
With blank keys, writing can still be saved; model feedback fails and Jev checks are unavailable.

```sh
pnpm db:up
docker compose exec db pg_isready -U journal -d journal
pnpm db:migrate
pnpm dev
```

The readiness command assumes the example credentials. Wait for Postgres to accept connections before migrating.
Open <http://localhost:3000>. Compose runs Postgres 17 on IPv4 loopback port 5433, avoiding a native Postgres on 5432.
Data persists in the `journal_data` volume. `docker compose down` stops the container without deleting that volume.
Changing credentials does not reconfigure an existing database volume.

The one-command setup script is planned and has not been built. `scripts/with-test-database.mjs` is a test command wrapper, not a setup script.
Schema changes use `pnpm db:generate` to create reviewable SQL in `drizzle/`, followed by `pnpm db:migrate`.
Migration `0003` refuses to lower the old entry length limit if existing entries exceed 2,000 characters. It does not truncate writing.

## Architecture and request boundaries

This is a layered Next.js App Router application, with a port and adapter for AI. It is not full hexagonal architecture or full domain-driven design.
There are no separate domain aggregates or independent backend service.

| Layer                      | Responsibility and source                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages and components       | `src/app/` renders routes; `src/components/` contains forms, review screens and feedback UI. Server rendering and Suspense wrap client interactions. |
| Server Actions             | `src/app/journals/*actions.ts`, settings and locale actions handle browser requests, validate input, call services and refresh affected UI.          |
| Server-only data functions | `src/lib/journal/`, AI and insight repositories perform reads, writes, transactions, caps and deletion checks. They return small DTOs to the UI.     |
| AI port and adapter        | `FeedbackProvider` and `FeedbackStore` in `src/lib/ai/` let the feedback service use the OpenAI SDK adapter or test fakes.                           |
| Jev adapter                | `src/lib/jev/` defines questions, validates answers, calls the decision API and records usage.                                                       |
| Database                   | `src/db/schema.ts`, the postgres.js client and committed Drizzle SQL migrations define Postgres storage.                                             |

A framework **Server Function** uses `"use server"`. A **Server Action** is a Server Function used for an action or mutation.
These functions are reachable through direct POST requests, even without clicking a rendered button. Each boundary must validate input and, once authentication exists, verify the caller's identity and ownership on every invocation.
Today actions validate form fields, IDs, locales and applicable resource relationships, directly or through the data layer. They do **not** authenticate a person or establish ownership. A valid UUID is not an identity check.

An ordinary function in a module importing `server-only`, such as `createEntry` in `src/lib/journal/index.ts`, runs inside the server and does not itself create an HTTP endpoint.
It may still be exposed through a calling action. Pages also call these data functions directly for reads.
The one explicit API route is `POST /api/jev` in `src/app/api/jev/route.ts`. It checks Origin against Host, validates its JSON and journal/entry relationship, and returns a judgement or `null`.
It has no user authentication either. There is no separate REST API for journal CRUD.

This boundary guidance was checked against the bundled Next.js 16.4.6 docs and [Next.js data security guidance](https://nextjs.org/docs/app/guides/data-security).

## Data model and limits

The [schema](src/db/schema.ts) and [migrations](drizzle/) define eight app tables. There is no users table.

| Table                    | Purpose                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `journals`               | Target language, level, ordered focus choices, creation time and soft-delete marker.                                                                |
| `entries`                | Original writing, journal ID, calendar date, timestamps and soft-delete marker.                                                                     |
| `feedback`               | Analysed text snapshot, interface locale, pending/ready/failed state, reason, corrected text, corrections, model, prompt version and attempt count. |
| `model_calls`            | Shared model-call ledger for analysis, retry, repair and insight, with outcomes, duration and available token counts.                               |
| `journal_mistake_counts` | Materialised category totals per journal, recomputed from all ready feedback on visible entries.                                                    |
| `jev_calls`              | Questions, answers, confidence and duration for Jev reservations and checks.                                                                        |
| `journal_insights`       | Summary and call reference, limited by a unique journal/day pair, with its generation locale.                                                       |
| `feedback_settings`      | One learner's tone, address and optional gender preference, constrained to singleton ID 1. Defaults are formal, neutral and unspecified.            |

The [shared contract](src/lib/feedback-contract.ts) caps entries at **2,000 Unicode code points**, **10 stored entries per journal**, **3 feedback requests per entry**, **3 corrections per feedback**, and **50 model calls per day**.
An explanation has at most 200 code points. Focus is optional: New allows one choice, Basic two, Intermediate and Advanced three.
The entry length and focus limits also have database constraints. Entry-count and call reservations use transactions and locks in the data layer.
Soft-deleted entries still occupy slots; permanent deletion frees their slots. Feedback failures also occupy feedback request slots.

Soft deletion marks journals and entries with `deleted_at` and hides them from normal reads. Trash can restore them.
Restoring a journal restores its deletion batch while preserving entries trashed earlier. An entry cannot be restored while its journal is deleted.
Hard deletion cascades to feedback, insights and category counts. Model and Jev call rows survive with nullable source references, so deletion does not reset usage limits.
The daily model budget uses the Europe/London calendar day and includes summaries, retry/repair calls and reservations.
See [database roles](docs/database-roles.md) for optional separate app and migration roles. Normal Compose setup does not provision or adopt them automatically.

## Feedback and Jev

`createEntryAction` saves first, then requests feedback. Failure to start feedback does not roll back the saved entry.
Later edits save without requesting new feedback. The learner can request feedback or retry from the entry view, within the same three-request cap.
Feedback keeps the text snapshot it analysed; editing does not rewrite old feedback.

The [feedback service](src/lib/ai/service.ts) uses OpenAI `gpt-6-luna` through the AI SDK Responses adapter and structured JSON output.
The prompt includes target language, level, ordered focus, interface locale and feedback preferences. Entry text is treated as untrusted data.
The prompt asks for corrected text in the target language and explanations in the selected English, Spanish or Italian interface locale.
Tone, address and gender preferences steer explanation wording. They are not intended to change which corrections are needed.

The [output validator](src/lib/ai/schema.ts) checks JSON, a strict Zod object, size and category limits, nonempty single-line explanations, exact original spans, and reliably detected explanation language using `eld`.
It does not prove pedagogical correctness or that a fix appears in the corrected full text.
Zero corrections are allowed. The SDK adapter requests `store: false`; this flag alone does not establish the provider's complete retention policy.

There is a 20-second generation timeout, at most one SDK retry and one validation repair, with at most three metered calls per feedback request.
Each extra call needs a daily-budget reservation. Token counts are recorded when available; failures can have null counts.
Work runs after the action response through Next.js `after`, and the entry screen polls the persisted state.

| State or reason       | Meaning                                                         |
| --------------------- | --------------------------------------------------------------- |
| No feedback           | No stored feedback record is available.                         |
| `pending`             | A feedback request was persisted and work has been scheduled.   |
| `ready`               | Output passed the app's checks and was stored.                  |
| `failed`              | Processing failed; the saved entry remains.                     |
| `timeout`             | Generation exceeded its timeout.                                |
| `provider_error`      | Provider/configuration failure, including a missing OpenAI key. |
| `invalid_output`      | Output remained invalid after the available repair.             |
| `daily_cap_reached`   | The shared daily model budget prevented a reservation.          |
| `entry_limit_reached` | The entry already has three feedback records.                   |
| `too_long`            | The saved text exceeds the feedback limit.                      |
| `not_language_text`   | The Jev language gate refused the text.                         |

Action results can also report `validation` or `unknown`. A preflight refusal need not create a feedback row or a new failed state in storage.

Jev has two roles. While writing, blur or a 2.5-second typing pause requests a main-issue judgement through `/api/jev`.
Text shorter than eight trimmed characters and unchanged drafts are skipped. A low-confidence issue becomes `uncertain`; missing or failed checks return no note and do not block saving.
This judgement makes no OpenAI call. Its severity answer is logged; the badge uses the main issue.

Before saved text reaches the feedback model, a separate Jev question classifies its meaning in the target language.
Standard, informal and meaningful mixed text pass. Formula-only, encoded, random and other-language text are refused, releasing the unused model reservation.
The failed feedback request still occupies a request slot. The gate does not impose a confidence threshold.
Jev has a three-second timeout and a separate 200-check daily cap, shared by judgements and language gates.
An unavailable, invalid or capped check allows feedback to proceed. This is a best-effort gate, not a guarantee that all non-language text is blocked.
Both roles use `jev-latest` via the server adapter.

## Stage 2 approach

The insight is to make repeated categories visible across entries, rather than generate a new agent loop.
The journal insight card shows up to three categories, counts all stored ready corrections on visible entries, and highlights a leading category after five total corrections.
Repeated feedback on the same entry contributes again. These are correction counts, not distinct mistakes, proficiency scores or evidence of learning progress.

An explicit summary action sends up to ten latest visible entries to `gpt-6-luna`, asking for learning patterns and one next step in the interface language.
It shares the daily model budget. There is one reservation per journal per London day across all locales; failure also consumes that daily opportunity.
The summary provider checks completion, nonblank text and a 2,000-character bound, with a 20-second timeout and no retries.
The three-sentence and language requirements are prompt instructions, without the feedback validator's language check.

The Jev pilot supplies an independent quick judgement and the language gate. It does not produce explained corrections.
Recorded live samples are in [Stage 2 results](docs/stage2-live-results.md) and [language-gate results](docs/jev-gate-live-results.md).
These are small historical observations, not owner approval or broad quality benchmarks.

## Testing and verification

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm exec prettier --check README.md docs/README.md
```

`pnpm format:check` checks the whole repository. `pnpm format` rewrites it, so use it only when that broader change is intended.
For database and browser suites, start Docker first:

```sh
pnpm db:up
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
```

| Layer                   | What it covers                                                                                                                                                             | What it does not cover                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`             | Unit schemas, prompts, actions, output validation, state transitions, SDK behaviour and Jev scheduling using fakes. Default database, socket and fetch access are blocked. | Real database constraints, a rendered browser, real provider quality or availability.                                                                                           |
| `pnpm test:integration` | Real Postgres repositories, migrations, limits, concurrency, deletion/restore, feedback persistence and insight counts with fake providers.                                | Browser behaviour or live provider responses.                                                                                                                                   |
| `pnpm test:e2e`         | Chromium, the real app, Server Actions and test Postgres. Flows include 375px touch emulation, feedback states, languages, calendar, trash, settings and larger layouts.   | Real OpenAI/Jev calls, other browser engines or physical phone keyboard behaviour. Providers are deterministic test adapters; some tests also seed data or intercept responses. |
| `pnpm test:live`        | Opt-in real provider samples for feedback, Jev and summaries. Flags select the checks below.                                                                               | Broad quality evaluation, normal browser flows or owner review. Without flags, the live tests skip.                                                                             |

Integration and browser setup create the test database if absent, apply committed migrations, then truncate its public tables before and after the suite.
Migration history remains. The first run needs a database user allowed to create the test database.
The URL guard requires a separate database ending in `_test`, on the same host/port, with no query or fragment overrides.
Run database suites one at a time. They share the test database.

Playwright starts its own production build/server on port 3100 and refuses an existing server.
It passes `TEST_DATABASE_URL` as the app's `DATABASE_URL`, enables fake providers and blanks both provider keys.
On PowerShell, `$env:PLAYWRIGHT_DEV_SERVER = '1'` selects the optional dev server on port 3117 instead. Clear it to return to production mode.

Live flags are `RUN_LIVE_AI=1` (two feedback calls), `RUN_STAGE2_LIVE=1` (six Jev checks and three summaries), and `RUN_JEV_GATE_LIVE=1` (six language-gate checks).
Enable only the intended check. The latter two require a migrated `journal_test`, use real call ledgers and rewrite their result documents.
Live configuration does not create, migrate or reset the database.
For example, after `pnpm test:integration` has prepared the database, run only the gate check in PowerShell:

```powershell
$env:RUN_JEV_GATE_LIVE = '1'
node scripts/with-test-database.mjs test:live
Remove-Item Env:RUN_JEV_GATE_LIVE
```

Set both provider keys for Stage 2. Feedback-only needs `OPENAI_API_KEY` and does not persist to Postgres.
The wrapper selects `journal_test`; live setup uses it as `DATABASE_URL`.
No live calls were made for this documentation handover.

## Trade-offs and scope

The [decisions log](DECISIONS.md) explains alternatives and superseding choices. It is append-only; older open items are historical where a later decision resolves them.

- One Next.js full-stack app reduces processes and deployment units. It uses server rendering and browser navigation and is not a pure SPA (D-023, D-028).
- Drizzle keeps SQL migrations reviewable and avoids client generation, at the cost of unfamiliarity for a Prisma user (D-003).
- Structured output suits one feedback object. The app owns reads, writes and limits; there is no model tool loop (D-005, D-020).
- English, Spanish and Italian now ship. Language and level are required; focus is optional and steers corrections. Intention is not collected (D-024, D-033 supersede earlier onboarding choices).
- Three displayed corrections keep the task small but can omit errors. There is no show-all mode. Explanations support three interface languages independently of the journal language (D-019).
- Writing is stored before model work. Feedback is automatic on initial creation, not on every edit/save. Later feedback is explicit and bounded (D-022 and current actions).
- The requested description of no Jev in the feedback path is not true of this revision: the language gate runs there. Jev still does not generate the corrections.
- Editing exists, but a guided rewrite-and-resubmit learning exercise remains a next step, outside Stage 1 core (D-026).
- No speaking, sharing, social features, streaks, progress charts or read-only AI tools are built (D-015, D-016, D-020).
- Copied shadcn components keep UI code reviewable. System fonts avoid build-time font downloads. Mobile-first Chromium coverage takes priority over desktop-only refinements (D-007, D-012, D-032).
- Authentication is deferred for the local single-person demo. Public access and a second user require it (D-029).

## Gaps and known limits

1. Single learner only: data and settings have no user association or tenant separation.
2. No authentication or ownership checks: pages, actions and the API cannot identify the caller.
3. One-command setup is planned but absent; installation, database startup and migrations are separate steps.
4. Owner review of live model quality is not evidenced in the repository; recorded samples do not establish approval.
5. Windows build cache locks are an environment risk named in the handover brief; their occurrence cannot be established from source code.
6. Jev is in the feedback path, contrary to the brief's requested omission; this README documents the implemented gate.
7. Initial save requests feedback automatically, so a blanket claim that all feedback is manual would be inaccurate.
8. The historical Stage 1 HTML contains old 5,000-character limits and future-action descriptions; use the current code and this README for implemented behaviour.
9. Feedback uses in-process post-response work, without a durable queue or an automatic stale-pending recovery worker.
10. Summary language and three-sentence quality are prompt requirements; code only checks completion, nonblank output and length.
11. The ten-entry UI gate counts visible entries, while the server also counts trash; the form can appear available before the server rejects a full journal.
12. The feedback response has no assumed-level field, although D-018 proposed showing one; the prompt receives the journal's level.
