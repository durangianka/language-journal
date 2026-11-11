# Repository agent skills

Claude Code reads `.claude/skills/<name>/SKILL.md`. Codex reads
`.agents/skills/<name>/SKILL.md`. Both contain regular project-local copies so a
Windows checkout needs no junctions or symlink privileges. The duplicated copies
must be updated together. User-level skills were not modified.

## Sources and installation

The commands below were confirmed with `npx skills --help` (skills 1.8.1) and run
from the repository root. Omitting `--global` selects project scope. `--copy`
avoids links to machine-specific folders. `skills-lock.json` records upstream
source paths and hashes, before the local adaptations described below.

```sh
npx skills add shadcn-ui/ui --skill shadcn --agent claude-code codex --copy --yes
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices --agent claude-code codex --copy --yes
npx skills add upstash/context7 --skill context7-mcp --agent claude-code codex --copy --yes
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices --agent claude-code codex --copy --yes
```

Review the current upstream files before rerunning installation. Reinstallation
replaces local adaptations. Reapply those adaptations in both copies and review
the diff before committing. Do not run an unattended update.

| Owner/repository         | Skill page                                                                                                   | Teaches                                                               | Script or install instructions                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| shadcn-ui/ui             | [shadcn](https://skills.sh/shadcn-ui/ui/shadcn)                                                              | Component selection, composition, styling and CLI workflow            | Recommends CLI queries and component installs; bundles a local, read-only showcase coverage script |
| vercel-labs/agent-skills | [vercel-react-best-practices](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices)        | React and Next.js performance rules                                   | No script execution or installation step in SKILL.md; examples mention optional libraries          |
| upstash/context7         | [context7-mcp](https://skills.sh/upstash/context7/context7-mcp)                                              | Resolve library IDs, query current docs and optionally inspect source | Calls MCP tools; no scripts or install step in SKILL.md                                            |
| supabase/agent-skills    | [supabase-postgres-best-practices](https://skills.sh/supabase/agent-skills/supabase-postgres-best-practices) | Postgres queries, schema, indexes, connections, locking and RLS       | No scripts or install step in SKILL.md; reference SQL is guidance, not a migration to execute      |

## Context7 comparison

| Option                                  | Current library docs                                                | Setup and trade-off                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Skill only                              | Cannot retrieve docs alone                                          | Lightweight instructions, but depends on pre-existing MCP tools                                                  |
| MCP for Claude Code and Codex, selected | Resolves libraries and queries docs through the same hosted service | User-level setup plus lookup skill; requires connectivity and authentication                                     |
| Context7 CLI                            | `npx ctx7@latest library` and `docs` query the service              | Useful in shells, but adds package execution and CLI authentication without benefiting the selected MCP workflow |

Use MCP for Next.js, Drizzle ORM, Vercel AI SDK, Zod and Playwright even when no
library-specific skill is installed. Resolve the library name first, prefer the
official source and matching version, then query one concept at a time. Coverage
and individual library results still need checking when used.

Context7 is set up per user with `npx ctx7 setup`, and the key lives in the environment, not in the repo.

## Review and local adaptations

All four upstream SKILL.md files were read before installation. Both installed
copies were reviewed. No skill instructs agents to change commit trailers, PR
attribution, branch/worktree restrictions or to merge a PR. Repository rules
remain authoritative.

- Upstream prose contains em-dashes. Replaced them with commas in both copies.
- The shadcn skill embeds an automatic `npx shadcn@latest info --json` shell
  directive. Removed it and substituted an explicit `pnpm exec shadcn info
--json` instruction using the installed local CLI. No network command runs
  just by loading the skill. Its other documented CLI examples can install
  components when that work is requested; use this project's pnpm runner.
- The only bundled executable is `shadcn/scripts/showcase-coverage.mjs`. It
  imports Node filesystem/path modules, reads local files and reports coverage.
  It neither downloads nor runs remote code. No remote-executing script was
  committed. Showcase assets are examples, excluded from application linting.
- Postgres guidance is useful without Supabase: indexes, EXPLAIN, pooling,
  transactions, schema and native RLS all apply. `auth.uid()` and roles such as
  `anon`, `authenticated` and `service_role` are Supabase examples. They are not
  provided by plain Postgres and must not be copied into this app unchanged.
- The shared `~/.claude/skills` folder already contains
  `vercel-react-best-practices` and `supabase-postgres-best-practices`. The
  session also exposes shadcn and context7-mcp from `~/.agents/skills`.
  Project copies therefore duplicate existing machine capabilities. They make
  the same guidance available to collaborators; global and project copies may
  drift or appear as duplicate names in selectors.

No requested skill was rejected. CLI-only Context7 and skill-only Context7 were
rejected as documentation access strategies for the reasons in the table.

## File tree and discovery

```text
.agents/skills/                     # Codex
  context7-mcp/SKILL.md
  shadcn/                          # SKILL.md, rules, references, assets, local script
  supabase-postgres-best-practices/ # SKILL.md and references
  vercel-react-best-practices/      # SKILL.md, compiled AGENTS.md and rules
.claude/skills/                     # Claude Code, same four directories and files
CLAUDE.md                          # Only @AGENTS.md
skills-lock.json
```

Use `npx skills list --agent claude-code` and `npx skills list --agent codex`
to inspect project installs. Both commands listed the four skills after install.
Actual activation in fresh agent sessions is unverified.

The single-line `@AGENTS.md` import is explicitly documented by
[Claude Code](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools).
Its syntax is confirmed from official documentation; runtime loading in a fresh
Claude session remains unverified. Codex project discovery is documented in
[Build skills](https://developers.openai.com/codex/skills/).
