import { jevAnswersSchema, jevQuestions, type JevAnswers, type JevNote } from "./contract";

export interface JevClient {
  judge(text: string, signal: AbortSignal): Promise<unknown>;
}
export interface JevStore {
  reserve(entryId: string | null): Promise<string | null>;
  finish(id: string, answers: JevAnswers | null, durationMs: number): Promise<void>;
}
export const jevTimeoutMs = 3_000;

export async function judgeEntry(
  text: string,
  entryId: string | null,
  client: JevClient,
  store: JevStore,
): Promise<JevNote | null> {
  if (Array.from(text.trim()).length < 40 || Array.from(text).length > 2000) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let id: string | null = null;
  let answers: JevAnswers | null = null;
  const start = Date.now();
  try {
    id = await store.reserve(entryId);
    if (!id) return null;
    const raw = await Promise.race([
      client.judge(text, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, jevTimeoutMs);
      }),
    ]);
    answers = jevAnswersSchema.parse(raw);
    const main = answers.main_issue;
    return main.confidence >= 0.85 ? { issue: main.choice, confidence: main.confidence } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (id) await store.finish(id, answers, Date.now() - start).catch(() => {});
  }
}

export { jevQuestions };
