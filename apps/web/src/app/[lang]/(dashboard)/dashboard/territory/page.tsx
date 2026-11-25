import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { MapPinAreaIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { StatusBanner } from "@/components/shared/status-banner";
import { Button, controlClass, EmptyState, Page, PageHeader } from "@/components/ui";
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
    return <StatusBanner kind="error" text={t.errors[search.error]} />;
  }
  if (search.status === "saved") {
    return <StatusBanner kind="success" text={t.saved} />;
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
          className="flex gap-2 rounded-2xl bg-surface p-3 shadow-soft"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t.regionName}</span>
            <input
              name="name"
              required
              maxLength={120}
              placeholder={t.regionName}
              className={controlClass}
            />
          </label>
          <Button
            className="shrink-0"
            icon={<PlusIcon weight="bold" className="size-5" aria-hidden />}
          >
            {t.addRegion}
          </Button>
        </form>
      ) : null}

      {overview.regions.length === 0 ? (
        <EmptyState
          icon={<MapPinAreaIcon weight="duotone" className="size-7" />}
          text={t.noRegions}
        />
      ) : null}

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
    <Page>
      <PageHeader title={t.territory.title} description={t.territory.intro} />
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <TerritoryContent searchParams={searchParams} t={t.territory} locale={locale} />
      </Suspense>
    </Page>
  );
}
