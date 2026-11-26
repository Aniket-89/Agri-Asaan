import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { EnvelopeSimpleIcon, MapPinAreaIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { StatusBanner } from "@/components/shared/status-banner";
import {
  Button,
  controlClass,
  controlOnTintClass,
  Disclosure,
  EmptyState,
  Field,
  Page,
  PageHeader,
} from "@/components/ui";
import { withLocale, type Dictionary } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { resolveActiveOrganization } from "@/modules/organizations";
import { getTerritoryOverview, type TerritoryOverview } from "@/modules/villages";
import { TerritoryRegionCard } from "@/modules/villages/components/territory-region-card";

import {
  addRegionPincodeAction,
  assignMitraAction,
  assignRegionalAdminAction,
  createRegionAction,
  createVillageAction,
  inviteMitraAction,
  inviteRegionalAdminAction,
  removeMitraAction,
  removeRegionalAdminAction,
  removeRegionPincodeAction,
} from "./actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["saved", "invited", "invitedAdmin"]).optional().catch(undefined),
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
  inviteError: z
    .enum(["forbidden", "email_in_use", "rate_limited", "invalid", "invite_failed"])
    .optional()
    .catch(undefined),
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
  if (search.inviteError) {
    return <StatusBanner kind="error" text={t.inviteErrors[search.inviteError]} />;
  }
  if (search.status === "saved") {
    return <StatusBanner kind="success" text={t.saved} />;
  }
  if (search.status === "invited") {
    return <StatusBanner kind="success" text={t.invited} />;
  }
  if (search.status === "invitedAdmin") {
    return <StatusBanner kind="success" text={t.invitedAdmin} />;
  }
  return null;
}

// Organization admins create regional admin accounts by email invite
// (ADR 0020); the database re-checks the region belongs to their organization.
function InviteRegionalAdminForm({
  regions,
  t,
}: {
  regions: TerritoryOverview["regionalAdminInviteRegions"];
  t: Dictionary["territory"];
}) {
  return (
    <section className="rounded-2xl bg-surface p-3 shadow-soft">
      <Disclosure summary={t.inviteRegionalAdmin}>
        <form action={inviteRegionalAdminAction} className="grid gap-4 sm:grid-cols-2">
          <p className="flex gap-2 text-sm text-ink-muted sm:col-span-2">
            <EnvelopeSimpleIcon weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.inviteRegionalAdminIntro}
          </p>
          <Field label={t.inviteName}>
            <input
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              className={controlOnTintClass}
            />
          </Field>
          <Field label={t.inviteEmail}>
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="off"
              className={controlOnTintClass}
            />
          </Field>
          <Field label={t.inviteRegion} className="sm:col-span-2">
            <select name="regionId" required defaultValue="" className={controlOnTintClass}>
              <option value="" disabled>
                {t.chooseRegion}
              </option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </Field>
          <Button className="sm:col-span-2" block>
            {t.inviteSubmit}
          </Button>
        </form>
      </Disclosure>
    </section>
  );
}

// Regional admins create mitra accounts by email invite (ADR 0019); the
// database re-checks that the village is in one of their regions.
function InviteMitraForm({
  villages,
  t,
}: {
  villages: TerritoryOverview["mitraInviteVillages"];
  t: Dictionary["territory"];
}) {
  const regionNames = [...new Set(villages.map((village) => village.regionName))];
  const options = (list: typeof villages) =>
    list.map((village) => (
      <option key={village.id} value={village.id}>
        {village.name}
      </option>
    ));

  return (
    <section className="rounded-2xl bg-surface p-3 shadow-soft">
      <Disclosure summary={t.inviteMitra}>
        <form action={inviteMitraAction} className="grid gap-4 sm:grid-cols-2">
          <p className="flex gap-2 text-sm text-ink-muted sm:col-span-2">
            <EnvelopeSimpleIcon weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.inviteMitraIntro}
          </p>
          <Field label={t.inviteName}>
            <input
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              className={controlOnTintClass}
            />
          </Field>
          <Field label={t.inviteEmail}>
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="off"
              className={controlOnTintClass}
            />
          </Field>
          <Field label={t.inviteVillage} className="sm:col-span-2">
            <select name="villageId" required defaultValue="" className={controlOnTintClass}>
              <option value="" disabled>
                {t.chooseVillage}
              </option>
              {regionNames.length > 1
                ? regionNames.map((regionName) => (
                    <optgroup key={regionName} label={regionName}>
                      {options(villages.filter((village) => village.regionName === regionName))}
                    </optgroup>
                  ))
                : options(villages)}
            </select>
          </Field>
          <Button className="sm:col-span-2" block>
            {t.inviteSubmit}
          </Button>
        </form>
      </Disclosure>
    </section>
  );
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

      {overview.regionalAdminInviteRegions.length > 0 ? (
        <InviteRegionalAdminForm regions={overview.regionalAdminInviteRegions} t={t} />
      ) : null}

      {overview.mitraInviteVillages.length > 0 ? (
        <InviteMitraForm villages={overview.mitraInviteVillages} t={t} />
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
            addPincode: addRegionPincodeAction,
            removePincode: removeRegionPincodeAction,
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
