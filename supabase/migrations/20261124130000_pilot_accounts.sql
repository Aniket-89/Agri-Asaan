-- Pilot accounts are created only by regional admins, through an email
-- invite (ADR 0012).
--
-- Flow: the app asks can_invite_pilot() with the regional admin's session,
-- creates the auth user with the server-only service key (Supabase invite),
-- then calls provision_invited_pilot(), which only the service role can
-- execute and which re-checks every rule before creating the membership and
-- the pilot profile.

alter table public.pilot_profiles
  add column created_by uuid references public.profiles(id) on delete set null;

-- ── Pilot profiles are created only by the invite flow ─────────────────────
-- No client may insert a pilot profile directly: provision_invited_pilot
-- (service role, after the regional admin was authorized) is the only path.

drop policy pilot_profiles_insert on public.pilot_profiles;
revoke insert on public.pilot_profiles from authenticated;

-- Pilots join only through the invite flow, never through the generic
-- add-member function (which would also attach an existing account without
-- the person's consent, see ADR 0007).
create or replace function public.add_organization_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_role in ('super_admin', 'admin') then
    raise exception 'legacy organization role is not allowed';
  end if;

  if p_role = 'pilot' then
    raise exception 'pilots are added through the regional admin pilot invite';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'users cannot add or change their own membership';
  end if;

  if public.has_organization_role(p_organization_id, array['organization_admin']::public.organization_role[]) then
    null;
  elsif public.has_organization_role(p_organization_id, array['regional_admin']::public.organization_role[]) then
    if p_role not in ('mitra', 'farmer') then
      raise exception 'regional admins can only add mitra or farmer members';
    end if;
  else
    raise exception 'only an organization or regional admin can add organization members';
  end if;

  insert into public.organization_members (tenant_id, organization_id, user_id, role)
  values (p_organization_id, p_organization_id, p_user_id, p_role);
end;
$$;

revoke execute on function public.add_organization_member(uuid, uuid, public.organization_role) from public, anon;
grant execute on function public.add_organization_member(uuid, uuid, public.organization_role) to authenticated;

-- Regional admins may also no longer promote an existing member to pilot.
drop policy organization_members_update_admin on public.organization_members;
create policy organization_members_update_admin on public.organization_members
for update to authenticated
using (
  user_id <> auth.uid()
  and (
    public.has_organization_role(organization_id, array['organization_admin']::public.organization_role[])
    or (
      public.has_organization_role(organization_id, array['regional_admin']::public.organization_role[])
      and role in ('mitra', 'farmer', 'pilot')
    )
  )
)
with check (
  user_id <> auth.uid()
  and role <> 'pilot'
  and (
    public.has_organization_role(organization_id, array['organization_admin']::public.organization_role[])
    or (
      public.has_organization_role(organization_id, array['regional_admin']::public.organization_role[])
      and role in ('mitra', 'farmer')
    )
  )
);

-- ── Invite helpers ─────────────────────────────────────────────────────────

-- Asked with the regional admin's own session before any account is created.
create or replace function public.can_invite_pilot(p_home_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.regions as region
    join public.regional_admin_regions as assignment
      on assignment.region_id = region.id
     and assignment.user_id = auth.uid()
    join public.organization_members as member
      on member.organization_id = region.tenant_id
     and member.user_id = auth.uid()
     and member.role = 'regional_admin'
    where region.id = p_home_region_id
  );
$$;

revoke execute on function public.can_invite_pilot(uuid) from public, anon;
grant execute on function public.can_invite_pilot(uuid) to authenticated;

-- Called by the server with the service key right after the invite created
-- the auth user. Re-validates everything: the inviter must still be a
-- regional admin assigned to the region, and the account must be a fresh,
-- unconfirmed invite (never an existing account) with no membership in the
-- tenant.
create or replace function public.provision_invited_pilot(
  p_inviter_id uuid,
  p_user_id uuid,
  p_home_region_id uuid,
  p_license_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_license text := nullif(upper(btrim(coalesce(p_license_number, ''))), '');
begin
  select region.tenant_id into v_tenant_id
  from public.regions as region
  join public.regional_admin_regions as assignment
    on assignment.region_id = region.id and assignment.user_id = p_inviter_id
  join public.organization_members as member
    on member.organization_id = region.tenant_id
   and member.user_id = p_inviter_id
   and member.role = 'regional_admin'
  where region.id = p_home_region_id;

  if v_tenant_id is null then
    raise exception 'inviter is not a regional admin of this region' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users as auth_user
    where auth_user.id = p_user_id
      and auth_user.invited_at is not null
      and auth_user.email_confirmed_at is null
      and auth_user.last_sign_in_at is null
  ) then
    raise exception 'only a freshly invited account can become a pilot' using errcode = '23514', hint = 'not_fresh_invite';
  end if;

  if exists (select 1 from public.organization_members where user_id = p_user_id) then
    raise exception 'account already belongs to an organization' using errcode = '23514', hint = 'already_member';
  end if;

  insert into public.organization_members (tenant_id, organization_id, user_id, role)
  values (v_tenant_id, v_tenant_id, p_user_id, 'pilot');

  insert into public.pilot_profiles (tenant_id, user_id, home_region_id, license_number, created_by)
  values (v_tenant_id, p_user_id, p_home_region_id, v_license, p_inviter_id);

  return v_tenant_id;
end;
$$;

-- Service role only: never callable from a browser session.
revoke execute on function public.provision_invited_pilot(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.provision_invited_pilot(uuid, uuid, uuid, text) to service_role;

-- Checked before any invite is sent. Supabase re-sends an invite (returning
-- the EXISTING account) for an email that is invited but unconfirmed, so the
-- app must never invite an email that already has an account: provisioning
-- would fail and the clean-up would remove a real user.
create or replace function public.account_exists_for_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users as auth_user
    where lower(auth_user.email) = lower(btrim(p_email))
  );
$$;

revoke execute on function public.account_exists_for_email(text) from public, anon, authenticated;
grant execute on function public.account_exists_for_email(text) to service_role;

-- Clean-up after a failed provisioning step. Removes the auth account only
-- if it is an orphan created moments ago: never confirmed, never signed in,
-- created after p_not_before, and with no membership anywhere. Returns
-- whether it deleted anything.
create or replace function public.delete_orphaned_pilot_invite(p_user_id uuid, p_not_before timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users as auth_user
  where auth_user.id = p_user_id
    and auth_user.created_at >= p_not_before
    and auth_user.email_confirmed_at is null
    and auth_user.last_sign_in_at is null
    and not exists (select 1 from public.organization_members where user_id = p_user_id);
  return found;
end;
$$;

revoke execute on function public.delete_orphaned_pilot_invite(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.delete_orphaned_pilot_invite(uuid, timestamptz) to service_role;
