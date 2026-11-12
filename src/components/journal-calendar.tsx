"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { enUS, es, it } from "react-day-picker/locale";
import { CalendarDays, ChevronDown, PenLine } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Dictionary, Locale } from "@/i18n/types";
import { today } from "@/lib/journal/dates";

const calendarLocales = { en: enUS, es, it };
const subscribe = () => () => {};
const serverDate = () => "";

export function JournalCalendar({
  dates,
  journalId,
  locale,
  t,
  overview = false,
}: {
  dates: string[];
  journalId: string;
  locale: Locale;
  t: Dictionary;
  overview?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Date>();
  const localToday = useSyncExternalStore(subscribe, today, serverDate);
  const reference = dates[0] ?? localToday;
  const weekStart = reference
    ? startOfWeek(parseISO(reference), { locale: calendarLocales[locale] })
    : null;
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  function selectDate(date: Date | undefined) {
    setSelected(date);
    if (!date) return;
    const key = format(date, "yyyy-MM-dd");
    if (overview) {
      router.push(`/journals/${journalId}#entries-${key}`);
      return;
    }
    document.getElementById(`entries-${key}`)?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <Card className="gap-0 py-0">
      {!overview && weekStart && (
        <div
          role="group"
          aria-label={t.entryDate}
          className="flex justify-between gap-0 p-2 lg:hidden"
        >
          {Array.from({ length: 7 }, (_, index) => {
            const date = addDays(weekStart, index);
            const key = format(date, "yyyy-MM-dd");
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="icon"
                className="week-day relative h-14 w-11 flex-col gap-0"
                aria-label={format(date, "PPP", { locale: calendarLocales[locale] })}
                aria-pressed={selectedKey === key}
                aria-current={key === localToday ? "date" : undefined}
                data-has-entries={counts.has(key)}
                onClick={() => selectDate(date)}
              >
                <span className="text-xs text-muted-foreground">
                  {format(date, "EEEEE", { locale: calendarLocales[locale] })}
                </span>
                <span className="text-base">{format(date, "d")}</span>
              </Button>
            );
          })}
        </div>
      )}
      <Collapsible defaultOpen={overview}>
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
            className="mx-auto p-1 [--cell-size:44px]"
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
            onSelect={selectDate}
          />
        </CollapsibleContent>
      </Collapsible>
      {selectedKey && !counts.has(selectedKey) && !overview && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p>{t.noEntriesOnDay}</p>
          <Link
            href={`/journals/${journalId}/entries/new?date=${selectedKey}`}
            className="inline-flex min-h-11 items-center gap-2 underline"
          >
            <PenLine aria-hidden="true" className="size-4" />
            {t.newEntry}
          </Link>
        </div>
      )}
    </Card>
  );
}
