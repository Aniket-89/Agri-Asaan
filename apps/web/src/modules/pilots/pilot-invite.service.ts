import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { PilotInviteInput } from "./pilot.schema";

export type PilotInviteError = "forbidden" | "email_in_use" | "invalid" | "invite_failed";

export type PilotInviteResult = { ok: true } | { ok: false; error: PilotInviteError };

// Allowance for clock differences between this server and the database when
// deciding whether an account was created by this request.
const CLOCK_SKEW_MS = 60_000;

// Creates a pilot account by email invite (ADR 0012).
//
// 1. Authorize with the regional admin's OWN session (can_invite_pilot).
// 2. Refuse any email that already has an account. Supabase would otherwise
//    re-send an invite and return the EXISTING account for an unconfirmed
//    email, and the clean-up below must never touch a real user.
// 3. Create the auth user via Supabase invite (sends the email), then
//    provision membership + profile through provision_invited_pilot, which
//    re-checks every rule in the database.
// 4. If provisioning fails, remove the account only if it is an orphan this
//    request just created (delete_orphaned_pilot_invite enforces that).
export async function invitePilot(
  context: ActiveMembershipContext,
  input: PilotInviteInput
): Promise<PilotInviteResult> {
  if (context.role !== "regional_admin") {
    return { ok: false, error: "forbidden" };
  }

  const { data: allowed, error: checkError } = await context.supabase.rpc("can_invite_pilot", {
    p_home_region_id: input.homeRegionId,
  });
  if (checkError) {
    throw new Error("Unable to check pilot invite permission.");
  }
  if (!allowed) {
    return { ok: false, error: "forbidden" };
  }

  const admin = createSupabaseAdminClient();

  const { data: exists, error: existsError } = await admin.rpc("account_exists_for_email", {
    p_email: input.email,
  });
  if (existsError) {
    throw new Error("Unable to check whether the email already has an account.");
  }
  if (exists) {
    return { ok: false, error: "email_in_use" };
  }

  const startedAt = new Date(Date.now() - CLOCK_SKEW_MS).toISOString();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { data: { full_name: input.fullName } }
  );
  if (inviteError || !invited.user) {
    if (inviteError?.code === "email_exists" || inviteError?.status === 422) {
      return { ok: false, error: "email_in_use" };
    }
    return { ok: false, error: "invite_failed" };
  }

  const { error: provisionError } = await admin.rpc("provision_invited_pilot", {
    p_inviter_id: context.userId,
    p_user_id: invited.user.id,
    p_home_region_id: input.homeRegionId,
    p_license_number: input.licenseNumber,
  });
  if (provisionError) {
    const { error: cleanupError } = await admin.rpc("delete_orphaned_pilot_invite", {
      p_user_id: invited.user.id,
      p_not_before: startedAt,
    });
    if (cleanupError) {
      throw new Error("Pilot provisioning failed and the orphaned invite could not be checked.");
    }
    return { ok: false, error: provisionError.code === "42501" ? "forbidden" : "invalid" };
  }

  return { ok: true };
}
