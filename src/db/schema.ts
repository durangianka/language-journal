import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { maxFocusByLevel } from "../config/focus";
import { languages, levels } from "../config/domain";
import { locales } from "../config/locales";
import { categories } from "../config/corrections";
import type { FeedbackOutput } from "../lib/ai/schema";
import { FEEDBACK_REASONS } from "../lib/feedback-contract";

export const languageEnum = pgEnum("language", languages);
export const levelEnum = pgEnum("level", levels);

export const journals = pgTable(
  "journals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    language: languageEnum("language").notNull(),
    level: levelEnum("level").notNull(),
    focus: text("focus")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "journals_focus_level_limit",
      sql`cardinality(${table.focus}) <= CASE ${table.level} ${sql.raw(
        Object.entries(maxFocusByLevel)
          .map(([level, limit]) => `WHEN '${level}' THEN ${limit}`)
          .join(" "),
      )} END`,
    ),
  ],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalId: uuid("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("entries_body_not_blank", sql`${table.body} ~ '[^[:space:]]'`),
    check("entries_body_max_length", sql`char_length(${table.body}) <= 2000`),
    index("entries_journal_date_created_idx").on(
      table.journalId,
      table.entryDate.desc(),
      table.createdAt.desc(),
    ),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    analysedText: text("analysed_text").notNull(),
    locale: text("locale", { enum: locales }).notNull(),
    status: text("status", { enum: ["pending", "ready", "failed"] })
      .notNull()
      .default("pending"),
    reasonCode: text("reason_code", { enum: FEEDBACK_REASONS }),
    correctedText: text("corrected_text"),
    corrections: jsonb("corrections").$type<FeedbackOutput["corrections"]>(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feedback_entry_created_idx").on(t.entryId, t.createdAt.desc()),
    check("feedback_locale_valid", sql`${t.locale} in ('en', 'es', 'it')`),
    check("feedback_status_valid", sql`${t.status} in ('pending', 'ready', 'failed')`),
    check("feedback_attempts_valid", sql`${t.attempts} between 0 and 3`),
    check(
      "feedback_text_limit",
      sql`char_length(${t.analysedText}) <= 2000 and char_length(${t.correctedText}) <= 2000`,
    ),
  ],
);

export const modelCalls = pgTable(
  "model_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedbackId: uuid("feedback_id").references(() => feedback.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "cascade" }),
    journalId: uuid("journal_id").references(() => journals.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["analysis", "retry", "repair", "insight"] }).notNull(),
    outcome: text("outcome", { enum: ["reserved", "running", "ready", "failed"] }).notNull(),
    reasonCode: text("reason_code", { enum: FEEDBACK_REASONS }),
    durationMs: integer("duration_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("model_calls_feedback_idx").on(t.feedbackId),
    index("model_calls_entry_idx").on(t.entryId),
    index("model_calls_created_idx").on(t.createdAt),
    index("model_calls_journal_idx").on(t.journalId),
    check("model_calls_kind_valid", sql`${t.kind} in ('analysis', 'retry', 'repair', 'insight')`),
    check(
      "model_calls_source_valid",
      sql`(${t.kind} = 'insight' and ${t.journalId} is not null) or (${t.kind} <> 'insight' and ${t.feedbackId} is not null and ${t.entryId} is not null)`,
    ),
    check(
      "model_calls_outcome_valid",
      sql`${t.outcome} in ('reserved', 'running', 'ready', 'failed')`,
    ),
  ],
);

export const jevCalls = pgTable(
  "jev_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
    questions: jsonb("questions").notNull(),
    answers: jsonb("answers"),
    confidence: doublePrecision("confidence"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("jev_calls_created_idx").on(t.createdAt),
    index("jev_calls_entry_idx").on(t.entryId),
  ],
);

export const journalInsights = pgTable(
  "journal_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalId: uuid("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    callId: uuid("call_id")
      .notNull()
      .references(() => modelCalls.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    locale: text("locale", { enum: locales }).notNull(),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("journal_insights_journal_day_idx").on(t.journalId, t.day),
    check("journal_insights_locale_valid", sql`${t.locale} in ('en', 'es', 'it')`),
  ],
);

export const journalMistakeCounts = pgTable(
  "journal_mistake_counts",
  {
    journalId: uuid("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    category: text("category", { enum: categories }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.journalId, t.category] }),
    check(
      "journal_mistake_counts_category_valid",
      sql`${t.category} in ('grammar', 'vocabulary', 'spelling', 'style')`,
    ),
    check("journal_mistake_counts_nonnegative", sql`${t.count} >= 0`),
  ],
);
