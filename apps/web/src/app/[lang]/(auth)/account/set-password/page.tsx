import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { KeyIcon } from "@phosphor-icons/react/dist/ssr";

import { AuthScreen } from "@/components/layout/auth-screen";
import { StatusBanner } from "@/components/shared/status-banner";
import { Button, controlClass, Field } from "@/components/ui";
import { withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { setPasswordAction } from "./actions";

export const instant = false;

const searchSchema = z.object({
  error: z.enum(["mismatch", "too_short", "failed"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.account.setPasswordTitle };
}

async function SetPasswordForm({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/account/set-password">["searchParams"];
  t: Dictionary["account"];
  locale: Locale;
}) {
  await connection();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(withLocale(locale, "/login?error=link_invalid"));
  }
  const search = searchSchema.parse(await searchParams);

  return (
    <form action={setPasswordAction} className="space-y-4">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-ink"
      >
        <KeyIcon weight="duotone" className="size-8" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.setPasswordTitle}</h1>
      <p className="text-ink-muted">{t.setPasswordIntro}</p>
      {search.error ? <StatusBanner kind="error" text={t.errors[search.error]} /> : null}
      {/* Lets password managers associate the new password with the account. */}
      <input
        type="email"
        name="username"
        value={user.email ?? ""}
        autoComplete="username"
        readOnly
        hidden
      />
      <Field label={t.newPassword}>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={controlClass}
        />
      </Field>
      <Field label={t.confirmPassword}>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={controlClass}
        />
      </Field>
      <Button block>{t.savePassword}</Button>
    </form>
  );
}

export default async function SetPasswordPage({
  searchParams,
}: PageProps<"/[lang]/account/set-password">) {
  const { locale, t } = await getDictionary();

  return (
    <AuthScreen>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <SetPasswordForm searchParams={searchParams} t={t.account} locale={locale} />
      </Suspense>
    </AuthScreen>
  );
}
