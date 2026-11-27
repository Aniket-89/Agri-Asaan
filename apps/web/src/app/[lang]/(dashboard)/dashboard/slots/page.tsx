import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { ClockIcon, InfoIcon } from "@phosphor-icons/react/dist/ssr";

import { StatusBanner } from "@/components/shared/status-banner";
import {
  Badge,
  Button,
  controlOnTintClass,
  Disclosure,
  EmptyState,
  Field,
  Page,
  PageHeader,
  PageSkeleton,
} from "@/components/ui";
import { withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getActiveMembershipContext } from "@/modules/organizations";
import { listSlots } from "@/modules/slots";

import { createSlotAction, setSlotActiveAction } from "./actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["saved"]).optional().catch(undefined),
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.slots.title };
}

async function SlotsContent({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/slots">["searchParams"];
  t: Dictionary["slots"];
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const slots = await listSlots(context);
  if (!slots) {
    notFound();
  }
  const search = searchSchema.parse(await searchParams);

  return (
    <>
      {search.error ? <StatusBanner kind="error" text={t.errors[search.error]} /> : null}
      {search.status === "saved" ? <StatusBanner kind="success" text={t.saved} /> : null}

      {slots.length === 0 ? (
        <EmptyState icon={<ClockIcon weight="duotone" className="size-7" />} text={t.none} />
      ) : (
        <ul className="space-y-1 rounded-2xl bg-surface p-1.5 shadow-soft">
          {slots.map((slot) => (
            <li key={slot.id} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-3">
              <span
                aria-hidden="true"
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                  slot.isActive ? "bg-sun-soft text-sun-ink" : "bg-field text-ink-faint"
                }`}
              >
                <ClockIcon weight="fill" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-semibold ${slot.isActive ? "text-ink" : "text-ink-muted"}`}
                  >
                    {locale === "hi" ? slot.nameHi : slot.nameEn}
                  </span>
                  {slot.isActive ? null : <Badge tone="neutral">{t.inactive}</Badge>}
                </span>
                <span className="block text-sm text-ink-muted tabular-nums">
                  {slot.startTime}–{slot.endTime}
                </span>
              </span>
              <form action={setSlotActiveAction}>
                <input type="hidden" name="slotId" value={slot.id} />
                <input type="hidden" name="isActive" value={slot.isActive ? "false" : "true"} />
                <Button variant={slot.isActive ? "quiet" : "secondary"} size="sm">
                  {slot.isActive ? t.deactivate : t.activate}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl bg-surface p-1.5 shadow-soft">
        <Disclosure summary={t.add} open={slots.length === 0}>
          <form action={createSlotAction} className="grid gap-4 sm:grid-cols-2">
            <p className="flex gap-2 text-sm text-ink-muted sm:col-span-2">
              <InfoIcon weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t.timesFixed}
            </p>
            <Field label={t.nameEn}>
              <input name="nameEn" required maxLength={60} className={controlOnTintClass} />
            </Field>
            <Field label={t.nameHi}>
              <input
                name="nameHi"
                required
                maxLength={60}
                lang="hi"
                className={controlOnTintClass}
              />
            </Field>
            <Field label={t.start}>
              <input name="startTime" type="time" required className={controlOnTintClass} />
            </Field>
            <Field label={t.end}>
              <input name="endTime" type="time" required className={controlOnTintClass} />
            </Field>
            <Button className="sm:col-span-2" block>
              {t.add}
            </Button>
          </form>
        </Disclosure>
      </div>
    </>
  );
}

export default async function SlotsPage({ searchParams }: PageProps<"/[lang]/dashboard/slots">) {
  const { locale, t } = await getDictionary();

  return (
    <Page width="narrow">
      <PageHeader title={t.slots.title} description={t.slots.intro} />
      <Suspense fallback={<PageSkeleton />}>
        <SlotsContent searchParams={searchParams} t={t.slots} locale={locale} />
      </Suspense>
    </Page>
  );
}
