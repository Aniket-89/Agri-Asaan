import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { MapPinAreaIcon, UserPlusIcon } from "@phosphor-icons/react/dist/ssr";

import { StatusBanner } from "@/components/shared/status-banner";
import {
  BackLink,
  Button,
  controlClass,
  EmptyState,
  Field,
  Page,
  PageHeader,
} from "@/components/ui";
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
    return (
      <EmptyState
        icon={<MapPinAreaIcon weight="duotone" className="size-7" />}
        text={t.noVillages}
      />
    );
  }

  return (
    <>
      {search.error ? <StatusBanner kind="error" text={t.errors[search.error]} /> : null}
      <form
        action={registerFarmerAction}
        className="space-y-5 rounded-2xl bg-surface p-4 shadow-soft sm:p-6"
      >
        {/* Fresh id per rendered form: resubmitting the same form cannot create a duplicate. */}
        <input type="hidden" name="id" value={crypto.randomUUID()} />
        <Field label={t.fullName}>
          <input
            name="fullName"
            required
            maxLength={120}
            autoComplete="off"
            className={controlClass}
          />
        </Field>
        <Field label={t.phone} hint={<span id="phone-hint">{t.phoneHint}</span>}>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="off"
            aria-describedby="phone-hint"
            className={controlClass}
          />
        </Field>
        <Field label={t.village}>
          <select
            name="villageId"
            required
            defaultValue={villages.length === 1 ? villages[0].id : ""}
            className={controlClass}
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
        </Field>
        <fieldset className="rounded-xl bg-canvas p-4">
          <legend className="sr-only">{t.consentHeading}</legend>
          <p aria-hidden="true" className="mb-2 text-sm font-semibold text-ink">
            {t.consentHeading}
          </p>
          <label className="flex min-h-11 items-start gap-3">
            <input
              name="consent"
              type="checkbox"
              required
              className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
            />
            <span className="text-sm text-ink-muted">
              {format(t.consent, { brand: branding.name })}
            </span>
          </label>
        </fieldset>
        <Button block icon={<UserPlusIcon weight="bold" className="size-5" aria-hidden />}>
          {t.submitRegistration}
        </Button>
      </form>
    </>
  );
}

export default async function RegisterFarmerPage({
  searchParams,
}: PageProps<"/[lang]/dashboard/farmers/new">) {
  const { locale, t } = await getDictionary();

  return (
    <Page width="narrow">
      <div className="space-y-2">
        <BackLink href={withLocale(locale, "/dashboard/farmers")}>
          {t.farmers.backToFarmers}
        </BackLink>
        <PageHeader title={t.farmers.registerTitle} />
      </div>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <RegistrationForm searchParams={searchParams} t={t.farmers} locale={locale} />
      </Suspense>
    </Page>
  );
}
