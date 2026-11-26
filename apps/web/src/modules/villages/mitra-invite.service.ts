import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { MitraInviteInput } from "./territory.schema";

export type MitraInviteError =
  "forbidden" | "email_in_use" | "rate_limited" | "invalid" | "invite_failed";

export type MitraInviteResult = { ok: true } | { ok: false; error: MitraInviteError };

// Allowance for clock differences between this server and the database when
// deciding whether an account was created by this request (clean-up only).
const CLOCK_SKEW_MS = 60_000;

// Creates a mitra account by email invite, assigned to one village of the
// regional admin's region (ADR 0019). Same steps as the pilot invite (ADR 0012):
//
// 1. Authorize with the regional admin's OWN session (can_invite_mitra).
// 2. With the service key, atomically claim the email (claim_mitra_invite).
//    Pilot and mitra invites share the per-email lock and open-claim check.
// 3. Create the auth user via Supabase invite (sends the email).
// 4. provision_invited_mitra creates the membership and village assignment,
//    only for this claim and a matching fresh account.
// 5. On any failure, release the claim; remove the account only if it is an
//    orphan this request just created.
export async function inviteMitra(
  context: ActiveMembershipContext,
  input: MitraInviteInput
): Promise<MitraInviteResult> {
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

  const admin = createSupabaseAdminClient();

  const { data: claims, error: claimError } = await admin.rpc("claim_mitra_invite", {
    p_inviter_id: context.userId,
    p_email: input.email,
    p_village_id: input.villageId,
  });
  if (claimError) {
    if (claimError.code === "42501") {
      return { ok: false, error: "forbidden" };
    }
    if (claimError.code === "23514") {
      return { ok: false, error: "invalid" };
    }
    throw new Error("Unable to claim the mitra invite.");
  }
  const claim = claims?.[0];
  if (!claim) {
    throw new Error("Mitra invite claim returned no result.");
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

  const { error: provisionError } = await admin.rpc("provision_invited_mitra", {
    p_invite_id: claim.invite_id,
    p_user_id: invited.user.id,
  });
  if (provisionError) {
    await releaseClaim(admin, claim.invite_id, "provisioning failed");
    const { error: cleanupError } = await admin.rpc("delete_orphaned_pilot_invite", {
      p_user_id: invited.user.id,
      p_not_before: startedAt,
    });
    if (cleanupError) {
      throw new Error("Mitra provisioning failed and the orphaned invite could not be checked.");
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
  const { error } = await admin.rpc("fail_mitra_invite", {
    p_invite_id: inviteId,
    p_reason: reason,
  });
  if (error) {
    throw new Error("Unable to release the mitra invite claim.");
  }
}
