# 0007. Membership consent is deferred (known gap)

- Status: Accepted. Deferred by the owner on 2026-11-21. Must be resolved
  before real users are onboarded.
- Date: 2026-11-21

## Context

`add_organization_member` lets an organization admin, or a regional admin
for operational roles, add any existing account to their tenant by user ID.
The account holder never agrees to it.

Once added, the person's name becomes visible to tenant members, and their
phone becomes visible to tenant admins through `get_profile_phone`. A
malicious tenant that learns a user ID could pull another tenant's user in
and read their contact details. This behaviour predates ADR 0002; that ADR
only widened who may add members.

A related hole, admins repointing an existing membership row to a different
user, is fixed. Migration `20261121130000` allows updates to `role` only.

## Decision

Owner-approved: pause tenant-system work to build the core product. For now:

- Local, demo, and test environments use fake data only, so the gap cannot
  expose real people.
- The gap is recorded here and in `docs/data-model.md`.

## Required before production

Memberships start as `invited` and only count once the person accepts:

- Membership helpers, `profiles_share_organization`, and `get_profile_phone`
  consider accepted memberships only.
- Accounts created by platform provisioning start as accepted.
- The accept flow ships with phone OTP onboarding.

## Consequences

- Do not onboard real users until this is resolved.
- Farmers registered by mitras will be tenant records, not memberships (next
  feature), so mitra-led farmer onboarding does not depend on this.
