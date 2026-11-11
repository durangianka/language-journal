import { cookies } from "next/headers";
import { dictionaries } from "./dictionaries";
import { isLocale } from "./types";

export async function getLocale() {
  const value = (await cookies()).get("locale")?.value;
  return isLocale(value) ? value : "en";
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
