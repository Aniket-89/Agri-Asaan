import { Suspense } from "react";
import { UserPlusIcon } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";

import { AuthScreen } from "@/components/layout/auth-screen";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { StatusBanner } from "@/components/shared/status-banner";
import { Button, buttonClass, controlClass, Field } from "@/components/ui";
import { withLocale, type Dictionary } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";

import { registerAction } from "./actions";

const searchSchema = z.object({
  error: z.enum(["invalid_registration", "registration_failed"]).optional().catch(undefined),
});

async function RegisterError({
  searchParams,
  t,
}: {
  searchParams: PageProps<"/[lang]/register">["searchParams"];
  t: Dictionary["register"];
}) {
  const { error } = searchSchema.parse(await searchParams);
  return error ? <StatusBanner kind="error" text={t.errors[error]} /> : null;
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
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.register.title}</h1>
      <Suspense fallback={null}>
        <RegisterError searchParams={searchParams} t={t.register} />
      </Suspense>
      <form action={registerAction} className="space-y-4">
        <Field label={t.register.fullName}>
          <input className={controlClass} name="fullName" autoComplete="name" required />
        </Field>
        <Field label={t.register.email}>
          <input className={controlClass} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t.register.password} hint={t.register.passwordHint}>
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
          {t.register.submit}
        </Button>
      </form>
      <a
        className={buttonClass({ variant: "quiet", block: true })}
        href={withLocale(locale, "/login")}
      >
        {t.register.haveAccount}
      </a>
    </AuthScreen>
  );
}
