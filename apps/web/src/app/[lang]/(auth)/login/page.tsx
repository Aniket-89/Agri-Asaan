import { Suspense } from "react";
import { z } from "zod";

import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { StatusBanner } from "@/components/shared/status-banner";
import { getRequestBranding } from "@/lib/branding/request-branding";
import { withLocale, format, type Dictionary } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";

import { loginAction } from "./actions";

const loginSearchSchema = z.object({
  error: z.enum(["invalid_credentials", "link_invalid"]).optional().catch(undefined),
});

async function LoginError({
  searchParams,
  t,
}: {
  searchParams: PageProps<"/[lang]/login">["searchParams"];
  t: Dictionary;
}) {
  const { error } = loginSearchSchema.parse(await searchParams);
  return error ? <StatusBanner kind="error" text={t.login.errors[error]} /> : null;
}

async function BrandedHeading({ title }: { title: string }) {
  const branding = await getRequestBranding();
  return <h1 className="text-2xl font-semibold">{format(title, { brand: branding.name })}</h1>;
}

function LoginHeading({ t }: { t: Dictionary }) {
  return (
    // Brand-neutral fallback so a white-label domain never flashes another brand.
    <Suspense fallback={<h1 className="text-2xl font-semibold">{t.login.titleFallback}</h1>}>
      <BrandedHeading title={t.login.title} />
    </Suspense>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <LanguageSwitcher
        current={locale}
        label={t.language.label}
        names={{ en: t.language.en, hi: t.language.hi }}
      />
      <form action={loginAction} className="w-full space-y-4 rounded-xl border p-6">
        <LoginHeading t={t} />
        <Suspense fallback={null}>
          <LoginError searchParams={searchParams} t={t} />
        </Suspense>
        <label className="block">
          <span className="mb-1 block text-sm">{t.login.email}</span>
          <input className="w-full rounded border px-3 py-2" name="email" type="email" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">{t.login.password}</span>
          <input
            className="w-full rounded border px-3 py-2"
            name="password"
            type="password"
            minLength={6}
            required
          />
        </label>
        <button className="w-full rounded bg-black px-4 py-3 text-white" type="submit">
          {t.login.submit}
        </button>
        <a className="block text-center text-sm underline" href={withLocale(locale, "/register")}>
          {t.login.createAccount}
        </a>
      </form>
    </main>
  );
}
