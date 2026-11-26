import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionRpc: vi.fn(),
  adminRpc: vi.fn(),
  inviteUserByEmail: vi.fn(),
  createAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));

import type { ActiveMembershipContext } from "@/modules/organizations";
import { inviteMitra } from "./mitra-invite.service";
import { mitraInviteInputSchema } from "./territory.schema";

const VILLAGE_ID = "e2000000-0000-4000-8000-000000000001";
const input = { fullName: "Fake Mitra", email: "fake-mitra@example.test", villageId: VILLAGE_ID };

function context(role: ActiveMembershipContext["role"] = "regional_admin") {
  return {
    role,
    userId: "inviter-id",
    supabase: { rpc: mocks.sessionRpc },
  } as unknown as ActiveMembershipContext;
}

// Admin RPC results by function name; everything succeeds by default.
function mockAdmin({ outcome = "claimed", provisionError = null as { code: string } | null } = {}) {
  mocks.adminRpc.mockImplementation(async (fn: string) => {
    if (fn === "claim_mitra_invite") {
      return { data: [{ invite_id: "invite-id", outcome }], error: null };
    }
    if (fn === "provision_invited_mitra") {
      return { data: provisionError ? null : "tenant-id", error: provisionError };
    }
    return { data: true, error: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessionRpc.mockResolvedValue({ data: true, error: null });
  mocks.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
  mocks.createAdmin.mockReturnValue({
    rpc: mocks.adminRpc,
    auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail } },
  });
  mockAdmin();
});

describe("inviteMitra", () => {
  it("refuses anyone but a regional admin before using the service key", async () => {
    await expect(inviteMitra(context("organization_admin"), input)).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("refuses a village outside the admin's regions before using the service key", async () => {
    mocks.sessionRpc.mockResolvedValue({ data: false, error: null });
    await expect(inviteMitra(context(), input)).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.sessionRpc).toHaveBeenCalledWith("can_invite_mitra", {
      p_village_id: VILLAGE_ID,
    });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("stops before creating an account when the email is taken", async () => {
    mockAdmin({ outcome: "email_in_use" });
    await expect(inviteMitra(context(), input)).resolves.toEqual({
      ok: false,
      error: "email_in_use",
    });
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("invites and provisions the claimed account", async () => {
    await expect(inviteMitra(context(), input)).resolves.toEqual({ ok: true });
    expect(mocks.adminRpc).toHaveBeenCalledWith("claim_mitra_invite", {
      p_inviter_id: "inviter-id",
      p_email: "fake-mitra@example.test",
      p_village_id: VILLAGE_ID,
    });
    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith("fake-mitra@example.test", {
      data: { full_name: "Fake Mitra" },
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("provision_invited_mitra", {
      p_invite_id: "invite-id",
      p_user_id: "new-user",
    });
  });

  it("releases the claim and removes only a fresh orphan when provisioning fails", async () => {
    mockAdmin({ provisionError: { code: "23514" } });
    await expect(inviteMitra(context(), input)).resolves.toEqual({
      ok: false,
      error: "invalid",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("fail_mitra_invite", {
      p_invite_id: "invite-id",
      p_reason: "provisioning failed",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "delete_orphaned_pilot_invite",
      expect.objectContaining({ p_user_id: "new-user" })
    );
  });

  it("releases the claim when the invite email cannot be sent", async () => {
    mocks.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { status: 500 } });
    await expect(inviteMitra(context(), input)).resolves.toEqual({
      ok: false,
      error: "invite_failed",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("fail_mitra_invite", {
      p_invite_id: "invite-id",
      p_reason: "invite email could not be sent",
    });
    expect(mocks.adminRpc).not.toHaveBeenCalledWith("provision_invited_mitra", expect.anything());
  });
});

describe("mitraInviteInputSchema", () => {
  it("normalizes the email and trims the name", () => {
    expect(
      mitraInviteInputSchema.parse({
        ...input,
        fullName: "  Fake Mitra ",
        email: " Fake@Example.TEST ",
      })
    ).toEqual({ ...input, email: "fake@example.test" });
  });

  it("rejects a missing village or a bad email", () => {
    expect(mitraInviteInputSchema.safeParse({ ...input, villageId: "" }).success).toBe(false);
    expect(mitraInviteInputSchema.safeParse({ ...input, email: "nope" }).success).toBe(false);
  });
});
