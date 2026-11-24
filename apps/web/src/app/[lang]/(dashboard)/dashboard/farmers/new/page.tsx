import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getOrganizationBranding } from "@/modules/branding";
import { canWorkWithFarmers, listRegistrationVillages } from "@/modules/farmers";
import { getActiveMembershipContext } from "@/modules/organizations";

import { registerFarmerAction } from "../actions";

export const instant = false;

const searchSchema = z.object({
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.farmers.registerTitle };
}

const inputClass = "min-h-11 w-full rounded border px-3 py-2";

async function RegistrationForm({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/farmers/new">["searchParams"];
  t: Dictionary["farmers"];
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  if (!canWorkWithFarmers(context.role)) {
    notFound();
  }

  const [villages, branding, search] = await Promise.all([
    listRegistrationVillages(context),
    getOrganizationBranding(context.supabase, context.organizationId),
    searchParams.then((params) => searchSchema.parse(params)),
  ]);

  if (villages.length === 0) {
    return <p>{t.noVillages}</p>;
  }

  return (
    <>
      {search.error ? <StatusBanner kind="error" text={t.errors[search.error]} /> : null}
      <form action={registerFarmerAction} className="space-y-4 rounded-xl border p-4">
        {/* Fresh id per rendered form: resubmitting the same form cannot create a duplicate. */}
        <input type="hidden" name="id" value={crypto.randomUUID()} />
        <label className="block">
          <span className="mb-1 block text-sm">{t.fullName}</span>
          <input
            name="fullName"
            required
            maxLength={120}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">{t.phone}</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="off"
            aria-describedby="phone-hint"
            className={inputClass}
          />
          <span id="phone-hint" className="mt-1 block text-xs text-gray-600">
            {t.phoneHint}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">{t.village}</span>
          <select
            name="villageId"
            required
            defaultValue={villages.length === 1 ? villages[0].id : ""}
            className={inputClass}
          >
            <option value="" disabled>
              {t.chooseVillage}
            </option>
            {villages.map((village) => (
              <option key={village.id} value={village.id}>
                {village.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="rounded border p-3">
          <legend className="px-1 text-sm font-medium">{t.consentHeading}</legend>
          <label className="flex min-h-11 items-start gap-3">
            <input name="consent" type="checkbox" required className="mt-1 h-5 w-5 shrink-0" />
            <span className="text-sm">{format(t.consent, { brand: branding.name })}</span>
          </label>
        </fieldset>
        <button type="submit" className="min-h-11 w-full rounded bg-black px-4 py-3 text-white">
          {t.submitRegistration}
        </button>
      </form>
    </>
  );
}

export default async function RegisterFarmerPage({
  searchParams,
}: PageProps<"/[lang]/dashboard/farmers/new">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard/farmers")}
        >
          ← {t.farmers.backToFarmers}
        </a>
        <h1 className="text-2xl font-semibold">{t.farmers.registerTitle}</h1>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <RegistrationForm searchParams={searchParams} t={t.farmers} locale={locale} />
      </Suspense>
    </main>
  );
}
