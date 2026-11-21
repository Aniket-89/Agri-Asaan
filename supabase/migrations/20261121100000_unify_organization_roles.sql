-- Make organization_admin / regional_admin the only administrator roles
-- (ADR 0002). The legacy enum values super_admin / admin cannot be dropped
-- from a Postgres enum, so existing rows are converted and a constraint
-- prevents the legacy values from being used again.

update public.organization_members set role = 'organization_admin' where role = 'super_admin';
update public.organization_members set role = 'regional_admin' where role = 'admin';

alter table public.organization_members
  add constraint organization_members_role_current
  check (role not in ('super_admin', 'admin'));

-- organizations: tenant administrators may update their organization.
-- Platform-controlled columns are protected by a trigger in a later migration.
drop policy organizations_update_super_admin on public.organizations;
create policy organizations_update_organization_admin on public.organizations
for update to authenticated
using (public.has_organization_role(id, array['organization_admin']::public.organization_role[]))
with check (public.has_organization_role(id, array['organization_admin']::public.organization_role[]));

-- organization_members: administrators can see the tenant's memberships.
drop policy organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(
    organization_id,
    array['organization_admin', 'regional_admin']::public.organization_role[]
  )
);

-- Organization admins can change any other member's role. Regional admins can
-- only move members between the operational roles and can never touch an
-- administrator row.
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
  and (
    public.has_organization_role(organization_id, array['organization_admin']::public.organization_role[])
    or (
      public.has_organization_role(organization_id, array['regional_admin']::public.organization_role[])
      and role in ('mitra', 'farmer', 'pilot')
    )
  )
);

drop policy organization_members_delete_super_admin on public.organization_members;
create policy organization_members_delete_organization_admin on public.organization_members
for delete to authenticated
using (
  user_id <> auth.uid()
  and public.has_organization_role(organization_id, array['organization_admin']::public.organization_role[])
);

-- organization_settings: one row per tenant, created by provisioning. Tenant
-- administrators may only update it.
drop policy organization_settings_write_super_admin on public.organization_settings;
create policy organization_settings_update_organization_admin on public.organization_settings
for update to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

-- organization_features: tenant-wide configuration, organization admins only.
drop policy organization_features_write_admin on public.organization_features;
create policy organization_features_write_organization_admin on public.organization_features
for all to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

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

  if p_user_id = auth.uid() then
    raise exception 'users cannot add or change their own membership';
  end if;

  if public.has_organization_role(p_organization_id, array['organization_admin']::public.organization_role[]) then
    null;
  elsif public.has_organization_role(p_organization_id, array['regional_admin']::public.organization_role[]) then
    if p_role not in ('mitra', 'farmer', 'pilot') then
      raise exception 'regional admins can only add mitra, farmer, or pilot members';
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
