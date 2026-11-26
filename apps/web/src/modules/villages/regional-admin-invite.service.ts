import "server-only";

import { runStaffInvite, type StaffInviteResult } from "@/lib/auth/staff-invite";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { RegionalAdminInviteInput } from "./territory.schema";

// Creates a regional admin account by email invite, assigned to one region of
// the organization (ADR 0020). Authorized first with the organization admin's
// OWN session; only then is the service key used.
export async function inviteRegionalAdmin(
  context: ActiveMembershipContext,
  input: RegionalAdminInviteInput
): Promise<StaffInviteResult> {
  if (context.role !== "organization_admin") {
    return { ok: false, error: "forbidden" };
  }

  const { data: allowed, error: checkError } = await context.supabase.rpc(
    "can_invite_regional_admin",
    { p_region_id: input.regionId }
  );
  if (checkError) {
    throw new Error("Unable to check regional admin invite permission.");
  }
  if (!allowed) {
    return { ok: false, error: "forbidden" };
  }

  return runStaffInvite(input.email, input.fullName, {
    claim: (admin) =>
      admin.rpc("claim_regional_admin_invite", {
        p_inviter_id: context.userId,
        p_email: input.email,
        p_region_id: input.regionId,
      }),
    provision: (admin, inviteId, userId) =>
      admin.rpc("provision_invited_regional_admin", { p_invite_id: inviteId, p_user_id: userId }),
    fail: (admin, inviteId, reason) =>
      admin.rpc("fail_regional_admin_invite", { p_invite_id: inviteId, p_reason: reason }),
  });
}
