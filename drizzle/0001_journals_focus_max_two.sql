ALTER TABLE "journals" DROP CONSTRAINT "journals_focus_max_three";--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_focus_max_two" CHECK (cardinality("journals"."focus") <= 2);