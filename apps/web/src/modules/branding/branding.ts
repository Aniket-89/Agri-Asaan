// Pure branding helpers. No Next.js or Supabase imports so they stay testable.

export type Branding = {
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  // True when no tenant brand was resolved and the platform's own brand is shown.
  isPlatformDefault: boolean;
};

export type TenantBrandOverrides = {
  brand_name: string | null;
  brand_primary_color: string | null;
  brand_accent_color: string | null;
  brand_tagline: string | null;
  brand_logo_path: string | null;
};

export const PLATFORM_DEFAULT_BRANDING: Branding = {
  name: "AgriAsaan",
  tagline: "Drone · Crop Monitoring · Farm Services",
  primaryColor: "#14532d",
  accentColor: "#75B82A",
  logoUrl: null,
  isPlatformDefault: true,
};

export const BRAND_ASSETS_BUCKET = "brand-assets";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HOSTNAME = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
// Mirrors the organization_settings_brand_logo_path_format constraint.
const LOGO_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,64}\.(png|webp|jpg|jpeg)$/;

const validColor = (value: string | null | undefined) => {
  const color = value?.trim();
  return color && HEX_COLOR.test(color) ? color : null;
};

export function brandLogoUrl(
  supabaseUrl: string | undefined,
  logoPath: string | null
): string | null {
  if (!supabaseUrl || !logoPath || !LOGO_PATH.test(logoPath)) {
    return null;
  }
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BRAND_ASSETS_BUCKET}/${logoPath}`;
}

// A resolved tenant brand never inherits the platform's tagline or logo:
// a white-label customer must not show AgriAsaan's identity.
export function applyTenantBranding(
  defaults: Branding,
  overrides: TenantBrandOverrides | null,
  supabaseUrl?: string
): Branding {
  if (!overrides) {
    return defaults;
  }

  return {
    name: overrides.brand_name?.trim() || defaults.name,
    tagline: overrides.brand_tagline?.trim() || "",
    primaryColor: validColor(overrides.brand_primary_color) ?? defaults.primaryColor,
    accentColor: validColor(overrides.brand_accent_color) ?? defaults.accentColor,
    logoUrl: brandLogoUrl(supabaseUrl, overrides.brand_logo_path),
    isPlatformDefault: false,
  };
}

// Host headers are client-controlled: this only selects public presentation
// data and is never used for authorization.
export function normalizeHostname(hostHeader: string | null): string | null {
  if (!hostHeader) {
    return null;
  }

  const hostname = hostHeader.trim().toLowerCase().replace(/:\d+$/, "");
  return HOSTNAME.test(hostname) ? hostname : null;
}
