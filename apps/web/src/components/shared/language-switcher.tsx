"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LOCALES, stripLocale, withLocale, type Locale } from "@/lib/i18n/config";

type LanguageSwitcherProps = {
  current: Locale;
  label: string;
  // Each language's name written in that language, e.g. { en: "English", hi: "हिन्दी" }.
  names: Record<Locale, string>;
  // On the forest-green sidebar.
  onDark?: boolean;
};

export function LanguageSwitcher({ current, label, names, onDark = false }: LanguageSwitcherProps) {
  const { path } = stripLocale(usePathname());

  return (
    <nav
      aria-label={label}
      className={`flex gap-0.5 rounded-xl p-0.5 text-sm ${
        onDark ? "bg-black/20" : "bg-field shadow-inset"
      }`}
    >
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={withLocale(locale, path)}
          hrefLang={locale}
          lang={locale}
          prefetch={false}
          aria-current={locale === current ? "true" : undefined}
          className={`flex min-h-10 min-w-10 flex-1 items-center justify-center rounded-[10px] px-2.5 font-semibold transition ${
            locale === current
              ? "bg-surface text-brand shadow-soft"
              : onDark
                ? "text-white/75 hover:text-white"
                : "text-ink-muted hover:text-ink"
          }`}
        >
          {names[locale]}
        </Link>
      ))}
    </nav>
  );
}
