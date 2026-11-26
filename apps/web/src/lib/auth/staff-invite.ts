import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StaffInviteError =
  "forbidden" | "email_in_use" | "rate_limited" | "invalid" | "invite_failed";

export type StaffInviteResult = { ok: true } | { ok: false; error: StaffInviteError };

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type Claim = { invite_id: string; outcome: string };

// The role-specific database calls of one invite kind (mitra, regional admin).
export type StaffInviteSteps = {
  claim: (
    admin: AdminClient
  ) => PromiseLike<{ data: Claim[] | null; error: PostgrestError | null }>;
  provision: (
    admin: AdminClient,
    inviteId: string,
    userId: string
  ) => PromiseLike<{ error: PostgrestError | null }>;
  fail: (
    admin: AdminClient,
    inviteId: string,
    reason: string
  ) => PromiseLike<{ error: PostgrestError | null }>;
};

// Allowance for clock differences between this server and the database when
// deciding whether an account was created by this request (clean-up only).
const CLOCK_SKEW_MS = 60_000;

// Runs the service-key part of a staff invite (ADR 0012, 0019, 0020). The
// caller MUST already have authorized the inviter with their own session.
//
// 1. Atomically claim the email (shared per-email lock, rate limit, refuse an
//    email with an account or any open claim; every attempt is recorded).
// 2. Create the auth user via Supabase invite (sends the email).
// 3. Provision membership and scope, only for this claim and a matching
//    fresh account.
// 4. On failure, release the claim; remove the account only if it is an
//    orphan this request just created.
export async function runStaffInvite(
  email: string,
  fullName: string,
  steps: StaffInviteSteps
): Promise<StaffInviteResult> {
  const admin = createSupabaseAdminClient();

  const { data: claims, error: claimError } = await steps.claim(admin);
  if (claimError) {
    if (claimError.code === "42501") {
      return { ok: false, error: "forbidden" };
    }
    if (claimError.code === "23514") {
      return { ok: false, error: "invalid" };
    }
    throw new Error("Unable to claim the invite.");
  }
  const claim = claims?.[0];
  if (!claim) {
    throw new Error("Invite claim returned no result.");
  }
  if (claim.outcome === "email_in_use" || claim.outcome === "rate_limited") {
    return { ok: false, error: claim.outcome };
  }

  const release = async (reason: string) => {
    const { error } = await steps.fail(admin, claim.invite_id, reason);
    if (error) {
      throw new Error("Unable to release the invite claim.");
    }
  };

  const startedAt = new Date(Date.now() - CLOCK_SKEW_MS).toISOString();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (inviteError || !invited.user) {
    await release("invite email could not be sent");
    if (inviteError?.code === "email_exists" || inviteError?.status === 422) {
      return { ok: false, error: "email_in_use" };
    }
    return { ok: false, error: "invite_failed" };
  }

  const { error: provisionError } = await steps.provision(admin, claim.invite_id, invited.user.id);
  if (provisionError) {
    await release("provisioning failed");
    const { error: cleanupError } = await admin.rpc("delete_orphaned_pilot_invite", {
      p_user_id: invited.user.id,
      p_not_before: startedAt,
    });
    if (cleanupError) {
      throw new Error("Provisioning failed and the orphaned invite could not be checked.");
    }
    return { ok: false, error: provisionError.code === "42501" ? "forbidden" : "invalid" };
  }

  return { ok: true };
}
