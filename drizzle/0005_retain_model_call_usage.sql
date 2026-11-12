ALTER TABLE "model_calls" DROP CONSTRAINT "model_calls_source_valid";--> statement-breakpoint
ALTER TABLE "model_calls" DROP CONSTRAINT "model_calls_feedback_id_feedback_id_fk";
--> statement-breakpoint
ALTER TABLE "model_calls" DROP CONSTRAINT "model_calls_entry_id_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "model_calls" DROP CONSTRAINT "model_calls_journal_id_journals_id_fk";
--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_source_valid" CHECK (("model_calls"."kind" = 'insight' and "model_calls"."feedback_id" is null and "model_calls"."entry_id" is null) or ("model_calls"."kind" <> 'insight' and "model_calls"."journal_id" is null));
--> statement-breakpoint
-- Also support roles provisioned before the application tables existed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'journal_app') THEN
    GRANT DELETE ON public.journals, public.entries TO journal_app;
  END IF;
END
$$;
