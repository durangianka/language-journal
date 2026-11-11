"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { isLocale } from "./types";

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;

  (await cookies()).set("locale", locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
}
