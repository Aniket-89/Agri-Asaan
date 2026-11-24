# 0006. Internationalization: locale-prefixed routes and typed dictionaries

- Status: Accepted
- Date: 2026-11-21

## Context

AGENTS.md requires Hindi and English, with every user-facing string going
through i18n. The app uses Next.js 16 with Cache Components, so static
shells are prerendered.

`<html lang>` has to be correct for screen readers and for Devanagari font
selection. If the locale came only from a cookie, the root layout would read
runtime data, and no page could be prerendered at all.

## Decision

- **Routes:** every page lives under `app/[lang]/` (`/en/...`, `/hi/...`).
  `generateStaticParams` prerenders each locale. API routes stay unprefixed.
- **Reading the locale:**
  - Server Components read it with `next/root-params` (`getLocale()`,
    `getDictionary()`, `localizedHref()` in `lib/i18n/dictionary.ts`).
  - Server Actions and Route Handlers can't read root params, so they use
    `localizedPath()`. That reads the `agri_locale` cookie, which the proxy
    sets on every localized page visit.
- **Unprefixed paths:** the proxy redirects them to the remembered locale,
  then the browser's `Accept-Language`, then English.
- **Dictionaries:** plain TypeScript objects in `lib/i18n/dictionaries/`.
  - English is the source. Hindi is typed against it, so a missing or extra
    key fails typecheck.
  - A unit test checks that `{placeholder}` names match across languages.
  - Keys are added only as features need them.
- **No new dependency.** `format()` handles `{name}` placeholders.

## Alternatives considered

- **next-intl:** mature (ICU plurals, formatting, routing helpers), but it's
  a significant dependency, and the MVP's needs are small. Revisit if plural
  rules or rich formatting become common. The dictionary shape would carry
  over.
- **Cookie-only locale, no URL prefix:** simpler URLs, but it forces fully
  dynamic rendering and leaves `<html lang>` wrong or dynamic.
- **Organization default locale as the first choice:** the hostname or
  tenant isn't known before routing for most requests. Org defaults can seed
  the cookie after sign-in, once features need it.

## Consequences

- Links rendered by Server Components must use `localizedHref` or
  `withLocale`. Unprefixed links still work, but cost a redirect.
- Hindi strings need review by a native speaker before production.
- Existing screens other than the login page are not translated yet. Each
  feature translates its own screens as it is built.
