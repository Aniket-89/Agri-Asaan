# 0018. Farmers register themselves on an organization's site

- Status: Accepted (owner approved the plan on 2026-11-26)
- Date: 2026-11-26

## Context

The public `/register` page created a login with no organization. Every new
account landed on "you are not a member of an organization yet" until an
administrator added it, and nothing told the app which organization the
person was signing up with. The owner wants the public sign-up to be for
farmers joining that site's spraying service; mitras, pilots and admins are
created by administrators.

## Decision

- **The site decides the organization.** The organization comes from the
  request's verified hostname (`organization_domains`, ADR 0003). The demo
  seed maps `agri-asaan.vercel.app` and `localhost` to AgriAsaan;
  `greenfield.localhost` stays Greenfield's.
- **Each organization opts in** with the `farmer_self_registration`
  feature. AgriAsaan has it on; Greenfield has it off, and its register page
  says registration is not open. This flag decides whether the sign-up is
  offered; the RPC below still validates everything itself.
- **One database function joins and creates the farmer:**
  `register_self_as_farmer(hostname, village, name, phone)`, security
  definer, authenticated callers only. In one transaction it:
  - resolves the organization from the hostname and checks the feature
  - checks the village is active, in an active region of that organization
  - refuses if the caller is already a member (any role), so a staff member
    can't change their role this way
  - inserts the membership with role **farmer** (never anything else) and a
    farmer record linked to the login; the existing trigger stamps
    `registered_by` and the consent time from the server
- **Villages for the form** come from `get_farmer_registration_villages`
  (anon and authenticated). It returns only village and region names, and
  nothing when the site doesn't accept sign-ups.
- **The form** asks for name, mobile number, village, email, password, and
  the farmer's consent naming the brand. The server checks the village
  before creating the login, so a closed site never creates orphan accounts.
- **Accounts without an organization** (created before this change, or
  waiting on email verification) are sent from the dashboard to
  `/register/join`, which asks for the farmer details and calls the same
  function. On a site that doesn't accept sign-ups it explains that an
  administrator must add them.
- **Duplicates are not merged.** If a mitra already registered the same
  person, self-registration creates a second farmer record. Phone numbers
  are shared within families, so linking by phone could attach a stranger
  to someone else's fields and bookings.

## Alternatives considered

- **A trigger on `auth.users` reading sign-up metadata:** one path for
  verified and unverified sign-ups, but it trusts client-written metadata
  inside an auth trigger and creates memberships before the email is
  verified.
- **Letting the person pick an organization:** exposes the tenant list and
  does not fit white-label sites.
- **Linking to an existing farmer record by phone:** rejected above.

## Consequences

- ADR 0007's consent gap is unchanged: joining is the person's own act.
- Mitra accounts are created by regional admins through an email invite
  (ADR 0019), like pilots (ADR 0012).
- Hosted environments need the hostname mapping and feature row (seeded for
  local and the demo).
- Admins may see two records for one farmer when both a mitra and the farmer
  registered; merging is future work if it happens in practice.
- **Security review follow-up:** with public sign-up, any stranger could join
  as a farmer and list every member's name, because members could see each
  other's names (ADR 0004). Farmers now see only their own name and the
  staff who acted on, or are assigned to, their own bookings
  (`profiles_share_organization`). Staff visibility is unchanged.
