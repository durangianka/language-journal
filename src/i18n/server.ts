import { cookies } from "next/headers";
import { defaultLocale } from "@/config/locales";
import { dictionaries } from "./dictionaries";
import { isLocale } from "./types";

export async function getLocale() {
  const value = (await cookies()).get("locale")?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
