import { cookies } from "next/headers";

import { DEFAULT_LOCALE, hasLocale, LOCALE_COOKIE, withLocale, type Locale } from "./config";

// For Server Actions and Route Handlers, which cannot read root params. The
// proxy stores the locale of every localized page visit in this cookie.
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return hasLocale(value) ? value : DEFAULT_LOCALE;
}

export async function localizedPath(path: string): Promise<string> {
  return withLocale(await getRequestLocale(), path);
}
