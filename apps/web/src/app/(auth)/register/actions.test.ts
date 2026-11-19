import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  signUp: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next/navigation", () => ({
  redirect: (destination: string): never => {
    throw new Error(`redirect:${destination}`);
  },
}));

import { registerAction } from "./actions";

describe("registerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signUp: mocks.signUp },
      rpc: mocks.rpc,
    });
  });

  it("creates only the auth user and sends unverified users to email verification", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-id" }, session: null },
      error: null,
    });
    const formData = new FormData();
    formData.set("fullName", "Asha Farmer");
    formData.set("email", "asha@example.test");
    formData.set("password", "strong-password");

    await expect(registerAction(formData)).rejects.toThrow(
      "redirect:/register/check-email"
    );

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "asha@example.test",
      password: "strong-password",
      options: { data: { full_name: "Asha Farmer" } },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sends verified users to pending access without provisioning privileges", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-id" }, session: { access_token: "session" } },
      error: null,
    });
    const formData = new FormData();
    formData.set("fullName", "Asha Farmer");
    formData.set("email", "asha@example.test");
    formData.set("password", "strong-password");

    await expect(registerAction(formData)).rejects.toThrow(
      "redirect:/register/pending-access"
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});