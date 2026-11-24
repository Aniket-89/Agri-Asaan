import { notFound } from "next/navigation";
import { lang } from "next/root-params";

import { hasLocale, withLocale, type Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { hi } from "./dictionaries/hi";

const dictionaries: Record<Locale, Dictionary> = { en, hi };

// Locale of the current route, for Server Components only. Server Actions and
// Route Handlers use getRequestLocale() instead.
export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export function getDictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}

// Locale-prefixed href for links rendered by Server Components.
export async function localizedHref(path: string): Promise<string> {
  return withLocale(await getLocale(), path);
}
