import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  signUp: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  hostname: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/branding/request-branding", () => ({
  getRequestHostname: mocks.hostname,
}));

vi.mock("@/lib/i18n/request-locale", () => ({
  localizedPath: async (path: string) => `/en${path}`,
}));

vi.mock("next/navigation", () => ({
  redirect: (destination: string): never => {
    throw new Error(`redirect:${destination}`);
  },
}));

import { joinAsFarmerAction, registerAction } from "./actions";

const VILLAGE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_VILLAGE_ID = "22222222-2222-4222-8222-222222222222";

function farmerForm(overrides: Record<string, string | null> = {}) {
  const values: Record<string, string | null> = {
    fullName: "Fake Farmer",
    phone: "+91 98765 00001",
    villageId: VILLAGE_ID,
    pincode: "281001",
    locality: "Fake Town",
    addressLine: "Near the fake well",
    consent: "on",
    email: "fake-farmer@example.test",
    password: "strong-password",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null) formData.set(key, value);
  }
  return formData;
}

// RPC results by function name; register_self_as_farmer succeeds by default.
function mockRpc({
  open = true,
  villages = [{ village_id: VILLAGE_ID, village_name: "Demo Village", region_name: "North" }],
  registerError = null as { code: string } | null,
} = {}) {
  mocks.rpc.mockImplementation(async (fn: string) => {
    if (fn === "farmer_registration_open") {
      return { data: open, error: null };
    }
    if (fn === "get_farmer_registration_villages") {
      return { data: villages, error: null };
    }
    return { data: registerError ? null : "farmer-id", error: registerError };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hostname.mockResolvedValue("agri-asaan.vercel.app");
  mocks.createSupabaseServerClient.mockResolvedValue({
    auth: { signUp: mocks.signUp, getUser: mocks.getUser },
    rpc: mocks.rpc,
  });
  mockRpc();
});

describe("registerAction", () => {
  it("rejects incomplete details before creating an account", async () => {
    await expect(registerAction(farmerForm({ consent: null }))).rejects.toThrow(
      "redirect:/en/register?error=invalid_registration"
    );
    await expect(registerAction(farmerForm({ phone: "12345" }))).rejects.toThrow(
      "redirect:/en/register?error=invalid_registration"
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("creates no account when the site does not take farmer sign-ups", async () => {
    mockRpc({ open: false, villages: [] });
    await expect(registerAction(farmerForm())).rejects.toThrow(
      "redirect:/en/register?error=closed"
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("creates no account for a village the site does not offer", async () => {
    await expect(registerAction(farmerForm({ villageId: OTHER_VILLAGE_ID }))).rejects.toThrow(
      "redirect:/en/register?error=invalid_registration"
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("reports an email that already has an account", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "user_already_exists" },
    });
    await expect(registerAction(farmerForm())).rejects.toThrow(
      "redirect:/en/register?error=email_in_use"
    );
  });

  it("sends unverified accounts to email verification without joining yet", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-id" }, session: null },
      error: null,
    });
    await expect(registerAction(farmerForm())).rejects.toThrow("redirect:/en/register/check-email");

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "fake-farmer@example.test",
      password: "strong-password",
      options: { data: { full_name: "Fake Farmer" } },
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("register_self_as_farmer", expect.anything());
  });

  it("joins a signed-in account as a farmer with the normalized phone", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-id" }, session: { access_token: "session" } },
      error: null,
    });
    await expect(registerAction(farmerForm())).rejects.toThrow("redirect:/en/dashboard");

    expect(mocks.rpc).toHaveBeenCalledWith("register_self_as_farmer", {
      p_hostname: "agri-asaan.vercel.app",
      p_full_name: "Fake Farmer",
      p_phone: "9876500001",
      p_pincode: "281001",
      p_locality: "Fake Town",
      p_address_line: "Near the fake well",
      p_village_id: VILLAGE_ID,
    });
  });

  it("registers by address when the village is not listed", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-id" }, session: { access_token: "session" } },
      error: null,
    });
    mockRpc({ villages: [] });
    await expect(registerAction(farmerForm({ villageId: "" }))).rejects.toThrow(
      "redirect:/en/dashboard"
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_self_as_farmer",
      expect.objectContaining({ p_pincode: "281001", p_village_id: undefined })
    );
  });

  it("requires a valid pincode and address", async () => {
    await expect(registerAction(farmerForm({ pincode: "0123" }))).rejects.toThrow(
      "redirect:/en/register?error=invalid_registration"
    );
    await expect(registerAction(farmerForm({ addressLine: "" }))).rejects.toThrow(
      "redirect:/en/register?error=invalid_registration"
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("sends the person to the join page when joining fails after sign-up", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-id" }, session: { access_token: "session" } },
      error: null,
    });
    mockRpc({ registerError: { code: "42501" } });
    await expect(registerAction(farmerForm())).rejects.toThrow(
      "redirect:/en/register/join?error=closed"
    );
  });
});

describe("joinAsFarmerAction", () => {
  it("requires a signed-in account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(joinAsFarmerAction(farmerForm())).rejects.toThrow("redirect:/en/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("joins and goes to the dashboard", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } } });
    await expect(joinAsFarmerAction(farmerForm())).rejects.toThrow("redirect:/en/dashboard");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_self_as_farmer",
      expect.objectContaining({ p_village_id: VILLAGE_ID })
    );
  });

  it("treats an existing membership as done", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } } });
    mockRpc({ registerError: { code: "23505" } });
    await expect(joinAsFarmerAction(farmerForm())).rejects.toThrow("redirect:/en/dashboard");
  });

  it("shows a validation error for missing details", async () => {
    await expect(joinAsFarmerAction(farmerForm({ locality: null }))).rejects.toThrow(
      "redirect:/en/register/join?error=invalid"
    );
  });
});
