import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOrganizationRole, type OrganizationRole } from "./organization-roles";

export type OrganizationMembership = {
  organization_id: string;
  role: OrganizationRole;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

// organization_members has two foreign keys to organizations (tenant_id and
// organization_id), so the embed must name the relationship explicitly.
const MEMBERSHIP_SELECT =
  "organization_id, role, organization:organizations!organization_members_organization_id_fkey(id, name, slug)";

export async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data, error: membershipError } = await supabase
    .from("organization_members")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", user.id);

  if (membershipError) {
    throw new Error("Unable to resolve organization memberships.");
  }

  const memberships: OrganizationMembership[] = [];
  for (const row of data ?? []) {
    if (row.organization && isOrganizationRole(row.role)) {
      memberships.push({
        organization_id: row.organization_id,
        role: row.role,
        organization: row.organization,
      });
    }
  }

  return { supabase, user, memberships };
}

export async function resolveActiveOrganization() {
  const context = await getAuthenticatedContext();
  if (!context) {
    return null;
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore.get("agri_active_organization")?.value;
  const selected = context.memberships.find(
    (membership) => membership.organization_id === selectedId
  );

  const membership = selected ?? context.memberships[0] ?? null;
  return { ...context, membership };
}

export async function verifyOrganizationMembership(organizationId: string) {
  const context = await getAuthenticatedContext();
  if (!context) {
    return null;
  }

  return (
    context.memberships.find((membership) => membership.organization_id === organizationId) ?? null
  );
}
