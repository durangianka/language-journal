import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { levels } from "../config/domain";
import { locales } from "../config/locales";

export const languageEnum = pgEnum("language", locales);
export const levelEnum = pgEnum("level", levels);

export const journals = pgTable(
  "journals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    language: languageEnum("language").notNull(),
    level: levelEnum("level").notNull(),
    focus: text("focus").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("journals_focus_max_three", sql`cardinality(${table.focus}) <= 3`),
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
  },
  (table) => [
    check("entries_body_not_blank", sql`${table.body} ~ '[^[:space:]]'`),
    check("entries_body_max_length", sql`char_length(${table.body}) <= 5000`),
    index("entries_journal_date_created_idx").on(
      table.journalId,
      table.entryDate.desc(),
      table.createdAt.desc(),
    ),
  ],
);
