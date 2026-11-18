create extension if not exists pgcrypto;

create type public.organization_role as enum (
  'super_admin',
  'admin',
  'mitra',
  'farmer',
  'pilot'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_slug_unique unique (slug)
);

create table public.organization_members (
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, user_id),
  constraint organization_members_tenant_consistent check (tenant_id = organization_id)
);

create table public.organization_settings (
  tenant_id uuid primary key references public.organizations(id) on delete cascade,
  default_locale text not null default 'en',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organization_settings_locale check (default_locale in ('en', 'hi'))
);

create table public.organization_features (
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, feature_key),
  constraint organization_features_key_format check (feature_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
);

create table public.organization_domains (
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  hostname text not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, hostname),
  constraint organization_domains_hostname_unique unique (hostname),
  constraint organization_domains_hostname_format check (hostname ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$')
);

create index organization_members_user_id_idx on public.organization_members(user_id);
create index organization_members_tenant_id_idx on public.organization_members(tenant_id);
create index organization_features_tenant_id_idx on public.organization_features(tenant_id);
create index organization_domains_tenant_id_idx on public.organization_domains(tenant_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.phone, '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(
  p_organization_id uuid,
  p_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

create or replace function public.profiles_share_organization(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members viewer
    join public.organization_members subject
      on subject.organization_id = viewer.organization_id
    where viewer.user_id = auth.uid()
      and subject.user_id = p_profile_id
  );
$$;

revoke execute on function public.is_organization_member(uuid) from public, anon;
revoke execute on function public.has_organization_role(uuid, public.organization_role[]) from public, anon;
revoke execute on function public.profiles_share_organization(uuid) from public, anon;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.organization_role[]) to authenticated;
grant execute on function public.profiles_share_organization(uuid) to authenticated;

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  p_name := btrim(p_name);
  p_slug := lower(btrim(p_slug));

  if p_name = '' then
    raise exception 'organization name is required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid organization slug';
  end if;

  insert into public.organizations (name, slug)
  values (p_name, p_slug)
  returning id into v_org_id;

  insert into public.organization_members (tenant_id, organization_id, user_id, role)
  values (v_org_id, v_org_id, v_user_id, 'super_admin');

  insert into public.organization_settings (tenant_id, default_locale, timezone)
  values (v_org_id, 'en', 'Asia/Kolkata');

  return v_org_id;
end;
$$;

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

  if not public.has_organization_role(p_organization_id, array['super_admin']::public.organization_role[]) then
    raise exception 'only a super admin can add organization members';
  end if;

  if p_role = 'super_admin' and p_user_id = auth.uid() then
    raise exception 'a super admin cannot change or add their own role';
  end if;

  insert into public.organization_members (tenant_id, organization_id, user_id, role)
  values (p_organization_id, p_organization_id, p_user_id, p_role);
end;
$$;

revoke execute on function public.create_organization_for_current_user(text, text) from public, anon;
revoke execute on function public.add_organization_member(uuid, uuid, public.organization_role) from public, anon;
grant execute on function public.create_organization_for_current_user(text, text) to authenticated;
grant execute on function public.add_organization_member(uuid, uuid, public.organization_role) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_features enable row level security;
alter table public.organization_domains enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.profiles_share_organization(id));

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy organizations_select_member on public.organizations
for select to authenticated
using (public.is_organization_member(id));

create policy organizations_update_super_admin on public.organizations
for update to authenticated
using (public.has_organization_role(id, array['super_admin']::public.organization_role[]))
with check (public.has_organization_role(id, array['super_admin']::public.organization_role[]));

create policy organization_members_select on public.organization_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(
    organization_id,
    array['super_admin', 'admin']::public.organization_role[]
  )
);

create policy organization_members_update_admin on public.organization_members
for update to authenticated
using (
  user_id <> auth.uid()
  and public.has_organization_role(
    organization_id,
    array['super_admin', 'admin']::public.organization_role[]
  )
)
with check (
  user_id <> auth.uid()
  and public.has_organization_role(
    organization_id,
    array['super_admin', 'admin']::public.organization_role[]
  )
);

create policy organization_members_delete_super_admin on public.organization_members
for delete to authenticated
using (
  user_id <> auth.uid()
  and public.has_organization_role(
    organization_id,
    array['super_admin']::public.organization_role[]
  )
);

create policy organization_settings_select_member on public.organization_settings
for select to authenticated
using (public.is_organization_member(tenant_id));

create policy organization_settings_write_super_admin on public.organization_settings
for all to authenticated
using (public.has_organization_role(tenant_id, array['super_admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['super_admin']::public.organization_role[]));

create policy organization_features_select_member on public.organization_features
for select to authenticated
using (public.is_organization_member(tenant_id));

create policy organization_features_write_admin on public.organization_features
for all to authenticated
using (public.has_organization_role(tenant_id, array['super_admin', 'admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['super_admin', 'admin']::public.organization_role[]));

create policy organization_domains_select_member on public.organization_domains
for select to authenticated
using (public.is_organization_member(tenant_id));

create policy organization_domains_write_super_admin on public.organization_domains
for all to authenticated
using (public.has_organization_role(tenant_id, array['super_admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['super_admin']::public.organization_role[]));
