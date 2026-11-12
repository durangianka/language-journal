"use client";

import { useState, useSyncExternalStore } from "react";
import { format, parseISO } from "date-fns";
import { enUS, es, it } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Dictionary, Locale } from "@/i18n/types";
import { formatDate } from "@/lib/journal/dates";

const calendarLocales = { en: enUS, es, it };
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function EntryDatePicker({
  id,
  errorId,
  value,
  onChange,
  locale,
  invalid,
  t,
}: {
  id: string;
  errorId: string;
  value: string;
  onChange: (date: string) => void;
  locale: Locale;
  invalid: boolean;
  t: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const selected = value ? parseISO(value) : undefined;
  return (
    <>
      <input type="hidden" name="entryDate" value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={!ready || !value}
          aria-labelledby={`${id}-label`}
          aria-invalid={invalid}
          aria-describedby={`${id}-value ${errorId}`}
          render={
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full min-w-0 justify-start whitespace-normal text-left"
            />
          }
        >
          <CalendarDays data-icon="inline-start" aria-hidden="true" />
          <span id={`${id}-value`}>{value ? formatDate(value, locale) : t.entryDate}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" aria-label={t.entryDate}>
          <Calendar
            mode="single"
            required
            locale={calendarLocales[locale]}
            selected={selected}
            defaultMonth={selected}
            className="[--cell-size:44px]"
            onSelect={(date) => {
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
