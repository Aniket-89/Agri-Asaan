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
  3. `account_exists_for_email` refuses any email that already has an
     account.
  4. Supabase `inviteUserByEmail` creates the user and sends the email.
  5. `provision_invited_pilot` creates the `pilot` membership and the profile
     (`created_by` = inviter). It is executable **only by `service_role`**
     and re-checks everything:
     - the inviter is still a regional admin assigned to the region
     - the account is a fresh, unconfirmed, never-signed-in invite
     - the account has no membership anywhere
  6. On provisioning failure, `delete_orphaned_pilot_invite` removes the
     account only if it is a fresh orphan created during this request.
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
- **Follow-up:** there's no "resend invite" or password reset yet. A pilot
  who opens the link but loses the session before setting a password needs
  an admin to help. Add this with OTP onboarding, or as a small feature
  before production.
- **Hosted environments** need `SUPABASE_SERVICE_ROLE_KEY` (server-only), a
  `site_url` matching the app domain, and the invite email template from
  `supabase/templates/invite.html`.
