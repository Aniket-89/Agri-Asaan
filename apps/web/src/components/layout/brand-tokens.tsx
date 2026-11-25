import type { Branding } from "@/modules/branding";

// Organization colours drive the --brand / --leaf tokens. The values come
// from the branding module, which only accepts #rrggbb.
export function BrandTokens({ branding }: { branding: Branding }) {
  return <style>{`:root{--brand:${branding.primaryColor};--leaf:${branding.accentColor}}`}</style>;
}
