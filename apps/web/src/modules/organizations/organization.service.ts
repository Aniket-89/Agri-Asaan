import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationMembership = {
  organization_id: string;
  role: "super_admin" | "admin" | "mitra" | "farmer" | "pilot";
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type OrganizationMembershipRow = {
  organization_id: string;
  role: OrganizationMembership["role"];
  organization:
    | { id: string; name: string; slug: string }
    | Array<{ id: string; name: string; slug: string }>;
};

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
    .select("organization_id, role, organization:organizations(id, name, slug)")
    .eq("user_id", user.id);

  if (membershipError) {
    throw new Error("Unable to resolve organization memberships.");
  }

  const memberships = ((data ?? []) as unknown as OrganizationMembershipRow[])
    .map((row) => {
      const organization = Array.isArray(row.organization)
        ? row.organization[0]
        : row.organization;

      if (!organization) {
        return null;
      }

      return {
        organization_id: row.organization_id,
        role: row.role,
        organization,
      } satisfies OrganizationMembership;
    })
    .filter((membership): membership is OrganizationMembership => membership !== null);

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
    context.memberships.find(
      (membership) => membership.organization_id === organizationId
    ) ?? null
  );
}
