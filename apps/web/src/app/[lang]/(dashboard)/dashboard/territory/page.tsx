import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { withLocale, type Dictionary } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { resolveActiveOrganization } from "@/modules/organizations";
import { getTerritoryOverview } from "@/modules/villages";
import { TerritoryRegionCard } from "@/modules/villages/components/territory-region-card";

import {
  assignMitraAction,
  assignRegionalAdminAction,
  createRegionAction,
  createVillageAction,
  removeMitraAction,
  removeRegionalAdminAction,
} from "./actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["saved"]).optional().catch(undefined),
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.territory.title };
}

function StatusMessage({
  search,
  t,
}: {
  search: z.infer<typeof searchSchema>;
  t: Dictionary["territory"];
}) {
  if (search.error) {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
        {t.errors[search.error]}
      </p>
    );
  }
  if (search.status === "saved") {
    return (
      <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-green-900">
        {t.saved}
      </p>
    );
  }
  return null;
}

async function TerritoryContent({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/territory">["searchParams"];
  t: Dictionary["territory"];
  locale: Parameters<typeof withLocale>[0];
}) {
  await connection();
  const active = await resolveActiveOrganization();
  if (!active) {
    redirect(withLocale(locale, "/login"));
  }
  if (!active.membership) {
    redirect(withLocale(locale, "/dashboard"));
  }

  const overview = await getTerritoryOverview({
    supabase: active.supabase,
    organizationId: active.membership.organization_id,
    userId: active.user.id,
    role: active.membership.role,
  });
  if (!overview) {
    notFound();
  }

  const search = searchSchema.parse(await searchParams);

  return (
    <>
      <StatusMessage search={search} t={t} />

      {overview.canManageRegions ? (
        <form
          action={createRegionAction}
          className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="mb-1 block text-sm">{t.regionName}</span>
            <input
              name="name"
              required
              maxLength={120}
              className="min-h-11 w-full rounded border px-3 py-2"
            />
          </label>
          <button type="submit" className="min-h-11 rounded bg-black px-4 py-2 text-white">
            {t.addRegion}
          </button>
        </form>
      ) : null}

      {overview.regions.length === 0 ? <p>{t.noRegions}</p> : null}

      {overview.regions.map((region) => (
        <TerritoryRegionCard
          key={region.id}
          region={region}
          overview={overview}
          t={t}
          actions={{
            createVillage: createVillageAction,
            assignRegionalAdmin: assignRegionalAdminAction,
            removeRegionalAdmin: removeRegionalAdminAction,
            assignMitra: assignMitraAction,
            removeMitra: removeMitraAction,
          }}
        />
      ))}
    </>
  );
}

export default async function TerritoryPage({
  searchParams,
}: PageProps<"/[lang]/dashboard/territory">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard")}
        >
          ← {t.territory.backToDashboard}
        </a>
        <h1 className="text-2xl font-semibold">{t.territory.title}</h1>
        <p className="text-gray-600">{t.territory.intro}</p>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <TerritoryContent searchParams={searchParams} t={t.territory} locale={locale} />
      </Suspense>
    </main>
  );
}
