-- Regional admin accounts are created by organization admins, by email
-- invite, and start out assigned to one region (ADR 0020).
--
-- Same flow and trust boundaries as pilot and mitra invites (ADR 0012, 0019):
--   1. can_invite_regional_admin(region) with the organization admin's own
--      session
--   2. claim_regional_admin_invite (service role): shared per-email lock,
--      shared rate limit, refuse emails with an account or any open claim,
--      record the attempt
--   3. Supabase inviteUserByEmail creates the account and sends the email
--   4. provision_invited_regional_admin (service role): requires the open
--      claim and a matching fresh account, re-checks the inviter, then creates
--      the regional_admin membership and the region assignment
--   5. on failure fail_regional_admin_invite releases the claim and
--      delete_orphaned_pilot_invite removes only a fresh orphan account

create table public.regional_admin_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  inviter_id uuid references public.profiles(id) on delete set null,
  region_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  status public.pilot_invite_status not null,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint regional_admin_invites_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id),
  constraint regional_admin_invites_email_normalized
    check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  constraint regional_admin_invites_failure_reason_length
    check (failure_reason is null or char_length(failure_reason) <= 200)
);

create unique index regional_admin_invites_open_claim_unique
  on public.regional_admin_invites (email) where status = 'claimed';
create index regional_admin_invites_inviter_idx on public.regional_admin_invites (inviter_id, created_at desc);
create index regional_admin_invites_tenant_idx on public.regional_admin_invites (tenant_id, created_at desc);

alter table public.regional_admin_invites enable row level security;
revoke all on public.regional_admin_invites from anon, authenticated;
grant select on public.regional_admin_invites to authenticated;

-- Audit trail for the tenant's organization admins. Nobody writes through
-- the API.
create policy regional_admin_invites_select on public.regional_admin_invites
for select to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

-- ── Shared invite rules now cover all three invite kinds ───────────────────

create or replace function public.staff_invite_attempts_last_hour(p_inviter_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.pilot_invites
     where inviter_id = p_inviter_id and created_at > timezone('utc', now()) - interval '1 hour')
    +
    (select count(*) from public.mitra_invites
     where inviter_id = p_inviter_id and created_at > timezone('utc', now()) - interval '1 hour')
    +
    (select count(*) from public.regional_admin_invites
     where inviter_id = p_inviter_id and created_at > timezone('utc', now()) - interval '1 hour')
  )::integer;
$$;

create or replace function public.staff_invite_email_taken(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users as auth_user where lower(auth_user.email) = p_email)
      or exists (select 1 from public.pilot_invites where email = p_email and status = 'claimed')
      or exists (select 1 from public.mitra_invites where email = p_email and status = 'claimed')
      or exists (select 1 from public.regional_admin_invites where email = p_email and status = 'claimed');
$$;

create or replace function public.expire_stale_staff_invites(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.pilot_invites
  set status = 'expired', failure_reason = 'claim expired', updated_at = timezone('utc', now())
  where email = p_email and status = 'claimed'
    and created_at < timezone('utc', now()) - interval '1 hour';
  update public.mitra_invites
  set status = 'expired', failure_reason = 'claim expired', updated_at = timezone('utc', now())
  where email = p_email and status = 'claimed'
    and created_at < timezone('utc', now()) - interval '1 hour';
  update public.regional_admin_invites
  set status = 'expired', failure_reason = 'claim expired', updated_at = timezone('utc', now())
  where email = p_email and status = 'claimed'
    and created_at < timezone('utc', now()) - interval '1 hour';
$$;

revoke execute on function public.staff_invite_attempts_last_hour(uuid) from public, anon, authenticated;
revoke execute on function public.staff_invite_email_taken(text) from public, anon, authenticated;
revoke execute on function public.expire_stale_staff_invites(text) from public, anon, authenticated;
grant execute on function public.staff_invite_attempts_last_hour(uuid) to service_role;
grant execute on function public.staff_invite_email_taken(text) to service_role;
grant execute on function public.expire_stale_staff_invites(text) to service_role;

-- ── Regional admin invite functions ────────────────────────────────────────

-- The tenant of an active region whose organization the inviter currently
-- administers; null otherwise.
create or replace function public.regional_admin_inviter_tenant(p_inviter_id uuid, p_region_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select region.tenant_id
  from public.regions as region
  join public.organization_members as member
    on member.organization_id = region.tenant_id
   and member.user_id = p_inviter_id
   and member.role = 'organization_admin'
  where region.id = p_region_id
    and region.is_active;
$$;

revoke execute on function public.regional_admin_inviter_tenant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.regional_admin_inviter_tenant(uuid, uuid) to service_role;

-- Asked with the organization admin's own session before any account exists.
create or replace function public.can_invite_regional_admin(p_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and public.regional_admin_inviter_tenant(auth.uid(), p_region_id) is not null;
$$;

revoke execute on function public.can_invite_regional_admin(uuid) from public, anon;
grant execute on function public.can_invite_regional_admin(uuid) to authenticated;

create or replace function public.claim_regional_admin_invite(
  p_inviter_id uuid,
  p_email text,
  p_region_id uuid
)
returns table (invite_id uuid, outcome public.pilot_invite_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_tenant_id uuid := public.regional_admin_inviter_tenant(p_inviter_id, p_region_id);
  v_outcome public.pilot_invite_status;
  v_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'inviter is not an organization admin of this region' using errcode = '42501';
  end if;
  if char_length(v_email) < 3 or char_length(v_email) > 320 or position('@' in v_email) = 0 then
    raise exception 'invalid email' using errcode = '23514', hint = 'invalid_email';
  end if;

  -- Same lock key as pilot and mitra invites: one email, one invite at a time.
  perform pg_advisory_xact_lock(hashtextextended('pilot_invite:' || v_email, 0));
  perform public.expire_stale_staff_invites(v_email);

  if public.staff_invite_attempts_last_hour(p_inviter_id) >= 20 then
    v_outcome := 'rate_limited';
  elsif public.staff_invite_email_taken(v_email) then
    v_outcome := 'email_in_use';
  else
    v_outcome := 'claimed';
  end if;

  insert into public.regional_admin_invites (tenant_id, email, inviter_id, region_id, status)
  values (v_tenant_id, v_email, p_inviter_id, p_region_id, v_outcome)
  returning id into v_id;

  return query select v_id, v_outcome;
end;
$$;

revoke execute on function public.claim_regional_admin_invite(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_regional_admin_invite(uuid, text, uuid) to service_role;

create or replace function public.provision_invited_regional_admin(p_invite_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.regional_admin_invites%rowtype;
begin
  select * into v_invite from public.regional_admin_invites where id = p_invite_id for update;
  if not found or v_invite.status <> 'claimed'
     or v_invite.created_at < timezone('utc', now()) - interval '1 hour' then
    raise exception 'no open invite claim' using errcode = '23514', hint = 'no_claim';
  end if;

  if public.regional_admin_inviter_tenant(v_invite.inviter_id, v_invite.region_id) is distinct from v_invite.tenant_id then
    raise exception 'inviter is not an organization admin of this region' using errcode = '42501';
  end if;

  -- The account must be the one this claim's invite created.
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
  values (v_invite.tenant_id, v_invite.tenant_id, p_user_id, 'regional_admin');

  insert into public.regional_admin_regions (tenant_id, region_id, user_id)
  values (v_invite.tenant_id, v_invite.region_id, p_user_id);

  update public.regional_admin_invites
  set status = 'provisioned', user_id = p_user_id, updated_at = timezone('utc', now())
  where id = p_invite_id;

  return v_invite.tenant_id;
end;
$$;

revoke execute on function public.provision_invited_regional_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.provision_invited_regional_admin(uuid, uuid) to service_role;

create or replace function public.fail_regional_admin_invite(p_invite_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.regional_admin_invites
  set status = 'failed',
      failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 200),
      updated_at = timezone('utc', now())
  where id = p_invite_id and status = 'claimed';
$$;

revoke execute on function public.fail_regional_admin_invite(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_regional_admin_invite(uuid, text) to service_role;
