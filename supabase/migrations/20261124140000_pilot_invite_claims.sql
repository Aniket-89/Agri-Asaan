-- Atomic pilot invite claims, rate limiting, and an invite audit trail
-- (ADR 0012, follow-up to a security review).
--
-- Fixes:
--  * Race: two invites for the same email could both pass an existence
--    check, get the SAME new account back from Supabase, and the first
--    provisioning would win, possibly in another tenant. Now an invite must
--    first CLAIM the email under a per-email lock; a second claim sees the
--    first and stops before any account is created. Provisioning requires
--    the matching claim.
--  * Enumeration: whether an email has an account is inherently revealed by
--    any invite (the pilot either appears or not). Exposure is limited with
--    a per-inviter rate limit, and every attempt is recorded.

create type public.pilot_invite_status as enum ('claimed', 'provisioned', 'email_in_use', 'rate_limited', 'failed', 'expired');

create table public.pilot_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  inviter_id uuid references public.profiles(id) on delete set null,
  home_region_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  status public.pilot_invite_status not null,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pilot_invites_region_same_tenant
    foreign key (tenant_id, home_region_id) references public.regions (tenant_id, id),
  constraint pilot_invites_email_normalized
    check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  constraint pilot_invites_failure_reason_length
    check (failure_reason is null or char_length(failure_reason) <= 200)
);

-- At most one open claim per email, platform-wide.
create unique index pilot_invites_open_claim_unique on public.pilot_invites (email) where status = 'claimed';
create index pilot_invites_inviter_idx on public.pilot_invites (inviter_id, created_at desc);
create index pilot_invites_tenant_idx on public.pilot_invites (tenant_id, created_at desc);

alter table public.pilot_invites enable row level security;
revoke all on public.pilot_invites from anon, authenticated;
grant select on public.pilot_invites to authenticated;

-- Audit trail: organization admins see their tenant's invites; a regional
-- admin sees the invites they sent. Nobody writes through the API.
create policy pilot_invites_select on public.pilot_invites
for select to authenticated
using (
  public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[])
  or (inviter_id = auth.uid() and public.is_organization_member(tenant_id))
);

-- Replaced by the atomic claim below.
drop function public.account_exists_for_email(text);
drop function public.provision_invited_pilot(uuid, uuid, uuid, text);

-- Inviter must currently be a regional admin assigned to the region.
create or replace function public.pilot_inviter_tenant(p_inviter_id uuid, p_home_region_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select region.tenant_id
  from public.regions as region
  join public.regional_admin_regions as assignment
    on assignment.region_id = region.id and assignment.user_id = p_inviter_id
  join public.organization_members as member
    on member.organization_id = region.tenant_id
   and member.user_id = p_inviter_id
   and member.role = 'regional_admin'
  where region.id = p_home_region_id;
$$;

revoke execute on function public.pilot_inviter_tenant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pilot_inviter_tenant(uuid, uuid) to service_role;

-- ── claim_pilot_invite ─────────────────────────────────────────────────────
-- Returns the invite id and outcome: 'claimed' (go ahead and send the
-- invite), 'email_in_use' or 'rate_limited' (stop). Every call is recorded.
create or replace function public.claim_pilot_invite(
  p_inviter_id uuid,
  p_email text,
  p_home_region_id uuid
)
returns table (invite_id uuid, outcome public.pilot_invite_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_tenant_id uuid := public.pilot_inviter_tenant(p_inviter_id, p_home_region_id);
  v_outcome public.pilot_invite_status;
  v_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'inviter is not a regional admin of this region' using errcode = '42501';
  end if;
  if char_length(v_email) < 3 or char_length(v_email) > 320 or position('@' in v_email) = 0 then
    raise exception 'invalid email' using errcode = '23514', hint = 'invalid_email';
  end if;

  -- Serialize all invite attempts for this email.
  perform pg_advisory_xact_lock(hashtextextended('pilot_invite:' || v_email, 0));

  -- A claim whose request never finished must not block the email forever.
  update public.pilot_invites
  set status = 'expired', failure_reason = 'claim expired', updated_at = timezone('utc', now())
  where email = v_email
    and status = 'claimed'
    and created_at < timezone('utc', now()) - interval '1 hour';

  if (
    select count(*) from public.pilot_invites
    where inviter_id = p_inviter_id
      and created_at > timezone('utc', now()) - interval '1 hour'
  ) >= 20 then
    v_outcome := 'rate_limited';
  elsif exists (select 1 from auth.users as auth_user where lower(auth_user.email) = v_email)
     or exists (select 1 from public.pilot_invites where email = v_email and status = 'claimed') then
    v_outcome := 'email_in_use';
  else
    v_outcome := 'claimed';
  end if;

  insert into public.pilot_invites (tenant_id, email, inviter_id, home_region_id, status)
  values (v_tenant_id, v_email, p_inviter_id, p_home_region_id, v_outcome)
  returning id into v_id;

  return query select v_id, v_outcome;
end;
$$;

revoke execute on function public.claim_pilot_invite(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_pilot_invite(uuid, text, uuid) to service_role;

-- ── provision_invited_pilot (claim-bound) ──────────────────────────────────
create or replace function public.provision_invited_pilot(
  p_invite_id uuid,
  p_user_id uuid,
  p_license_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.pilot_invites%rowtype;
  v_license text := nullif(upper(btrim(coalesce(p_license_number, ''))), '');
begin
  select * into v_invite from public.pilot_invites where id = p_invite_id for update;
  if not found or v_invite.status <> 'claimed'
     or v_invite.created_at < timezone('utc', now()) - interval '1 hour' then
    raise exception 'no open invite claim' using errcode = '23514', hint = 'no_claim';
  end if;

  if public.pilot_inviter_tenant(v_invite.inviter_id, v_invite.home_region_id) is distinct from v_invite.tenant_id then
    raise exception 'inviter is not a regional admin of this region' using errcode = '42501';
  end if;

  -- The account must be the one this claim's invite created: same email,
  -- created after the claim, still a fresh unconfirmed invite.
  if not exists (
    select 1 from auth.users as auth_user
    where auth_user.id = p_user_id
      and lower(auth_user.email) = v_invite.email
      and auth_user.created_at >= v_invite.created_at
      and auth_user.invited_at is not null
      and auth_user.email_confirmed_at is null
      and auth_user.last_sign_in_at is null
  ) then
    raise exception 'account does not match this invite' using errcode = '23514', hint = 'account_mismatch';
  end if;

  if exists (select 1 from public.organization_members where user_id = p_user_id) then
    raise exception 'account already belongs to an organization' using errcode = '23514', hint = 'already_member';
  end if;

  insert into public.organization_members (tenant_id, organization_id, user_id, role)
  values (v_invite.tenant_id, v_invite.tenant_id, p_user_id, 'pilot');

  insert into public.pilot_profiles (tenant_id, user_id, home_region_id, license_number, created_by)
  values (v_invite.tenant_id, p_user_id, v_invite.home_region_id, v_license, v_invite.inviter_id);

  update public.pilot_invites
  set status = 'provisioned', user_id = p_user_id, updated_at = timezone('utc', now())
  where id = p_invite_id;

  return v_invite.tenant_id;
end;
$$;

revoke execute on function public.provision_invited_pilot(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.provision_invited_pilot(uuid, uuid, text) to service_role;

-- Releases a claim when sending or provisioning fails.
create or replace function public.fail_pilot_invite(p_invite_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.pilot_invites
  set status = 'failed',
      failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 200),
      updated_at = timezone('utc', now())
  where id = p_invite_id and status = 'claimed';
$$;

revoke execute on function public.fail_pilot_invite(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_pilot_invite(uuid, text) to service_role;
