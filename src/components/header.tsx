import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UnitedKingdomFlag } from "@/components/flags/united-kingdom";
import { SpainFlag } from "@/components/flags/spain";
import { ItalyFlag } from "@/components/flags/italy";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/config/locales";
import type { Dictionary, Locale } from "@/i18n/types";

interface IHeaderProps {
  locale: Locale;
  dictionary: Dictionary;
}

export function Header({ locale, dictionary: t }: IHeaderProps) {
  const languages = {
    en: { name: t.english, Flag: UnitedKingdomFlag },
    es: { name: t.spanish, Flag: SpainFlag },
    it: { name: t.italian, Flag: ItalyFlag },
  } satisfies Record<Locale, { name: string; Flag: typeof UnitedKingdomFlag }>;

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" aria-label={t.home} className="min-w-0 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-base">
          {t.appName}
        </Link>
        <nav aria-label={t.languages} className="flex shrink-0 gap-1">
          {locales.map((value) => {
            const { name, Flag } = languages[value];
            return (
              <form action={setLocale} key={value}>
                <Button type="submit" name="locale" value={value} aria-label={name} title={name} aria-pressed={locale === value} variant={locale === value ? "outline" : "ghost"} size="icon-lg">
                  <Flag title={name} />
                </Button>
              </form>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
