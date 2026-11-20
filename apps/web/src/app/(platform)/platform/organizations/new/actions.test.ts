import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/modules/platform", () => ({
  requirePlatformRole: mocks.requirePlatformRole,
}));

vi.mock("next/navigation", () => ({
  redirect: (destination: string): never => {
    throw new Error(`redirect:${destination}`);
  },
}));

import { provisionOrganizationAction } from "./actions";

describe("provisionOrganizationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformRole.mockResolvedValue({
      supabase: { rpc: mocks.rpc },
    });
    mocks.rpc.mockResolvedValue({ data: "organization-id", error: null });
  });

  it("passes the trimmed organization admin email to the protected provisioning RPC", async () => {
    const formData = new FormData();
    formData.set("name", "Example Organization");
    formData.set("slug", "example-organization");
    formData.set("organizationType", "customer");
    formData.set("initialAdminEmail", " admin@example.test ");

    await expect(provisionOrganizationAction(formData)).rejects.toThrow(
      "redirect:/platform/organizations/organization-id"
    );

    expect(mocks.requirePlatformRole).toHaveBeenCalledWith([
      "platform_owner",
      "system_admin",
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("provision_customer_organization", {
      p_name: "Example Organization",
      p_slug: "example-organization",
      p_organization_type: "customer",
      p_initial_admin_email: "admin@example.test",
      p_brand_name: null,
      p_brand_primary_color: null,
      p_enabled_features: [],
    });
  });
});