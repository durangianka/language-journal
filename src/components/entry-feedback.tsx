"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Feather,
  Languages,
  LoaderCircle,
  MessageSquare,
  SpellCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CorrectedProse } from "@/components/corrected-prose";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { Dictionary, Locale } from "@/i18n/types";
import { getEntry, requestFeedback } from "@/lib/feedback-client";
import { feedbackResultState, feedbackScreenState } from "@/lib/feedback-state";
import { LIMITS, type EntryDto } from "@/lib/feedback-contract";

const categoryIcons = {
  grammar: BookOpen,
  vocabulary: Languages,
  spelling: SpellCheck,
  style: Feather,
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState(() => feedbackScreenState(entry.latestFeedback));
  const {
    feedback,
    status,
    reason: reasonCode,
  } = pending ? feedbackScreenState(state.feedback, true) : state;
  const reason =
    reasonCode && reasonCode !== "validation" && reasonCode !== "unknown"
      ? t[reasonCode]
      : t.feedbackUnknown;

  useEffect(() => {
    if (status !== "pending" || pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const current = await getEntry(entry.id);
        if (cancelled) return;
        if (!current) {
          router.refresh();
          return;
        }
        setState(feedbackScreenState(current.latestFeedback));
        if (current.latestFeedback?.status === "pending") timer = setTimeout(poll, 1000);
        else router.refresh();
      } catch {
        if (!cancelled)
          setState((previous) => feedbackScreenState(previous.feedback, false, "unknown"));
      }
    }
    timer = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entry.id, pending, router, status]);

  async function request() {
    setPending(true);
    try {
      // A failed poll retries the read without consuming another feedback allowance.
      if (state.feedback?.status === "pending") {
        const current = await getEntry(entry.id);
        if (!current) router.refresh();
        else setState(feedbackScreenState(current.latestFeedback));
      } else {
        const result = await requestFeedback(entry.id, locale);
        setState((previous) => feedbackResultState(result, previous.feedback));
      }
    } catch {
      setState((previous) => feedbackScreenState(previous.feedback, false, "unknown"));
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label={t.feedbackHeading} className="flex min-w-0 flex-col gap-4">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-2 rounded-xl bg-accent p-4 text-accent-foreground"
      >
        {status === "pending" && (
          <span aria-hidden="true" className="inline-flex animate-spin motion-reduce:animate-none">
            <LoaderCircle className="size-5" />
          </span>
        )}
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
      {feedback && new Date(entry.updatedAt) > new Date(feedback.createdAt) && (
        <p role="note" className="text-sm text-muted-foreground">
          {t.feedbackOutdated}
        </p>
      )}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs defaultValue="corrected" className="min-w-0">
          <TabsList
            variant="line"
            className="mb-2 min-h-12 w-full border-b"
            aria-label={t.yourEntry}
          >
            <TabsTrigger value="corrected" className="min-h-11">
              {t.correctedText}
            </TabsTrigger>
            <TabsTrigger value="original" className="min-h-11">
              {t.originalText}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="corrected">
            <Card>
              <CardContent>
                {status === "ready" && feedback ? (
                  <p
                    lang={language}
                    className="journal-prose break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
                  >
                    <CorrectedProse
                      text={feedback.correctedText ?? ""}
                      corrections={feedback.corrections}
                    />
                  </p>
                ) : status === "pending" ? (
                  <FeedbackSkeleton label={t.correctedText} />
                ) : (
                  <p className="text-muted-foreground">
                    {status === "failed" ? t.feedbackFailed : t.feedbackNoFeedback}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="original">
            <Card>
              <CardContent>
                <p
                  lang={language}
                  className="journal-prose break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
                >
                  {entry.body}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <aside className="min-w-0" aria-label={t.correctionsHeading}>
          {status === "pending" && (
            <div>
              <h3 className="mb-2 font-semibold">{t.correctionsHeading}</h3>
              <div className="rounded-xl border p-4">
                <FeedbackSkeleton label={t.correctionsHeading} />
              </div>
            </div>
          )}
          {status === "ready" &&
            feedback &&
            (feedback.corrections.length === 0 ? (
              <p role="note" className="rounded-lg border p-4">
                {t.noCorrections}
              </p>
            ) : (
              <div>
                <h3 className="mb-2 font-semibold">{t.correctionsHeading}</h3>
                <Accordion key={feedback.id} defaultValue={["correction-0"]} className="gap-3">
                  {feedback.corrections
                    .slice(0, LIMITS.correctionsPerFeedback)
                    .map((correction, index) => {
                      const CategoryIcon = categoryIcons[correction.category];
                      return (
                        <AccordionItem
                          key={index}
                          value={"correction-" + index}
                          className="rounded-xl border bg-card p-4"
                        >
                          <AccordionTrigger className="min-h-12 gap-3">
                            <span className="flex min-w-0 flex-col gap-1">
                              <Badge variant={correction.category}>
                                <CategoryIcon aria-hidden="true" />
                                {t[correction.category]}
                              </Badge>
                              <span
                                lang={language}
                                className="break-words text-base [overflow-wrap:anywhere]"
                              >
                                <s className="text-muted-foreground">{correction.original}</s>
                                {" → "}
                                {correction.fix}
                              </span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <dl className="flex flex-col gap-2 break-words text-base [overflow-wrap:anywhere]">
                              <dt className="font-semibold">{t.explanation}</dt>
                              <dd lang={feedback.locale}>{correction.explanation}</dd>
                            </dl>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                </Accordion>
              </div>
            ))}
        </aside>
      </div>
      <Button
        className="min-h-11 w-full"
        disabled={status === "pending"}
        onClick={() => void request()}
      >
        <MessageSquare aria-hidden="true" />
        {status === "pending"
          ? t.feedbackPending
          : status === "failed"
            ? t.retryFeedback
            : feedback
              ? t.getFeedbackAgain
              : t.getFeedback}
      </Button>
    </section>
  );
}

function FeedbackSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} aria-busy="true" className="flex flex-col gap-3">
      <div
        aria-hidden="true"
        className="h-4 w-full animate-pulse rounded bg-muted motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-4 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-4 w-3/5 animate-pulse rounded bg-muted motion-reduce:animate-none"
      />
    </div>
  );
}
