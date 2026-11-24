# 0012. Pilot accounts are created only by regional admins, by email invite

- Status: Accepted (owner decision, 2026-11-24)
- Date: 2026-11-24

## Context

Assignment needs real pilot logins. There was no way to create accounts
(member management is part of the paused tenant work, ADR 0007). The owner
decided that **only regional admins** create pilot accounts, homed in their
own regions. Phone OTP is deferred, so an interim login method is needed.

## Decision

- **Email invite:**
  - The regional admin enters name, email, home region (one of theirs), and
    an optional certificate number.
  - The pilot receives an email link, sets their own password, and is
    signed in.
  - The admin never knows the password.
- **Flow and trust boundaries:**
  1. `can_invite_pilot(region)` is called with the regional admin's **own
     session**.
  2. Only then does the server use the service key (`lib/supabase/admin.ts`,
     guarded by `server-only`).
  3. `claim_pilot_invite` **atomically claims the email**:
     - takes a per-email advisory lock
     - expires claims older than an hour
     - enforces a rate limit of 20 attempts per inviter per hour
     - refuses emails that already have an account or an open claim
     - records every attempt in `pilot_invites`

     A concurrent second invite for the same email waits on the lock, sees
     the first claim, and stops before any account exists.

  4. Supabase `inviteUserByEmail` creates the user and sends the email.
  5. `provision_invited_pilot(invite_id, user_id)` requires the open claim
     and an account matching it: same email, created after the claim, still
     a fresh unconfirmed invite, no membership anywhere. It also re-checks
     that the inviter is still the region's regional admin. It then creates
     the `pilot` membership and the profile (`created_by` = inviter) and
     marks the claim provisioned.
  6. On failure, `fail_pilot_invite` releases the claim, and
     `delete_orphaned_pilot_invite` removes the account only if it is a
     fresh orphan created during this request.
  7. All of these functions except `can_invite_pilot` are executable only by
     `service_role`.
- **Email link:** `/api/auth/confirm?token_hash=…&type=invite` verifies the
  token server-side and sends the person to `/[lang]/account/set-password`.
  - Only the `invite` type is accepted, and the destination is fixed (no
    open redirect).
  - Redirects use a relative `Location` header, so the session cookie stays
    on the host the link used.
- **"Regional admins only" is enforced in the database:**
  - No client can insert into `pilot_profiles` at all. Insert is revoked,
    and `provision_invited_pilot` is the only path. Org admins can still
    view pilots and change availability. (The earlier "create profile" form
    from the fleet registry was removed.)
  - `add_organization_member` refuses the `pilot` role.
  - Members can't be updated _to_ `pilot`.

## Alternatives considered

- **Temporary password set by the admin:** works without email, but the
  admin knows the initial password.
- **Phone OTP now:** the target, but deferred by the owner until features
  are built.
- **Org admins also create pilots:** rejected by the owner.

## Consequences

- **Bug caught during development:** Supabase re-sends an invite, returning
  the **existing** account, for an email that's invited but unconfirmed. The
  first version cleaned up by deleting whatever account came back, so
  inviting the same email twice deleted a real pilot. Fixed by the
  existence pre-check plus guarded clean-up, with pgTAP regression tests.
- **Security review fixes (same branch):** a race let two concurrent
  invites for one email receive the same new account, so the first
  provisioning, possibly in another tenant, would win. The atomic claim
  removes it; a real two-session concurrency test confirmed the second
  claim waits and is refused.
- **Known limitation, account enumeration:** an invite inherently reveals
  whether an email already has an account somewhere on the platform (the
  pilot either appears or doesn't). Exposure is limited by the per-inviter
  rate limit, and every attempt is recorded in `pilot_invites` (visible to
  org admins, and to each regional admin for their own invites). Removing
  it entirely needs multi-organization membership with consent (ADR 0007).
- **Follow-up:** there's no "resend invite" or password reset yet. A pilot
  who opens the link but loses the session before setting a password needs
  an admin to help. Add this with OTP onboarding, or as a small feature
  before production.
- **Hosted environments** need `SUPABASE_SERVICE_ROLE_KEY` (server-only), a
  `site_url` matching the app domain, and the invite email template from
  `supabase/templates/invite.html`.
