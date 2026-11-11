CREATE TYPE "public"."language" AS ENUM('en', 'es', 'it');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('new', 'basic', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"body" text NOT NULL,
	"entry_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_body_not_blank" CHECK ("entries"."body" ~ '[^[:space:]]'),
	CONSTRAINT "entries_body_max_length" CHECK (char_length("entries"."body") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" "language" NOT NULL,
	"level" "level" NOT NULL,
	"focus" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journals_focus_max_three" CHECK (cardinality("journals"."focus") <= 3)
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_journal_date_created_idx" ON "entries" USING btree ("journal_id","entry_date" DESC NULLS LAST,"created_at" DESC NULLS LAST);