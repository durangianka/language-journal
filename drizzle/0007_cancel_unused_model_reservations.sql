ALTER TABLE "model_calls" DROP CONSTRAINT "model_calls_outcome_valid";--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_outcome_valid" CHECK ("model_calls"."outcome" in ('reserved', 'running', 'ready', 'failed', 'cancelled'));
--> statement-breakpoint
-- Existing installations and roles provisioned before the tables existed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'journal_app') THEN
    GRANT DELETE ON public.journal_mistake_counts TO journal_app;
  END IF;
END
$$;
