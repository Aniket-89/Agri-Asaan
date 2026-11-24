"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LOCALES, stripLocale, withLocale, type Locale } from "@/lib/i18n/config";

type LanguageSwitcherProps = {
  current: Locale;
  label: string;
  // Each language's name written in that language, e.g. { en: "English", hi: "हिन्दी" }.
  names: Record<Locale, string>;
};

export function LanguageSwitcher({ current, label, names }: LanguageSwitcherProps) {
  const { path } = stripLocale(usePathname());

  return (
    <nav aria-label={label} className="flex gap-2 text-sm">
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={withLocale(locale, path)}
          hrefLang={locale}
          lang={locale}
          prefetch={false}
          aria-current={locale === current ? "true" : undefined}
          className={`min-h-11 rounded px-3 py-2 ${
            locale === current ? "bg-black text-white" : "border underline"
          }`}
        >
          {names[locale]}
        </Link>
      ))}
    </nav>
  );
}
