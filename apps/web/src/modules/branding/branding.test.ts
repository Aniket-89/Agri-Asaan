import { describe, expect, it } from "vitest";

import {
  applyTenantBranding,
  brandLogoUrl,
  normalizeHostname,
  PLATFORM_DEFAULT_BRANDING,
  type TenantBrandOverrides,
} from "./branding";

const TENANT_ID = "e0000000-0000-4000-8000-000000000002";
const SUPABASE_URL = "http://127.0.0.1:54321";

const overrides = (values: Partial<TenantBrandOverrides>): TenantBrandOverrides => ({
  brand_name: null,
  brand_primary_color: null,
  brand_accent_color: null,
  brand_tagline: null,
  brand_logo_path: null,
  ...values,
});

describe("applyTenantBranding", () => {
  it("returns the platform default when no tenant brand is resolved", () => {
    expect(applyTenantBranding(PLATFORM_DEFAULT_BRANDING, null)).toEqual(PLATFORM_DEFAULT_BRANDING);
  });

  it("applies every tenant field", () => {
    const branding = applyTenantBranding(
      PLATFORM_DEFAULT_BRANDING,
      overrides({
        brand_name: "Greenfield Agri",
        brand_primary_color: "#1d4ed8",
        brand_accent_color: "#f59e0b",
        brand_tagline: "Fake tagline",
        brand_logo_path: `${TENANT_ID}/logo.png`,
      }),
      SUPABASE_URL
    );

    expect(branding).toEqual({
      name: "Greenfield Agri",
      tagline: "Fake tagline",
      primaryColor: "#1d4ed8",
      accentColor: "#f59e0b",
      logoUrl: `${SUPABASE_URL}/storage/v1/object/public/brand-assets/${TENANT_ID}/logo.png`,
      isPlatformDefault: false,
    });
  });

  it("never shows the platform tagline or logo for a tenant brand", () => {
    const branding = applyTenantBranding(
      PLATFORM_DEFAULT_BRANDING,
      overrides({ brand_name: "Greenfield Agri" }),
      SUPABASE_URL
    );

    expect(branding.tagline).toBe("");
    expect(branding.logoUrl).toBeNull();
  });

  it("falls back per field when tenant colors or names are blank or invalid", () => {
    const branding = applyTenantBranding(
      PLATFORM_DEFAULT_BRANDING,
      overrides({
        brand_name: "   ",
        brand_primary_color: "red; background: url(x)",
        brand_accent_color: "#12345",
      })
    );

    expect(branding.name).toBe(PLATFORM_DEFAULT_BRANDING.name);
    expect(branding.primaryColor).toBe(PLATFORM_DEFAULT_BRANDING.primaryColor);
    expect(branding.accentColor).toBe(PLATFORM_DEFAULT_BRANDING.accentColor);
    expect(branding.isPlatformDefault).toBe(false);
  });
});

describe("brandLogoUrl", () => {
  it("rejects paths that do not match the storage layout", () => {
    expect(brandLogoUrl(SUPABASE_URL, `${TENANT_ID}/logo.svg`)).toBeNull();
    expect(brandLogoUrl(SUPABASE_URL, `${TENANT_ID}/../other/logo.png`)).toBeNull();
    expect(brandLogoUrl(undefined, `${TENANT_ID}/logo.png`)).toBeNull();
  });
});

describe("normalizeHostname", () => {
  it("lowercases and strips the port", () => {
    expect(normalizeHostname("Greenfield.Localhost:3000")).toBe("greenfield.localhost");
  });

  it("rejects missing or malformed hosts", () => {
    expect(normalizeHostname(null)).toBeNull();
    expect(normalizeHostname("evil host/../")).toBeNull();
  });
});
