// Pure locale helpers. No Next.js server imports: also used by the proxy.
import { SUPPORTED_LOCALES, type SupportedLocale } from "@agri/shared";

export type Locale = SupportedLocale;

export const LOCALES = SUPPORTED_LOCALES;
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "agri_locale";

export function hasLocale(value: string | null | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? "");
}

// Picks the first supported language from an Accept-Language header,
// honouring q-weights. Region subtags are ignored ("hi-IN" -> "hi").
export function negotiateLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) {
    return null;
  }

  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { language: tag.trim().toLowerCase().split("-")[0], q, index };
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  const match = ranked.find(({ language }) => hasLocale(language))?.language;
  return hasLocale(match) ? match : null;
}

export function preferredLocale(
  cookieLocale: string | undefined,
  acceptLanguage: string | null
): Locale {
  if (hasLocale(cookieLocale)) {
    return cookieLocale;
  }
  return negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE;
}

// Splits "/hi/dashboard" into { locale: "hi", path: "/dashboard" }.
export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (hasLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: null, path: pathname };
}

// Prefixes an absolute app path with a locale: ("hi", "/login?x=1") -> "/hi/login?x=1".
export function withLocale(locale: Locale, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("withLocale expects an absolute in-app path.");
  }
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
