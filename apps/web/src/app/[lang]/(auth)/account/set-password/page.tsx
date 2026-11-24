import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
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

const inputClass = "min-h-11 w-full rounded border px-3 py-2";

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
    <form action={setPasswordAction} className="w-full space-y-4 rounded-xl border p-6">
      <h1 className="text-2xl font-semibold">{t.setPasswordTitle}</h1>
      <p className="text-sm text-gray-600">{t.setPasswordIntro}</p>
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
      <label className="block">
        <span className="mb-1 block text-sm">{t.newPassword}</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">{t.confirmPassword}</span>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <button type="submit" className="min-h-11 w-full rounded bg-black px-4 py-3 text-white">
        {t.savePassword}
      </button>
    </form>
  );
}

export default async function SetPasswordPage({
  searchParams,
}: PageProps<"/[lang]/account/set-password">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <SetPasswordForm searchParams={searchParams} t={t.account} locale={locale} />
      </Suspense>
    </main>
  );
}
