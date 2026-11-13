import {
  jevAnswersSchema,
  jevQuestions,
  feedbackJevQuestions,
  feedbackJevAnswersSchema,
  type JevAnswers,
  type JevNote,
  type JevQuestions,
  type TextKind,
} from "./contract";
import type { Locale } from "../../config/locales";
import { JevHttpError } from "./errors";

export interface JevClient {
  judge(text: string, signal: AbortSignal, questions?: JevQuestions): Promise<unknown>;
}
export interface JevStore {
  reserve(entryId: string | null, questions?: JevQuestions): Promise<string | null>;
  finish(id: string, answers: JevAnswers | null, durationMs: number): Promise<void>;
}
export const jevTimeoutMs = 3_000;

const refusedKinds: readonly TextKind[] = ["formula_or_numbers", "encoded", "random", "other_language"];

// The live badge asks the same language question as the save gate, in the journal language.
export async function judgeEntry(
  text: string,
  entryId: string | null,
  client: JevClient,
  store: JevStore,
  language: Locale,
): Promise<JevNote | null> {
  if (Array.from(text.trim()).length < 8 || Array.from(text).length > 2000) return null;
  const answers = await queryEntry(text, entryId, client, store, feedbackJevQuestions(language));
  const classification = answers?.text_kind;
  if (!classification || classification.confidence < 0.5) return null;
  if (refusedKinds.includes(classification.choice))
    return { issue: "not_language", confidence: classification.confidence };
  const main = answers?.main_issue;
  return main
    ? { issue: main.confidence >= 0.5 ? main.choice : "uncertain", confidence: main.confidence }
    : null;
}

// An unavailable check, including the daily Jev cap, must not block the learner.
export async function checkEntryLanguage(
  text: string,
  language: Locale,
  entryId: string | null,
  client: JevClient,
  store: JevStore,
): Promise<boolean> {
  const answers = await queryEntry(text, entryId, client, store, feedbackJevQuestions(language));
  const classification = answers?.text_kind;
  if (!classification || classification.confidence < 0.5) return true;
  const kind = classification.choice;
  return !kind || !refusedKinds.includes(kind);
}

async function queryEntry(
  text: string,
  entryId: string | null,
  client: JevClient,
  store: JevStore,
  questions: JevQuestions = jevQuestions,
): Promise<JevAnswers | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let id: string | null = null;
  let answers: JevAnswers | null = null;
  const start = Date.now();
  try {
    id = await store.reserve(entryId, questions);
    if (!id) return null;
    const raw = await Promise.race([
      client.judge(text, controller.signal, questions),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, jevTimeoutMs);
      }),
    ]);
    answers = ("text_kind" in questions ? feedbackJevAnswersSchema : jevAnswersSchema).parse(raw);
    return answers;
  } catch (error) {
    console.error("jev_check_failed", {
      status: error instanceof JevHttpError ? error.status : 500,
    });
    return null;
  } finally {
    clearTimeout(timer);
    if (id)
      await store.finish(id, answers, Date.now() - start).catch(() => {
        console.error("jev_call_log_failed", { status: 500 });
      });
  }
}

export { jevQuestions };
