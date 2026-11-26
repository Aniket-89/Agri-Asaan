# 0019. Mitra accounts are created by regional admins, by email invite

- Status: Accepted (owner request, 2026-11-26)
- Date: 2026-11-26

## Context

The public sign-up is for farmers only (ADR 0018). The owner decided that
mitras, like pilots, are created by regional admins. Mitras could already be
assigned to villages, but there was no way to create a mitra account.

## Decision

- **Same invite flow as pilots (ADR 0012).** The regional admin enters
  name, email and one village. The mitra gets an email link, sets their own
  password and is signed in; the admin never knows the password.
- **The village decides the scope.** Only an active village in a region the
  inviter is currently assigned to as regional admin. Organization admins
  don't invite mitras (as with pilots). The new mitra starts with that
  village; more villages are assigned on the territory page as before.
- **Database functions** (`mitra_invites` audit table):
  - `can_invite_mitra(village)` with the admin's own session, before the
    service key is used
  - `claim_mitra_invite`, `provision_invited_mitra`, `fail_mitra_invite`,
    executable only by `service_role`. Provisioning re-checks the inviter,
    requires the open claim and a matching fresh account, then creates the
    `mitra` membership and the `mitra_villages` row in one transaction.
  - the existing `delete_orphaned_pilot_invite` removes only a fresh orphan
    account after a failure
- **Pilot and mitra invites share their safety rules:** one per-email
  advisory lock, one open-claim check across both tables, and one limit of
  20 attempts an hour per inviter. Otherwise a pilot invite and a mitra
  invite for the same email could race and both receive the same new
  account (the bug ADR 0012 fixed for pilots). `claim_pilot_invite` was
  replaced (same signature and outcomes) to use the shared rules.
- **Separate table rather than generalizing `pilot_invites`:** renaming a
  security-reviewed table and its functions would mean rewriting all of
  them; a sibling table keeps the pilot flow unchanged.
- The invite email no longer says "pilot"; it invites the person to the
  spraying team.

## Alternatives considered

- **Mitras sign up themselves and wait for approval:** opens a staff role to
  public sign-up; rejected by the owner.
- **Attaching an existing account with `add_organization_member`:** adds a
  person to an organization without their consent (ADR 0007).

## Consequences

- Same account-enumeration limitation and missing "resend invite" as pilot
  invites (ADR 0012).
- Hosted environments need the updated invite email template and subject
  from `supabase/config.toml`.
