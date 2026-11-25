# 0017. Design system: farm palette, shadows instead of outlines, Phosphor icons

- Status: Accepted (owner direction, 2026-11-25)
- Date: 2026-11-25

## Context

Until now the screens used unstyled black buttons and grey outlined boxes.
The owner asked for:

- a palette that follows the brand: shades of green, lighter and more
  "farm-like", with complementary colours, black and white
- no outlined elements that read as generated UI; subtle drop shadows for
  depth and separation
- a professional, clean, user-friendly design with icons where they help

The app must also stay white-label (ADR 0006 tenancy, AGENTS.md 6.3) and work
on low-end Android phones in Hindi and English.

## Decision

- **Tokens** live in `apps/web/src/app/globals.css` (Tailwind v4 `@theme`):
  - `--brand` crop green `#2e7d32` and `--leaf` sprout green `#8cc63f`;
    both are overridden per organization from `organization_settings`, and
    every other green (`brand-strong`, `brand-soft`, `forest`, `leaf-soft`,
    `leaf-ink`) is derived from them with `color-mix`, so a tenant's colours
    restyle the whole app
  - farm complements for status and categories: harvest wheat (`sun`), soil,
    monsoon sky; clay red for danger
  - a sage canvas (`#e8efe3`) under white surfaces, near-black ink
  - white text on `brand` meets WCAG AA (5.1:1)
- **Depth, not outlines:** green-tinted layered shadows (`shadow-soft`,
  `shadow-raised`, `shadow-button`); form controls are filled with an inset
  shadow rather than bordered. Borders are not used for separation.
- **Hierarchy:** one bold element per screen. Home has a green header with
  the role's live counts (new requests, jobs today, open bookings); section
  tiles each carry their own farm tone. The desktop sidebar is forest green.
- **Typography:** Mukta (Google Fonts via `next/font`, self-hosted at build),
  one family covering Latin and Devanagari so Hindi and English match.
- **Icons:** `@phosphor-icons/react` (MIT), filled and duotone weights. Server
  components import from `@phosphor-icons/react/dist/ssr`. Chosen over
  outline-only sets (Lucide, Heroicons) because filled/duotone icons read
  better at small sizes in sunlight and avoid the thin-outline look.
- **Shell:** role-based navigation (`components/layout/nav-items.ts`): a
  sidebar on desktop, a bottom bar (max five items, then "More") on phones.
- **Reusable pieces** in `components/ui/`: `Button`, `Field`/`controlClass`,
  `Panel`, `Badge`, `PageHeader`, `Page`, `EmptyState`, `SegmentedTabs`,
  `FilterChips`, `Disclosure`, `BackLink`.
- **Demo logo:** the AgriAsaan leaf is seeded as the AgriAsaan organization's
  logo (`supabase/storage/brand-assets`, uploaded by `npm run db:reset`), so
  the tenant shows its logo through the normal tenant-branding path. Tenants
  without a logo show their initial; the platform mark is never shown for a
  tenant.

## Alternatives considered

- **Keep the darker `#14532d` brand green:** rejected by the owner as too
  heavy; kept only on the public coming-soon page.
- **A component library (shadcn/ui, Mantine):** more dependencies and a
  recognisable default look; the app needs only a handful of primitives.
- **Showing the platform leaf for the AgriAsaan tenant by name:** would tie
  presentation to a hardcoded organization name (AGENTS.md 5.4).

## Consequences

- New dependency: `@phosphor-icons/react` (tree-shaken per icon).
- Tenant colours must keep white text readable on `--brand`; the branding
  module accepts any `#rrggbb`, so a contrast check belongs in the future
  branding admin UI.
- On a white-label login page the default green shows until the tenant's
  branding resolves (the brand-neutral heading already avoids showing
  another organization's name).
- The internal platform-staff console (`/platform`) still uses its old dark
  styling and English-only text; restyling it is follow-up work.
