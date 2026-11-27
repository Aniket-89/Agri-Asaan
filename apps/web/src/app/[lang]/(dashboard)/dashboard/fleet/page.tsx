import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  DroneIcon,
  EnvelopeSimpleIcon,
  IdentificationCardIcon,
  MapPinAreaIcon,
  UserIcon,
} from "@phosphor-icons/react/dist/ssr";

import { StatusBanner } from "@/components/shared/status-banner";
import {
  Badge,
  Button,
  controlOnTintClass,
  Disclosure,
  Field,
  Page,
  PageHeader,
  Panel,
  type BadgeTone,
  PageSkeleton,
} from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  DRONE_STATUSES,
  getFleetScope,
  listDrones,
  type DroneStatus,
  type FleetRegion,
} from "@/modules/drones";
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
    .enum(["forbidden", "email_in_use", "rate_limited", "invalid", "invite_failed"])
    .optional()
    .catch(undefined),
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.fleet.title };
}

const DRONE_TONE: Record<DroneStatus, BadgeTone> = {
  active: "leaf",
  maintenance: "sun",
  retired: "neutral",
};

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
      className={controlOnTintClass}
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

      <Panel
        id="drones"
        title={t.dronesHeading}
        icon={<DroneIcon weight="duotone" className="size-5" />}
      >
        <div className="space-y-3">
          {drones.length === 0 ? <p className="text-ink-muted">{t.noDrones}</p> : null}
          <ul className="space-y-2">
            {drones.map((drone) => (
              <li key={drone.id} className="space-y-3 rounded-xl bg-canvas p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-soil-soft text-soil"
                  >
                    <DroneIcon weight="fill" className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold tracking-wide text-ink">{drone.uid}</p>
                      <Badge tone={DRONE_TONE[drone.status]}>{t.statuses[drone.status]}</Badge>
                    </div>
                    <p className="text-sm text-ink-muted">{drone.model}</p>
                    <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                      <MapPinAreaIcon weight="fill" className="size-4 text-ink-faint" aria-hidden />
                      {drone.homeRegionName ?? t.noRegion}
                    </p>
                  </div>
                </div>
                {drone.canManage ? (
                  <form action={setDroneStatusAction} className="flex gap-2">
                    <input type="hidden" name="droneId" value={drone.id} />
                    <select
                      name="status"
                      defaultValue={drone.status}
                      aria-label={`${t.droneStatus} ${drone.uid}`}
                      className={`${controlOnTintClass} min-h-10 py-1.5 text-sm`}
                    >
                      {DRONE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t.statuses[status]}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" size="sm" className="shrink-0">
                      {t.updateStatus}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>

          {canAddItems ? (
            <Disclosure summary={t.addDrone} open={drones.length === 0}>
              <form action={addDroneAction} className="grid gap-4 sm:grid-cols-2">
                <Field label={t.droneUid} hint={<span id="uid-hint">{t.droneUidHint}</span>}>
                  <input
                    name="uid"
                    required
                    maxLength={40}
                    pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,39}"
                    autoCapitalize="characters"
                    aria-describedby="uid-hint"
                    className={controlOnTintClass}
                  />
                </Field>
                <Field label={t.droneModel}>
                  <input name="model" required maxLength={80} className={controlOnTintClass} />
                </Field>
                <Field label={t.homeRegion} className="sm:col-span-2">
                  <RegionSelect
                    regions={scope.manageableRegions}
                    allowNone={scope.canAddWithoutRegion}
                    t={t}
                  />
                </Field>
                <Button className="sm:col-span-2" block>
                  {t.addDrone}
                </Button>
              </form>
            </Disclosure>
          ) : null}
        </div>
      </Panel>

      <Panel
        id="pilots"
        title={t.pilotsHeading}
        icon={<IdentificationCardIcon weight="duotone" className="size-5" />}
      >
        <div className="space-y-3">
          {pilots.length === 0 ? <p className="text-ink-muted">{t.noPilots}</p> : null}
          <ul className="space-y-2">
            {pilots.map((pilot) => (
              <li
                key={pilot.userId}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-canvas p-3 sm:p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-soft text-sky"
                >
                  <UserIcon weight="fill" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{pilot.name}</p>
                    {pilot.profile ? (
                      <Badge tone={pilot.profile.isActive ? "leaf" : "neutral"}>
                        {pilot.profile.isActive ? t.available : t.unavailable}
                      </Badge>
                    ) : null}
                  </div>
                  {pilot.profile ? (
                    <p className="text-sm text-ink-muted">
                      {pilot.profile.homeRegionName ?? t.noRegion},{" "}
                      {pilot.profile.licenseNumber
                        ? format(t.licenseShort, { number: pilot.profile.licenseNumber })
                        : t.noLicense}
                    </p>
                  ) : (
                    // Every invited pilot gets a profile; this only shows for
                    // accounts created outside the invite flow.
                    <p className="text-sm text-ink-muted">{t.noProfile}</p>
                  )}
                </div>
                {pilot.profile?.canManage ? (
                  <form action={setPilotAvailabilityAction} className="w-full sm:w-auto">
                    <input type="hidden" name="userId" value={pilot.userId} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={pilot.profile.isActive ? "false" : "true"}
                    />
                    <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                      {pilot.profile.isActive ? t.markUnavailable : t.markAvailable}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {canCreatePilots ? (
            <Disclosure summary={t.inviteHeading} open={pilots.length === 0}>
              <form action={invitePilotAction} className="grid gap-4 sm:grid-cols-2">
                <p className="flex gap-2 text-sm text-ink-muted sm:col-span-2">
                  <EnvelopeSimpleIcon
                    weight="duotone"
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  {t.inviteIntro}
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
                <Field label={t.homeRegion}>
                  <RegionSelect regions={scope.manageableRegions} allowNone={false} t={t} />
                </Field>
                <Field label={t.license}>
                  <input name="licenseNumber" maxLength={40} className={controlOnTintClass} />
                </Field>
                <Button className="sm:col-span-2" block>
                  {t.inviteSubmit}
                </Button>
              </form>
            </Disclosure>
          ) : null}
        </div>
      </Panel>
    </>
  );
}

export default async function FleetPage({ searchParams }: PageProps<"/[lang]/dashboard/fleet">) {
  const { locale, t } = await getDictionary();

  return (
    <Page>
      <PageHeader title={t.fleet.title} />
      <Suspense fallback={<PageSkeleton />}>
        <FleetContent searchParams={searchParams} t={t.fleet} locale={locale} />
      </Suspense>
    </Page>
  );
}
