import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { getDictionary, getLocale } from "@/i18n/server";
import "./globals.css";

// The locale cookie determines the document language before any UI is sent.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.appName, description: t.homeDescription };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dictionary = await getDictionary();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Header locale={locale} dictionary={dictionary} />
        {children}
      </body>
    </html>
  );
}
