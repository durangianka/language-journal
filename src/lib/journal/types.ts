import type { CreateJournalInput } from "./schemas";

export interface Journal {
  id: string;
  language: CreateJournalInput["language"];
  level: CreateJournalInput["level"];
  focus: string[];
  createdAt: string;
}

export interface Entry {
  id: string;
  journalId: string;
  body: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}
