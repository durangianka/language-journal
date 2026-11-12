import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import { JournalToaster } from "@/components/journal-toaster";
import { Header } from "@/components/header";
import { getDictionary, getLocale } from "@/i18n/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

// The locale cookie determines the document language before any UI is sent.
export const instant = false;
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.appName, description: t.homeDescription };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dictionary = await getDictionary();
  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header locale={locale} dictionary={dictionary} />
        {children}
        <JournalToaster label={dictionary.notifications} />
      </body>
    </html>
  );
}
