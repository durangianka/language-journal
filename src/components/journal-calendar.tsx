"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { enUS, es, it } from "react-day-picker/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Dictionary, Locale } from "@/i18n/types";

const calendarLocales = { en: enUS, es, it };

export function JournalCalendar({
  dates,
  journalId,
  locale,
  t,
}: {
  dates: string[];
  journalId: string;
  locale: Locale;
  t: Dictionary;
}) {
  const [selected, setSelected] = useState<Date>();
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  return (
    <Card className="gap-0 py-0">
      <Collapsible>
        <CollapsibleTrigger
          render={<Button variant="ghost" className="min-h-11 w-full justify-between px-4" />}
        >
          <span className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" />
            {t.browseCalendar}
          </span>
          <ChevronDown aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Calendar
            mode="single"
            locale={calendarLocales[locale]}
            selected={selected}
            defaultMonth={dates[0] ? parseISO(dates[0]) : undefined}
            className="mx-auto [--cell-size:44px]"
            modifiers={{
              hasEntries: dates.map((date) => parseISO(date)),
              multipleEntries: dates
                .filter((date) => (counts.get(date) ?? 0) > 1)
                .map((date) => parseISO(date)),
            }}
            modifiersClassNames={{
              hasEntries: "calendar-entry-day",
              multipleEntries: "calendar-multiple-day",
            }}
            onSelect={(date) => {
              setSelected(date);
              if (date)
                document
                  .getElementById(`entries-${format(date, "yyyy-MM-dd")}`)
                  ?.scrollIntoView({
                    block: "start",
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                      ? "instant"
                      : "smooth",
                  });
            }}
          />
          {selectedKey && !counts.has(selectedKey) && (
            <div className="flex flex-col gap-2 px-4 pb-4">
              <p>{t.noEntriesOnDay}</p>
              <Link
                href={`/journals/${journalId}/entries/new?date=${selectedKey}`}
                className="inline-flex min-h-11 items-center underline"
              >
                {t.newEntry}
              </Link>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
