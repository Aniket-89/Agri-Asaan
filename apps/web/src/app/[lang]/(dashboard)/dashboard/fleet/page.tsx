import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DRONE_STATUSES, getFleetScope, listDrones, type FleetRegion } from "@/modules/drones";
import { getActiveMembershipContext } from "@/modules/organizations";
import { listPilots } from "@/modules/pilots";

import {
  addDroneAction,
  invitePilotAction,
  setDroneStatusAction,
  setPilotAvailabilityAction,
} from "./actions";

export const instant = false;

const searchSchema = z.object({
  status: z.enum(["saved", "invited"]).optional().catch(undefined),
  inviteError: z
    .enum(["forbidden", "email_in_use", "invalid", "invite_failed"])
    .optional()
    .catch(undefined),
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.fleet.title };
}

const inputClass = "min-h-11 w-full rounded border px-3 py-2";
const primaryButton = "min-h-11 rounded bg-black px-4 py-2 text-white";
const secondaryButton = "min-h-11 rounded border px-3 py-2 text-sm";

function RegionSelect({
  regions,
  allowNone,
  t,
}: {
  regions: FleetRegion[];
  allowNone: boolean;
  t: Dictionary["fleet"];
}) {
  return (
    <select
      name="homeRegionId"
      required={!allowNone}
      defaultValue={allowNone ? "" : (regions[0]?.id ?? "")}
      className={inputClass}
    >
      {allowNone ? <option value="">{t.chooseRegion}</option> : null}
      {regions.map((region) => (
        <option key={region.id} value={region.id}>
          {region.name}
        </option>
      ))}
    </select>
  );
}

async function FleetContent({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/fleet">["searchParams"];
  t: Dictionary["fleet"];
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  const scope = await getFleetScope(context);
  if (!scope) {
    notFound();
  }

  const [drones, pilots, search] = await Promise.all([
    listDrones(context, scope),
    listPilots(context, scope),
    searchParams.then((value) => searchSchema.parse(value)),
  ]);
  const canAddItems = scope.manageableRegions.length > 0 || scope.canAddWithoutRegion;
  // Pilot accounts are created only by regional admins, in their own regions,
  // through the invite (ADR 0012); the database enforces the same rule.
  const canCreatePilots = context.role === "regional_admin" && scope.manageableRegions.length > 0;

  return (
    <>
      {search.error ? <StatusBanner kind="error" text={t.errors[search.error]} /> : null}
      {search.status === "saved" ? <StatusBanner kind="success" text={t.saved} /> : null}
      {search.status === "invited" ? <StatusBanner kind="success" text={t.invited} /> : null}
      {search.inviteError ? (
        <StatusBanner kind="error" text={t.inviteErrors[search.inviteError]} />
      ) : null}

      <section className="space-y-3" aria-labelledby="drones-heading">
        <h2 id="drones-heading" className="text-xl font-semibold">
          {t.dronesHeading}
        </h2>
        {drones.length === 0 ? <p className="text-gray-600">{t.noDrones}</p> : null}
        <ul className="space-y-2">
          {drones.map((drone) => (
            <li key={drone.id} className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono font-medium">{drone.uid}</p>
                <p className="text-sm">{t.statuses[drone.status]}</p>
              </div>
              <p className="text-sm text-gray-600">
                {drone.model} · {drone.homeRegionName ?? t.noRegion}
              </p>
              {drone.canManage ? (
                <form action={setDroneStatusAction} className="flex gap-2">
                  <input type="hidden" name="droneId" value={drone.id} />
                  <select
                    name="status"
                    defaultValue={drone.status}
                    aria-label={`${t.droneStatus} ${drone.uid}`}
                    className={inputClass}
                  >
                    {DRONE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t.statuses[status]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={secondaryButton}>
                    {t.updateStatus}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>

        {canAddItems ? (
          <form
            action={addDroneAction}
            className="grid gap-2 rounded border border-dashed p-3 sm:grid-cols-2"
          >
            <h3 className="font-medium sm:col-span-2">{t.addDrone}</h3>
            <label>
              <span className="mb-1 block text-sm">{t.droneUid}</span>
              <input
                name="uid"
                required
                maxLength={40}
                pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,39}"
                autoCapitalize="characters"
                aria-describedby="uid-hint"
                className={inputClass}
              />
              <span id="uid-hint" className="mt-1 block text-xs text-gray-600">
                {t.droneUidHint}
              </span>
            </label>
            <label>
              <span className="mb-1 block text-sm">{t.droneModel}</span>
              <input name="model" required maxLength={80} className={inputClass} />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm">{t.homeRegion}</span>
              <RegionSelect
                regions={scope.manageableRegions}
                allowNone={scope.canAddWithoutRegion}
                t={t}
              />
            </label>
            <button type="submit" className={`${primaryButton} sm:col-span-2`}>
              {t.addDrone}
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="pilots-heading">
        <h2 id="pilots-heading" className="text-xl font-semibold">
          {t.pilotsHeading}
        </h2>
        {pilots.length === 0 ? <p className="text-gray-600">{t.noPilots}</p> : null}
        <ul className="space-y-2">
          {pilots.map((pilot) => (
            <li key={pilot.userId} className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{pilot.name}</p>
                {pilot.profile ? (
                  <p className="text-sm">{pilot.profile.isActive ? t.available : t.unavailable}</p>
                ) : null}
              </div>
              {pilot.profile ? (
                <>
                  <p className="text-sm text-gray-600">
                    {pilot.profile.homeRegionName ?? t.noRegion} ·{" "}
                    {pilot.profile.licenseNumber
                      ? format(t.licenseShort, { number: pilot.profile.licenseNumber })
                      : t.noLicense}
                  </p>
                  {pilot.profile.canManage ? (
                    <form action={setPilotAvailabilityAction}>
                      <input type="hidden" name="userId" value={pilot.userId} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={pilot.profile.isActive ? "false" : "true"}
                      />
                      <button type="submit" className={secondaryButton}>
                        {pilot.profile.isActive ? t.markUnavailable : t.markAvailable}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                // Every invited pilot gets a profile; this only shows for
                // accounts created outside the invite flow.
                <p className="text-sm text-gray-600">{t.noProfile}</p>
              )}
            </li>
          ))}
        </ul>
        {canCreatePilots ? (
          <form
            action={invitePilotAction}
            className="grid gap-2 rounded border border-dashed p-3 sm:grid-cols-2"
          >
            <h3 className="font-medium sm:col-span-2">{t.inviteHeading}</h3>
            <p className="text-sm text-gray-600 sm:col-span-2">{t.inviteIntro}</p>
            <label>
              <span className="mb-1 block text-sm">{t.inviteName}</span>
              <input
                name="fullName"
                required
                minLength={2}
                maxLength={120}
                className={inputClass}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm">{t.inviteEmail}</span>
              <input
                name="email"
                type="email"
                required
                maxLength={320}
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm">{t.homeRegion}</span>
              <RegionSelect regions={scope.manageableRegions} allowNone={false} t={t} />
            </label>
            <label>
              <span className="mb-1 block text-sm">{t.license}</span>
              <input name="licenseNumber" maxLength={40} className={inputClass} />
            </label>
            <button type="submit" className={`${primaryButton} sm:col-span-2`}>
              {t.inviteSubmit}
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}

export default async function FleetPage({ searchParams }: PageProps<"/[lang]/dashboard/fleet">) {
  const { locale, t } = await getDictionary();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <a
          className="inline-block min-h-11 py-2 text-sm underline"
          href={withLocale(locale, "/dashboard")}
        >
          ← {t.fleet.backToDashboard}
        </a>
        <h1 className="text-2xl font-semibold">{t.fleet.title}</h1>
      </header>
      <Suspense fallback={<p aria-busy="true">…</p>}>
        <FleetContent searchParams={searchParams} t={t.fleet} locale={locale} />
      </Suspense>
    </main>
  );
}
