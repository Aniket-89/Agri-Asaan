import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { PilotInviteInput } from "./pilot.schema";

export type PilotInviteError =
  "forbidden" | "email_in_use" | "rate_limited" | "invalid" | "invite_failed";

export type PilotInviteResult = { ok: true } | { ok: false; error: PilotInviteError };

// Allowance for clock differences between this server and the database when
// deciding whether an account was created by this request (clean-up only).
const CLOCK_SKEW_MS = 60_000;

// Creates a pilot account by email invite (ADR 0012).
//
// 1. Authorize with the regional admin's OWN session (can_invite_pilot).
// 2. With the service key, atomically CLAIM the email (claim_pilot_invite):
//    per-email lock, rate limit, refuse emails with an account or an open
//    claim, and record the attempt. A concurrent invite for the same email
//    stops here, before any account exists, so it can never receive another
//    request's account.
// 3. Create the auth user via Supabase invite (sends the email).
// 4. Provision membership + profile through provision_invited_pilot, which
//    requires this claim and an account matching it.
// 5. On any failure, release the claim; remove the account only if it is an
//    orphan this request just created.
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

  const { data: claims, error: claimError } = await admin.rpc("claim_pilot_invite", {
    p_inviter_id: context.userId,
    p_email: input.email,
    p_home_region_id: input.homeRegionId,
  });
  if (claimError) {
    if (claimError.code === "42501") {
      return { ok: false, error: "forbidden" };
    }
    if (claimError.code === "23514") {
      return { ok: false, error: "invalid" };
    }
    throw new Error("Unable to claim the pilot invite.");
  }
  const claim = claims?.[0];
  if (!claim) {
    throw new Error("Pilot invite claim returned no result.");
  }
  if (claim.outcome === "email_in_use" || claim.outcome === "rate_limited") {
    return { ok: false, error: claim.outcome };
  }

  const startedAt = new Date(Date.now() - CLOCK_SKEW_MS).toISOString();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { data: { full_name: input.fullName } }
  );
  if (inviteError || !invited.user) {
    await releaseClaim(admin, claim.invite_id, "invite email could not be sent");
    if (inviteError?.code === "email_exists" || inviteError?.status === 422) {
      return { ok: false, error: "email_in_use" };
    }
    return { ok: false, error: "invite_failed" };
  }

  const { error: provisionError } = await admin.rpc("provision_invited_pilot", {
    p_invite_id: claim.invite_id,
    p_user_id: invited.user.id,
    p_license_number: input.licenseNumber,
  });
  if (provisionError) {
    await releaseClaim(admin, claim.invite_id, "provisioning failed");
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

async function releaseClaim(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  inviteId: string,
  reason: string
) {
  const { error } = await admin.rpc("fail_pilot_invite", {
    p_invite_id: inviteId,
    p_reason: reason,
  });
  if (error) {
    throw new Error("Unable to release the pilot invite claim.");
  }
}
