"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Dictionary, Locale } from "@/i18n/types";
import { requestFeedback, seedEntries } from "@/lib/feedback-client";
import { LIMITS, type EntryDto, type FeedbackCategory } from "@/lib/feedback-contract";

const categoryColors: Record<FeedbackCategory, string> = {
  grammar: "bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100",
  vocabulary: "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100",
  spelling: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
  style: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
};

export function EntryFeedback({
  entry,
  language,
  locale,
  t,
}: {
  entry: EntryDto;
  language: Locale;
  locale: Locale;
  t: Dictionary;
}) {
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const feedback = entry.latestFeedback;
  const status = pending ? "pending" : requestError ? "failed" : feedback?.status;
  const reason = requestError ?? (feedback?.reason ? t[feedback.reason] : t.feedbackUnknown);
  async function request() {
    setPending(true);
    setRequestError(null);
    seedEntries([entry], language);
    try {
      const result = await requestFeedback(entry.id, locale);
      if (!result.success)
        setRequestError(
          result.reason === "validation" || result.reason === "unknown"
            ? t.feedbackUnknown
            : t[result.reason],
        );
    } catch {
      setRequestError(t.feedbackUnknown);
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-labelledby="feedback-heading" className="flex flex-col gap-4">
      <h2 id="feedback-heading" className="text-xl font-semibold">
        {t.feedbackHeading}
      </h2>
      <p className="text-sm text-muted-foreground">{t.feedbackDemoNotice}</p>
      <div role="status" aria-live="polite" aria-atomic="true">
        {status === "pending"
          ? t.feedbackPending
          : status === "ready"
            ? t.feedbackReady
            : status === "failed"
              ? `${t.feedbackFailed} ${t.feedbackFailureReason.replace("{reason}", reason)}`
              : t.feedbackNoFeedback}
      </div>
      {!pending && feedback && (
        <p className="text-sm text-muted-foreground">
          {t.feedbackMadeAt}{" "}
          <time dateTime={feedback.createdAt}>
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(feedback.createdAt),
            )}
          </time>
        </p>
      )}
      {status === "ready" && feedback && (
        <>
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{t.correctedText}</h3>
            </CardHeader>
            <CardContent>
              <p
                lang={language}
                className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
              >
                {feedback.correctedText}
              </p>
            </CardContent>
          </Card>
          {feedback.corrections.length > 0 && (
            <h3 className="font-semibold">{t.correctionsHeading}</h3>
          )}
          <ul className="flex flex-col gap-3">
            {feedback.corrections
              .slice(0, LIMITS.correctionsPerFeedback)
              .map((correction, index) => (
                <li key={`${index}-${correction.original}`}>
                  <Card>
                    <CardHeader>
                      <span
                        className={`w-fit rounded px-2 py-1 text-sm font-semibold ${categoryColors[correction.category]}`}
                      >
                        {t[correction.category]}
                      </span>
                    </CardHeader>
                    <CardContent>
                      <dl className="flex flex-col gap-2 break-words [overflow-wrap:anywhere]">
                        <dt className="font-semibold">{t.originalWords}</dt>
                        <dd>
                          <mark
                            lang={language}
                            className={`rounded px-1 ${categoryColors[correction.category]}`}
                          >
                            {correction.original}
                          </mark>
                        </dd>
                        <dt className="font-semibold">{t.suggestedFix}</dt>
                        <dd lang={language}>{correction.fix}</dd>
                        <dt className="font-semibold">{t.explanation}</dt>
                        <dd lang={feedback.locale}>{correction.explanation}</dd>
                      </dl>
                    </CardContent>
                  </Card>
                </li>
              ))}
          </ul>
        </>
      )}
      <Button
        className="min-h-11 w-full"
        disabled={status === "pending"}
        onClick={() => void request()}
      >
        {status === "pending"
          ? t.feedbackPending
          : status === "failed"
            ? t.retryFeedback
            : t.getFeedback}
      </Button>
    </section>
  );
}
