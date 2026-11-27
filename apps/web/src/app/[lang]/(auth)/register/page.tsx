import Link from "next/link";
import { Suspense } from "react";
import { UserPlusIcon } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";

import { BrandMark } from "@/components/brand/brand-mark";
import { AuthScreen } from "@/components/layout/auth-screen";
import { BrandTokens } from "@/components/layout/brand-tokens";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { StatusBanner } from "@/components/shared/status-banner";
import { Button, buttonClass, controlClass, Field } from "@/components/ui";
import { getRequestBranding, getRequestHostname } from "@/lib/branding/request-branding";
import { withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignupOptions } from "@/modules/farmers";
import { FarmerSignupFields } from "@/modules/farmers/components/farmer-signup-fields";

import { registerAction } from "./actions";

const searchSchema = z.object({
  error: z
    .enum(["invalid_registration", "registration_failed", "email_in_use", "closed"])
    .optional()
    .catch(undefined),
});

const headingClass = "text-2xl font-bold tracking-tight text-ink";

async function RegisterForm({
  searchParams,
  locale,
  t,
}: {
  searchParams: PageProps<"/[lang]/register">["searchParams"];
  locale: Locale;
  t: Dictionary["register"];
}) {
  const [{ error }, branding, supabase, hostname] = await Promise.all([
    searchParams.then((params) => searchSchema.parse(params)),
    getRequestBranding(),
    createSupabaseServerClient(),
    getRequestHostname(),
  ]);
  const { open, villages, places } = await getSignupOptions(supabase, hostname);

  if (!open) {
    return (
      <>
        <h1 className={headingClass}>{t.closedTitle}</h1>
        <p className="text-ink-muted">{t.closedBody}</p>
        <Link
          className={buttonClass({ variant: "secondary", block: true })}
          href={withLocale(locale, "/login")}
        >
          {t.backToSignIn}
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <BrandTokens branding={branding} />
        <BrandMark branding={branding} className="size-14" />
        <div className="space-y-1">
          <h1 className={headingClass}>{t.title}</h1>
          <p className="text-ink-muted">{t.intro}</p>
        </div>
      </div>
      {error ? <StatusBanner kind="error" text={t.errors[error]} /> : null}
      <form action={registerAction} className="space-y-4">
        <FarmerSignupFields villages={villages} places={places} brandName={branding.name} t={t} />
        <Field label={t.email}>
          <input className={controlClass} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t.password} hint={t.passwordHint}>
          <input
            className={controlClass}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>
        <Button block icon={<UserPlusIcon weight="bold" className="size-5" aria-hidden />}>
          {t.submit}
        </Button>
      </form>
    </>
  );
}

export default async function RegisterPage({ searchParams }: PageProps<"/[lang]/register">) {
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
      {/* Brand-neutral fallback so a white-label domain never flashes another brand. */}
      <Suspense fallback={<h1 className={`${headingClass} pt-18`}>{t.register.title}</h1>}>
        <RegisterForm searchParams={searchParams} locale={locale} t={t.register} />
      </Suspense>
      <Link
        className={buttonClass({ variant: "quiet", block: true })}
        href={withLocale(locale, "/login")}
      >
        {t.register.haveAccount}
      </Link>
    </AuthScreen>
  );
}
