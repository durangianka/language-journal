import type { ReactNode } from "react";
import type { Correction } from "@/lib/feedback-contract";

/** Annotate exact fixes without altering the feedback or the learner's text. */
export function CorrectedProse({ text, corrections }: { text: string; corrections: Correction[] }) {
  const ranges = corrections
    .flatMap((correction) => {
      const start = correction.fix ? text.indexOf(correction.fix) : -1;
      // Feedback has no offsets. Leave repeated fixes unmarked rather than underline the wrong occurrence.
      return start < 0 || text.indexOf(correction.fix, start + correction.fix.length) !== -1
        ? []
        : [{ start, end: start + correction.fix.length, category: correction.category }];
    })
    .sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    parts.push(text.slice(cursor, range.start));
    parts.push(
      <span key={range.start} data-category={range.category} className="correction-mark">
        {text.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  parts.push(text.slice(cursor));
  return parts;
}
