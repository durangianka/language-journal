import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../src/db/client", async () => {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // One connection keeps SET ROLE in effect for every real repository operation.
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  return { client, db: drizzle({ client }) };
});

import { client, db } from "../../src/db/client";
import { modelCalls } from "../../src/db/schema";
import {
  beginFeedback,
  feedbackStore,
  listFeedback,
  refuseNonLanguageFeedback,
} from "../../src/lib/ai/repository";
import { runFeedback } from "../../src/lib/ai/service";
import {
  createEntry,
  createJournal,
  deleteEntry,
  deleteJournal,
  getEntry,
  getJournal,
  getJournalMistakeCounts,
  restoreDeleted,
} from "../../src/lib/journal";

const admin = postgres(process.env.DATABASE_URL!, { max: 1 });
const suffix = randomUUID().replaceAll("-", "");
const appRole = `batch_a_app_${suffix}`;
const migrationRole = `batch_a_migration_${suffix}`;
let owner: string;
let schemaOwner: string;
const ids: string[] = [];

beforeAll(async () => {
  const [current] = await admin`select current_user as owner,
    (select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'public') as schema_owner`;
  owner = current.owner;
  schemaOwner = current.schema_owner;
  const [database] = await admin`select current_database() as name`;
  // Execute the shipped provisioning transaction, replacing only cluster-global role
  // names and the three psql gexec statements. Never touch development or other roles.
  const script = readFileSync("scripts/db-roles.sql", "utf8");
  const transaction = script
    .slice(script.indexOf("BEGIN;"), script.lastIndexOf("COMMIT;") + 7)
    .replaceAll(/\bjournal_app\b/g, appRole)
    .replaceAll(/\bjournal_migration\b/g, migrationRole)
    .replace(
      /^SELECT format\('REVOKE ALL ON DATABASE.*\\gexec\r?$/m,
      `REVOKE ALL ON DATABASE "${database.name}" FROM PUBLIC;`,
    )
    .replace(
      /^SELECT format\('GRANT CONNECT ON DATABASE.*\\gexec\r?$/m,
      `GRANT CONNECT ON DATABASE "${database.name}" TO "${appRole}";`,
    )
    .replace(
      /^SELECT format\('GRANT CONNECT, CREATE ON DATABASE.*\\gexec\r?$/m,
      `GRANT CONNECT, CREATE ON DATABASE "${database.name}" TO "${migrationRole}";`,
    );
  await admin.unsafe(transaction);
  await client.unsafe(`SET ROLE "${appRole}"`);
});

afterAll(async () => {
  await client.unsafe("RESET ROLE");
  await client.end();
  for (const id of ids) await admin`delete from journals where id = ${id}`;
  await admin.unsafe(`REASSIGN OWNED BY "${migrationRole}" TO "${owner}"`);
  await admin.unsafe(`ALTER SCHEMA public OWNER TO "${schemaOwner}"`);
  await admin.unsafe(`DROP OWNED BY "${appRole}", "${migrationRole}"`);
  await admin.unsafe(`DROP ROLE "${appRole}"; DROP ROLE "${migrationRole}"`);
  await admin.end();
});

test("restricted app role completes feedback, refuses, soft deletes and restores", async () => {
  expect((await client`select current_user as name`)[0].name).toBe(appRole);
  const journal = await createJournal({ language: "en", level: "basic", focus: [] });
  ids.push(journal.id);
  const entry = await createEntry({ journalId: journal.id, body: "I goed home." });
  const job = await beginFeedback(entry.id, "en");
  await runFeedback(job, feedbackStore, {
    generate: async () => ({
      text: JSON.stringify({
        corrected_text: "I went home.",
        corrections: [
          {
            original: "goed",
            fix: "went",
            category: "grammar",
            explanation: "Use the irregular past tense when describing a finished action.",
          },
        ],
      }),
      inputTokens: 10,
      outputTokens: 20,
    }),
  });
  expect((await listFeedback(entry.id))[0].status).toBe("ready");
  expect(await getJournalMistakeCounts(journal.id)).toEqual([{ category: "grammar", count: 1 }]);
  const refused = await beginFeedback(entry.id, "en");
  await refuseNonLanguageFeedback(refused);
  expect((await listFeedback(entry.id)).find((item) => item.id === refused.id)).toMatchObject({
    reason: "not_language_text",
    status: "failed",
  });
  expect(await db.select().from(modelCalls).where(eq(modelCalls.id, refused.callId))).toMatchObject(
    [{ outcome: "cancelled" }],
  );
  await deleteEntry(entry.id, "soft");
  expect(await getEntry(entry.id)).toBeNull();
  expect(await getJournalMistakeCounts(journal.id)).toEqual([]);
  await restoreDeleted(entry.id, "entry");
  expect(await getEntry(entry.id)).not.toBeNull();
  expect(await getJournalMistakeCounts(journal.id)).toEqual([{ category: "grammar", count: 1 }]);
  await deleteJournal(journal.id, "soft");
  expect(await getJournal(journal.id)).toBeNull();
  await restoreDeleted(journal.id, "journal");
  expect(await getJournal(journal.id)).not.toBeNull();
  expect(await getJournalMistakeCounts(journal.id)).toEqual([{ category: "grammar", count: 1 }]);
  expect(
    (await client`select has_table_privilege(current_user, 'model_calls', 'DELETE') as allowed`)[0]
      .allowed,
  ).toBe(false);
  await expect(db.delete(modelCalls).where(eq(modelCalls.id, job.callId))).rejects.toThrow();
});

test("migration repairs the count DELETE grant for an existing restricted role", async () => {
  await admin.unsafe(`REVOKE DELETE ON public.journal_mistake_counts FROM "${appRole}"`);
  expect(
    (
      await client`select has_table_privilege(current_user, 'journal_mistake_counts', 'DELETE') as allowed`
    )[0].allowed,
  ).toBe(false);
  const migration = readFileSync(
    "drizzle/0007_cancel_unused_model_reservations.sql",
    "utf8",
  ).replaceAll(/\bjournal_app\b/g, appRole);
  await admin.unsafe(migration);
  expect(
    (
      await client`select has_table_privilege(current_user, 'journal_mistake_counts', 'DELETE') as allowed`
    )[0].allowed,
  ).toBe(true);
  const journal = await createJournal({ language: "en", level: "basic", focus: [] });
  ids.push(journal.id);
  const entry = await createEntry({ journalId: journal.id, body: "Keep this writing." });
  await deleteEntry(entry.id, "soft");
  await restoreDeleted(entry.id, "entry");
  expect((await getEntry(entry.id))?.body).toBe("Keep this writing.");
});
