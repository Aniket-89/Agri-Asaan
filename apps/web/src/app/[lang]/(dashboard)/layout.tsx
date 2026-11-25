import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";
import { navItemsForRole } from "@/components/layout/nav-items";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getOrganizationBranding, PLATFORM_DEFAULT_BRANDING } from "@/modules/branding";
import { resolveActiveOrganization } from "@/modules/organizations";

// Navigation, brand, and account controls around every signed-in page. Pages
// still check access themselves; the shell only decides what to show.
async function Shell() {
  await connection();
  const context = await resolveActiveOrganization();
  if (!context) {
    // The page redirects to sign-in.
    return null;
  }
  const { locale, t } = await getDictionary();
  const membership = context.membership;
  const [branding, profile] = await Promise.all([
    membership
      ? getOrganizationBranding(context.supabase, membership.organization_id)
      : Promise.resolve(PLATFORM_DEFAULT_BRANDING),
    context.supabase.from("profiles").select("full_name").eq("id", context.user.id).maybeSingle(),
  ]);

  return (
    <AppShell
      branding={branding}
      items={membership ? navItemsForRole(membership.role) : []}
      userName={profile.data?.full_name || context.user.email || ""}
      roleLabel={membership ? t.shell.roles[membership.role] : ""}
      organizationName={membership?.organization.name ?? ""}
      locale={locale}
      t={t}
    />
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* Brand-neutral placeholder: the same height as the top bar, no logo. */}
      <Suspense fallback={<div className="h-16 bg-surface shadow-soft lg:hidden" />}>
        <Shell />
      </Suspense>
      <div className="pb-24 lg:pb-10 lg:pl-64">{children}</div>
    </div>
  );
}
