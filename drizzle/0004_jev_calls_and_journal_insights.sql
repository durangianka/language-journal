CREATE TABLE "jev_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid,
	"questions" jsonb NOT NULL,
	"answers" jsonb,
	"confidence" double precision,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"day" date NOT NULL,
	"locale" text NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_insights_locale_valid" CHECK ("journal_insights"."locale" in ('en', 'es', 'it'))
);
--> statement-breakpoint
ALTER TABLE "model_calls" DROP CONSTRAINT "model_calls_kind_valid";--> statement-breakpoint
ALTER TABLE "model_calls" ALTER COLUMN "feedback_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "model_calls" ALTER COLUMN "entry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "model_calls" ADD COLUMN "journal_id" uuid;--> statement-breakpoint
ALTER TABLE "jev_calls" ADD CONSTRAINT "jev_calls_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_insights" ADD CONSTRAINT "journal_insights_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_insights" ADD CONSTRAINT "journal_insights_call_id_model_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."model_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jev_calls_created_idx" ON "jev_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jev_calls_entry_idx" ON "jev_calls" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_insights_journal_day_idx" ON "journal_insights" USING btree ("journal_id","day");--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_calls_journal_idx" ON "model_calls" USING btree ("journal_id");--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_source_valid" CHECK (("model_calls"."kind" = 'insight' and "model_calls"."journal_id" is not null) or ("model_calls"."kind" <> 'insight' and "model_calls"."feedback_id" is not null and "model_calls"."entry_id" is not null));--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_kind_valid" CHECK ("model_calls"."kind" in ('analysis', 'retry', 'repair', 'insight'));
--> statement-breakpoint
DELETE FROM journal_mistake_counts;
--> statement-breakpoint
INSERT INTO journal_mistake_counts (journal_id, category, count)
SELECT e.journal_id, c.value->>'category', count(*)::integer
FROM entries e JOIN journals j ON j.id = e.journal_id
JOIN feedback f ON f.entry_id = e.id
CROSS JOIN LATERAL jsonb_array_elements(coalesce(f.corrections, '[]'::jsonb)) c
WHERE e.deleted_at IS NULL AND j.deleted_at IS NULL AND f.status = 'ready'
GROUP BY e.journal_id, c.value->>'category';
