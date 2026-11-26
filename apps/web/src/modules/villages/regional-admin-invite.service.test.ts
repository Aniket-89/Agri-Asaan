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
import { inviteRegionalAdmin } from "./regional-admin-invite.service";
import { regionalAdminInviteInputSchema } from "./territory.schema";

const REGION_ID = "e1000000-0000-4000-8000-000000000002";
const input = { fullName: "Fake Admin", email: "fake-admin@example.test", regionId: REGION_ID };

function context(role: ActiveMembershipContext["role"] = "organization_admin") {
  return {
    role,
    userId: "inviter-id",
    supabase: { rpc: mocks.sessionRpc },
  } as unknown as ActiveMembershipContext;
}

function mockAdmin({ outcome = "claimed", provisionError = null as { code: string } | null } = {}) {
  mocks.adminRpc.mockImplementation(async (fn: string) => {
    if (fn === "claim_regional_admin_invite") {
      return { data: [{ invite_id: "invite-id", outcome }], error: null };
    }
    if (fn === "provision_invited_regional_admin") {
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

describe("inviteRegionalAdmin", () => {
  it("refuses anyone but an organization admin before using the service key", async () => {
    await expect(inviteRegionalAdmin(context("regional_admin"), input)).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("refuses a region the session check rejects before using the service key", async () => {
    mocks.sessionRpc.mockResolvedValue({ data: false, error: null });
    await expect(inviteRegionalAdmin(context(), input)).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.sessionRpc).toHaveBeenCalledWith("can_invite_regional_admin", {
      p_region_id: REGION_ID,
    });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("stops before creating an account when the email is taken or rate limited", async () => {
    mockAdmin({ outcome: "rate_limited" });
    await expect(inviteRegionalAdmin(context(), input)).resolves.toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("invites and provisions the claimed account", async () => {
    await expect(inviteRegionalAdmin(context(), input)).resolves.toEqual({ ok: true });
    expect(mocks.adminRpc).toHaveBeenCalledWith("claim_regional_admin_invite", {
      p_inviter_id: "inviter-id",
      p_email: "fake-admin@example.test",
      p_region_id: REGION_ID,
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("provision_invited_regional_admin", {
      p_invite_id: "invite-id",
      p_user_id: "new-user",
    });
  });

  it("releases the claim and removes only a fresh orphan when provisioning fails", async () => {
    mockAdmin({ provisionError: { code: "42501" } });
    await expect(inviteRegionalAdmin(context(), input)).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("fail_regional_admin_invite", {
      p_invite_id: "invite-id",
      p_reason: "provisioning failed",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "delete_orphaned_pilot_invite",
      expect.objectContaining({ p_user_id: "new-user" })
    );
  });
});

describe("regionalAdminInviteInputSchema", () => {
  it("normalizes the email and requires a region", () => {
    expect(
      regionalAdminInviteInputSchema.parse({ ...input, email: " Fake-Admin@Example.TEST " })
    ).toEqual(input);
    expect(regionalAdminInviteInputSchema.safeParse({ ...input, regionId: "" }).success).toBe(
      false
    );
  });
});
