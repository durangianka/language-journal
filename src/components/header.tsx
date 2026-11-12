import Link from "next/link";
import { HeaderMenu } from "@/components/header-menu";
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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          aria-label={t.home}
          className="inline-flex min-h-11 min-w-11 items-center rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-base"
        >
          {t.appName}
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <nav aria-label={t.languages} className="flex flex-wrap gap-1">
            {locales.map((value) => {
              const { name, Flag } = languages[value];
              return (
                <form action={setLocale} key={value}>
                  <Button
                    type="submit"
                    name="locale"
                    value={value}
                    aria-label={name}
                    title={name}
                    aria-pressed={locale === value}
                    variant={locale === value ? "outline" : "ghost"}
                    className="min-h-11 gap-2"
                  >
                    <span aria-hidden="true">
                      <Flag title={name} />
                    </span>
                    <span>{name}</span>
                  </Button>
                </form>
              );
            })}
          </nav>
          <HeaderMenu label={t.headerMenu} settingsLabel={t.settings} />
        </div>
      </div>
    </header>
  );
}
