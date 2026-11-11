"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { localeSchema } from "../config/locales";

export async function setLocale(formData: FormData) {
  const locale = localeSchema.safeParse(formData.get("locale"));
  if (!locale.success) return;

  (await cookies()).set("locale", locale.data, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
}
