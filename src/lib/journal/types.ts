import type { CreateJournalInput } from "./schemas";
import type { EntryDto } from "../feedback-contract";

export interface Journal {
  id: string;
  language: CreateJournalInput["language"];
  level: CreateJournalInput["level"];
  focus: string[];
  createdAt: string;
}

export type Entry = EntryDto;
