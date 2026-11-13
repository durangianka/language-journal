import "server-only";
import { sql } from "drizzle-orm";
import type { db } from "../../db/client";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Caller holds the journal row lock, also used by feedback completion and deletion.
export async function refreshMistakeCounts(tx: Transaction, journalId: string) {
  await tx.execute(sql`delete from journal_mistake_counts where journal_id = ${journalId}`);
  await tx.execute(sql`
    insert into journal_mistake_counts (journal_id, category, count)
    select e.journal_id, c.value->>'category', count(*)::integer
    from entries e join journals j on j.id = e.journal_id
    join lateral (
      select id, corrections from feedback
      where entry_id = e.id and status = 'ready'
      order by created_at desc, id desc
      limit 1
    ) f on true
    cross join lateral jsonb_array_elements(coalesce(f.corrections, '[]'::jsonb)) c
    where e.journal_id = ${journalId} and e.deleted_at is null and j.deleted_at is null
    group by e.journal_id, c.value->>'category'
  `);
}
