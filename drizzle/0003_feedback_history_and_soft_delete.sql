-- Check again under a lock before lowering the limit. Never truncate learner text.
LOCK TABLE "entries" IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "entries" WHERE char_length("body") > 2000) THEN
    RAISE EXCEPTION 'Cannot lower entry limit: existing entries exceed 2000 characters';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"analysed_text" text NOT NULL,
	"locale" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason_code" text,
	"corrected_text" text,
	"corrections" jsonb,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_locale_valid" CHECK ("feedback"."locale" in ('en', 'es', 'it')),
	CONSTRAINT "feedback_status_valid" CHECK ("feedback"."status" in ('pending', 'ready', 'failed')),
	CONSTRAINT "feedback_attempts_valid" CHECK ("feedback"."attempts" between 0 and 3),
	CONSTRAINT "feedback_text_limit" CHECK (char_length("feedback"."analysed_text") <= 2000 and char_length("feedback"."corrected_text") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "journal_mistake_counts" (
	"journal_id" uuid NOT NULL,
	"category" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "journal_mistake_counts_journal_id_category_pk" PRIMARY KEY("journal_id","category"),
	CONSTRAINT "journal_mistake_counts_category_valid" CHECK ("journal_mistake_counts"."category" in ('grammar', 'vocabulary', 'spelling', 'style')),
	CONSTRAINT "journal_mistake_counts_nonnegative" CHECK ("journal_mistake_counts"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "model_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"outcome" text NOT NULL,
	"reason_code" text,
	"duration_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_calls_kind_valid" CHECK ("model_calls"."kind" in ('analysis', 'retry', 'repair')),
	CONSTRAINT "model_calls_outcome_valid" CHECK ("model_calls"."outcome" in ('reserved', 'running', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_body_max_length";--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_mistake_counts" ADD CONSTRAINT "journal_mistake_counts_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_entry_created_idx" ON "feedback" USING btree ("entry_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "model_calls_feedback_idx" ON "model_calls" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "model_calls_entry_idx" ON "model_calls" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "model_calls_created_idx" ON "model_calls" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_body_max_length" CHECK (char_length("entries"."body") <= 2000);
