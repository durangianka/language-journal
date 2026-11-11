import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UnitedKingdomFlag } from "@/components/flags/united-kingdom";
import { SpainFlag } from "@/components/flags/spain";
import { ItalyFlag } from "@/components/flags/italy";
import { setLocale } from "@/i18n/actions";
import type { Dictionary, Locale } from "@/i18n/types";

export function Header({ locale, dictionary: t }: { locale: Locale; dictionary: Dictionary }) {
  const languages = [
    { locale: "en", name: t.english, Flag: UnitedKingdomFlag },
    { locale: "es", name: t.spanish, Flag: SpainFlag },
    { locale: "it", name: t.italian, Flag: ItalyFlag },
  ] as const;

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" aria-label={t.home} className="min-w-0 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-base">
          {t.appName}
        </Link>
        <nav aria-label={t.languages} className="flex shrink-0 gap-1">
          {languages.map(({ locale: value, name, Flag }) => (
            <form action={setLocale} key={value}>
              <Button type="submit" name="locale" value={value} aria-label={name} title={name} aria-pressed={locale === value} variant={locale === value ? "outline" : "ghost"} size="icon-lg">
                <Flag title={name} />
              </Button>
            </form>
          ))}
        </nav>
      </div>
    </header>
  );
}
