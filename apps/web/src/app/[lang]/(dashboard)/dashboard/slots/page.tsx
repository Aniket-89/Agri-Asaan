import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
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

const inputClass = "min-h-11 w-full rounded border px-3 py-2";

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

      {slots.length === 0 ? <p>{t.none}</p> : null}
      <ul className="space-y-2">
        {slots.map((slot) => (
          <li
            key={slot.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
          >
            <span className={slot.isActive ? "" : "opacity-60"}>
              <span className="font-medium">{locale === "hi" ? slot.nameHi : slot.nameEn}</span>
              <span className="block text-sm text-gray-600">
                {slot.startTime}–{slot.endTime}
                {slot.isActive ? "" : ` · ${t.inactive}`}
              </span>
            </span>
            <form action={setSlotActiveAction}>
              <input type="hidden" name="slotId" value={slot.id} />
              <input type="hidden" name="isActive" value={slot.isActive ? "false" : "true"} />
              <button type="submit" className="min-h-11 rounded border px-3 py-2 text-sm">
                {slot.isActive ? t.deactivate : t.activate}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <form
        action={createSlotAction}
        className="grid gap-2 rounded-xl border border-dashed p-4 sm:grid-cols-2"
      >
        <h2 className="text-lg font-semibold sm:col-span-2">{t.add}</h2>
        <p className="text-sm text-gray-600 sm:col-span-2">{t.timesFixed}</p>
        <label>
          <span className="mb-1 block text-sm">{t.nameEn}</span>
          <input name="nameEn" required maxLength={60} className={inputClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm">{t.nameHi}</span>
          <input name="nameHi" required maxLength={60} lang="hi" className={inputClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm">{t.start}</span>
          <input name="startTime" type="time" required className={inputClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm">{t.end}</span>
          <input name="endTime" type="time" required className={inputClass} />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded bg-black px-4 py-2 text-white sm:col-span-2"
        >
          {t.add}
        </button>
      </form>
    </>
  );
}

export default async function SlotsPage({ searchParams }: PageProps<"/[lang]/dashboard/slots">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard")}
        >
          ← {t.slots.backToDashboard}
        </a>
        <h1 className="text-2xl font-semibold">{t.slots.title}</h1>
        <p className="text-gray-600">{t.slots.intro}</p>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <SlotsContent searchParams={searchParams} t={t.slots} locale={locale} />
      </Suspense>
    </main>
  );
}
