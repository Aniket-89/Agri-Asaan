import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { farmerSearchSchema, listFarmers } from "@/modules/farmers";
import { getActiveMembershipContext } from "@/modules/organizations";

export const instant = false;

const FARMER_LIST_LIMIT = 50;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.farmers.title };
}

async function FarmerList({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/farmers">["searchParams"];
  t: Dictionary["farmers"];
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }

  const parsed = farmerSearchSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data.q : undefined;
  const farmers = await listFarmers(context, query || undefined);
  if (!farmers) {
    notFound();
  }

  return (
    <>
      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
        <label className="flex-1">
          <span className="mb-1 block text-sm">{t.searchLabel}</span>
          <input
            name="q"
            type="search"
            defaultValue={query ?? ""}
            maxLength={60}
            className="min-h-11 w-full rounded border px-3 py-2"
          />
        </label>
        <button type="submit" className="min-h-11 rounded border px-4 py-2">
          {t.searchSubmit}
        </button>
      </form>

      {farmers.length === 0 ? <p>{t.noResults}</p> : null}
      {farmers.length === FARMER_LIST_LIMIT ? (
        <p className="text-sm text-gray-600">
          {format(t.showingFirst, { count: FARMER_LIST_LIMIT })}
        </p>
      ) : null}

      <ul className="divide-y rounded-xl border">
        {farmers.map((farmer) => (
          <li key={farmer.id}>
            <a
              href={withLocale(locale, `/dashboard/farmers/${farmer.id}`)}
              className="flex min-h-14 flex-col justify-center px-4 py-3 hover:bg-gray-50"
            >
              <span className="font-medium">
                {farmer.fullName}
                {farmer.isActive ? null : (
                  <span className="ml-2 text-sm font-normal">({t.inactive})</span>
                )}
              </span>
              <span className="text-sm text-gray-600">
                {farmer.villageName} · {farmer.phone}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function FarmersPage({
  searchParams,
}: PageProps<"/[lang]/dashboard/farmers">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard")}
        >
          ← {t.farmers.backToDashboard}
        </a>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.farmers.title}</h1>
          <a
            href={withLocale(locale, "/dashboard/farmers/new")}
            className="min-h-11 rounded bg-black px-4 py-3 text-white"
          >
            {t.farmers.register}
          </a>
        </div>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <FarmerList searchParams={searchParams} t={t.farmers} locale={locale} />
      </Suspense>
    </main>
  );
}
