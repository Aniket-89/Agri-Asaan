import { Suspense } from "react";
import { SignInIcon } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";

import { BrandMark } from "@/components/brand/brand-mark";
import { AuthScreen } from "@/components/layout/auth-screen";
import { BrandTokens } from "@/components/layout/brand-tokens";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { StatusBanner } from "@/components/shared/status-banner";
import { Button, buttonClass, controlClass, Field } from "@/components/ui";
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

const headingClass = "text-2xl font-bold tracking-tight text-ink";

async function BrandedHeading({ title }: { title: string }) {
  const branding = await getRequestBranding();
  return (
    <div className="space-y-4">
      <BrandTokens branding={branding} />
      <BrandMark branding={branding} className="size-14" />
      <h1 className={headingClass}>{format(title, { brand: branding.name })}</h1>
    </div>
  );
}

function LoginHeading({ t }: { t: Dictionary }) {
  return (
    // Brand-neutral fallback so a white-label domain never flashes another brand.
    <Suspense fallback={<h1 className={`${headingClass} pt-18`}>{t.login.titleFallback}</h1>}>
      <BrandedHeading title={t.login.title} />
    </Suspense>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const { locale, t } = await getDictionary();

  return (
    <AuthScreen
      top={
        <LanguageSwitcher
          current={locale}
          label={t.language.label}
          names={{ en: t.language.en, hi: t.language.hi }}
          onDark
        />
      }
    >
      <LoginHeading t={t} />
      <Suspense fallback={null}>
        <LoginError searchParams={searchParams} t={t} />
      </Suspense>
      <form action={loginAction} className="space-y-4">
        <Field label={t.login.email}>
          <input className={controlClass} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t.login.password}>
          <input
            className={controlClass}
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={6}
            required
          />
        </Field>
        <Button block icon={<SignInIcon weight="bold" className="size-5" aria-hidden />}>
          {t.login.submit}
        </Button>
      </form>
      <a
        className={buttonClass({ variant: "quiet", block: true })}
        href={withLocale(locale, "/register")}
      >
        {t.login.createAccount}
      </a>
    </AuthScreen>
  );
}
