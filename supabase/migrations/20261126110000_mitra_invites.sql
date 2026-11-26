-- Mitra accounts are created only by regional admins, by email invite, and
-- start out assigned to one village of the inviter's region (ADR 0019).
--
-- Same flow and trust boundaries as the pilot invite (ADR 0012):
--   1. can_invite_mitra(village) with the regional admin's own session
--   2. claim_mitra_invite (service role): per-email lock, rate limit, refuse
--      emails with an account or an open claim, record the attempt
--   3. Supabase inviteUserByEmail creates the account and sends the email
--   4. provision_invited_mitra (service role): requires the open claim and a
--      matching fresh account, re-checks the inviter, then creates the mitra
--      membership and the village assignment
--   5. on failure fail_mitra_invite releases the claim and the existing
--      delete_orphaned_pilot_invite removes only a fresh orphan account
--
-- Pilot and mitra invites share the per-email lock key, the open-claim check
-- and the per-inviter rate limit, so a pilot invite and a mitra invite for the
-- same email can never both create an account.

create table public.mitra_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  inviter_id uuid references public.profiles(id) on delete set null,
  village_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  status public.pilot_invite_status not null,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint mitra_invites_village_same_tenant
    foreign key (tenant_id, village_id) references public.villages (tenant_id, id),
  constraint mitra_invites_email_normalized
    check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  constraint mitra_invites_failure_reason_length
    check (failure_reason is null or char_length(failure_reason) <= 200)
);

create unique index mitra_invites_open_claim_unique on public.mitra_invites (email) where status = 'claimed';
create index mitra_invites_inviter_idx on public.mitra_invites (inviter_id, created_at desc);
create index mitra_invites_tenant_idx on public.mitra_invites (tenant_id, created_at desc);

alter table public.mitra_invites enable row level security;
revoke all on public.mitra_invites from anon, authenticated;
grant select on public.mitra_invites to authenticated;

-- Audit trail, same visibility as pilot invites. Nobody writes through the API.
create policy mitra_invites_select on public.mitra_invites
for select to authenticated
using (
  public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[])
  or (inviter_id = auth.uid() and public.is_organization_member(tenant_id))
);

-- ── Shared invite rules ────────────────────────────────────────────────────

-- Invite attempts (pilot and mitra) by one inviter in the last hour.
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
  )::integer;
$$;

-- An email is taken when it has an account or an open claim of either kind.
-- Callers hold the per-email lock and have already expired stale claims.
create or replace function public.staff_invite_email_taken(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users as auth_user where lower(auth_user.email) = p_email)
      or exists (select 1 from public.pilot_invites where email = p_email and status = 'claimed')
      or exists (select 1 from public.mitra_invites where email = p_email and status = 'claimed');
$$;

-- Expires claims of either kind whose request never finished (over an hour).
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
$$;

revoke execute on function public.staff_invite_attempts_last_hour(uuid) from public, anon, authenticated;
revoke execute on function public.staff_invite_email_taken(text) from public, anon, authenticated;
revoke execute on function public.expire_stale_staff_invites(text) from public, anon, authenticated;
grant execute on function public.staff_invite_attempts_last_hour(uuid) to service_role;
grant execute on function public.staff_invite_email_taken(text) to service_role;
grant execute on function public.expire_stale_staff_invites(text) to service_role;

-- ── claim_pilot_invite now uses the shared rules ───────────────────────────
-- Same signature and outcomes as before; it now also sees open mitra claims
-- and counts mitra invites toward the rate limit.
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

  -- Serialize all invite attempts (pilot and mitra) for this email.
  perform pg_advisory_xact_lock(hashtextextended('pilot_invite:' || v_email, 0));
  perform public.expire_stale_staff_invites(v_email);

  if public.staff_invite_attempts_last_hour(p_inviter_id) >= 20 then
    v_outcome := 'rate_limited';
  elsif public.staff_invite_email_taken(v_email) then
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

-- ── Mitra invite functions ─────────────────────────────────────────────────

-- The tenant of an active village in a region the inviter currently manages
-- as a regional admin; null otherwise.
create or replace function public.mitra_inviter_tenant(p_inviter_id uuid, p_village_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select village.tenant_id
  from public.villages as village
  join public.regional_admin_regions as assignment
    on assignment.region_id = village.region_id and assignment.user_id = p_inviter_id
  join public.organization_members as member
    on member.organization_id = village.tenant_id
   and member.user_id = p_inviter_id
   and member.role = 'regional_admin'
  where village.id = p_village_id
    and village.is_active;
$$;

revoke execute on function public.mitra_inviter_tenant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mitra_inviter_tenant(uuid, uuid) to service_role;

-- Asked with the regional admin's own session before any account is created.
create or replace function public.can_invite_mitra(p_village_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and public.mitra_inviter_tenant(auth.uid(), p_village_id) is not null;
$$;

revoke execute on function public.can_invite_mitra(uuid) from public, anon;
grant execute on function public.can_invite_mitra(uuid) to authenticated;

create or replace function public.claim_mitra_invite(
  p_inviter_id uuid,
  p_email text,
  p_village_id uuid
)
returns table (invite_id uuid, outcome public.pilot_invite_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_tenant_id uuid := public.mitra_inviter_tenant(p_inviter_id, p_village_id);
  v_outcome public.pilot_invite_status;
  v_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'inviter is not a regional admin of this village' using errcode = '42501';
  end if;
  if char_length(v_email) < 3 or char_length(v_email) > 320 or position('@' in v_email) = 0 then
    raise exception 'invalid email' using errcode = '23514', hint = 'invalid_email';
  end if;

  -- Same lock key as pilot invites: one email, one invite at a time.
  perform pg_advisory_xact_lock(hashtextextended('pilot_invite:' || v_email, 0));
  perform public.expire_stale_staff_invites(v_email);

  if public.staff_invite_attempts_last_hour(p_inviter_id) >= 20 then
    v_outcome := 'rate_limited';
  elsif public.staff_invite_email_taken(v_email) then
    v_outcome := 'email_in_use';
  else
    v_outcome := 'claimed';
  end if;

  insert into public.mitra_invites (tenant_id, email, inviter_id, village_id, status)
  values (v_tenant_id, v_email, p_inviter_id, p_village_id, v_outcome)
  returning id into v_id;

  return query select v_id, v_outcome;
end;
$$;

revoke execute on function public.claim_mitra_invite(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_mitra_invite(uuid, text, uuid) to service_role;

create or replace function public.provision_invited_mitra(p_invite_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.mitra_invites%rowtype;
begin
  select * into v_invite from public.mitra_invites where id = p_invite_id for update;
  if not found or v_invite.status <> 'claimed'
     or v_invite.created_at < timezone('utc', now()) - interval '1 hour' then
    raise exception 'no open invite claim' using errcode = '23514', hint = 'no_claim';
  end if;

  if public.mitra_inviter_tenant(v_invite.inviter_id, v_invite.village_id) is distinct from v_invite.tenant_id then
    raise exception 'inviter is not a regional admin of this village' using errcode = '42501';
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
  values (v_invite.tenant_id, v_invite.tenant_id, p_user_id, 'mitra');

  insert into public.mitra_villages (tenant_id, village_id, user_id)
  values (v_invite.tenant_id, v_invite.village_id, p_user_id);

  update public.mitra_invites
  set status = 'provisioned', user_id = p_user_id, updated_at = timezone('utc', now())
  where id = p_invite_id;

  return v_invite.tenant_id;
end;
$$;

revoke execute on function public.provision_invited_mitra(uuid, uuid) from public, anon, authenticated;
grant execute on function public.provision_invited_mitra(uuid, uuid) to service_role;

create or replace function public.fail_mitra_invite(p_invite_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.mitra_invites
  set status = 'failed',
      failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 200),
      updated_at = timezone('utc', now())
  where id = p_invite_id and status = 'claimed';
$$;

revoke execute on function public.fail_mitra_invite(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_mitra_invite(uuid, text) to service_role;
