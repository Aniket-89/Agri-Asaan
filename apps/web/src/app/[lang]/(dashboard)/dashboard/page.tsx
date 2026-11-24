import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getDictionary, localizedHref } from "@/lib/i18n/dictionary";
import { getOrganizationBranding, PLATFORM_DEFAULT_BRANDING } from "@/modules/branding";
import { resolveActiveOrganization } from "@/modules/organizations";
import { canWorkWithFarmers } from "@/modules/farmers";
import { canViewTerritoryAdmin } from "@/modules/villages";

export const instant = false;

async function DashboardContent() {
  await connection();
  const context = await resolveActiveOrganization();

  if (!context) {
    redirect(await localizedHref("/login"));
  }

  const { data: profile } = await context.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", context.user.id)
    .single();

  const active = context.membership;
  const { t } = await getDictionary();
  const territoryHref = await localizedHref("/dashboard/territory");
  const farmersHref = await localizedHref("/dashboard/farmers");
  const branding = active
    ? await getOrganizationBranding(context.supabase, active.organization_id)
    : PLATFORM_DEFAULT_BRANDING;

  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: branding.primaryColor }}>
          {branding.name} Dashboard
        </h1>
        <form action="/api/auth/signout" method="post">
          <button className="rounded border px-3 py-2" type="submit">
            Logout
          </button>
        </form>
      </header>

      {context.memberships.length > 1 ? (
        <form action="/api/organization/select" method="post" className="flex items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm">Active organization</span>
            <select
              className="rounded border px-3 py-2"
              name="organizationId"
              defaultValue={active?.organization_id}
            >
              {context.memberships.map((membership) => (
                <option key={membership.organization_id} value={membership.organization_id}>
                  {membership.organization.name} — {membership.role}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded bg-black px-4 py-2 text-white" type="submit">
            Switch
          </button>
        </form>
      ) : null}

      {active ? (
        <section className="rounded-xl border p-5">
          <p className="text-sm text-gray-600">Signed in as</p>
          <p className="font-medium">{profile?.full_name || context.user.email}</p>
          <p className="mt-4 text-sm text-gray-600">Active organization</p>
          <p className="font-medium">{active.organization.name}</p>
          <p className="text-sm">Role: {active.role}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {canWorkWithFarmers(active.role) ? (
              <a
                className="inline-block min-h-11 rounded bg-black px-4 py-3 text-white"
                href={farmersHref}
              >
                {t.dashboard.farmersLink}
              </a>
            ) : null}
            {canViewTerritoryAdmin(active.role) ? (
              <a className="inline-block min-h-11 rounded border px-4 py-3" href={territoryHref}>
                {t.dashboard.territoryLink}
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border p-5">
          <p>You are not a member of an organization yet.</p>
          <p className="mt-2 text-sm text-gray-600">
            Ask your organization administrator to add you. You will see your organization here once
            access is granted.
          </p>
        </section>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-6">
      <Suspense fallback={<p>Loading dashboard…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
