import "server-only";

import { runStaffInvite, type StaffInviteResult } from "@/lib/auth/staff-invite";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { MitraInviteInput } from "./territory.schema";

// Creates a mitra account by email invite, assigned to one village of the
// regional admin's region (ADR 0019). Authorized first with the regional
// admin's OWN session; only then is the service key used.
export async function inviteMitra(
  context: ActiveMembershipContext,
  input: MitraInviteInput
): Promise<StaffInviteResult> {
  if (context.role !== "regional_admin") {
    return { ok: false, error: "forbidden" };
  }

  const { data: allowed, error: checkError } = await context.supabase.rpc("can_invite_mitra", {
    p_village_id: input.villageId,
  });
  if (checkError) {
    throw new Error("Unable to check mitra invite permission.");
  }
  if (!allowed) {
    return { ok: false, error: "forbidden" };
  }

  return runStaffInvite(input.email, input.fullName, {
    claim: (admin) =>
      admin.rpc("claim_mitra_invite", {
        p_inviter_id: context.userId,
        p_email: input.email,
        p_village_id: input.villageId,
      }),
    provision: (admin, inviteId, userId) =>
      admin.rpc("provision_invited_mitra", { p_invite_id: inviteId, p_user_id: userId }),
    fail: (admin, inviteId, reason) =>
      admin.rpc("fail_mitra_invite", { p_invite_id: inviteId, p_reason: reason }),
  });
}
