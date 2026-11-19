create type public.platform_role as enum (
  'platform_owner',
  'system_admin',
  'developer',
  'support'
);

create type public.platform_staff_status as enum (
  'active',
  'suspended'
);

create table public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_role not null,
  status public.platform_staff_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  constraint platform_staff_user_unique unique (user_id)
);

create index platform_staff_role_status_idx
  on public.platform_staff(role, status);

alter type public.organization_role add value if not exists 'organization_admin';
alter type public.organization_role add value if not exists 'regional_admin';

create or replace function public.is_platform_role(p_roles public.platform_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_staff s
    where s.user_id = auth.uid()
      and s.status = 'active'
      and s.role = any(p_roles)
  );
$$;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_role(array['platform_owner']::public.platform_role[]);
$$;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_role(array['system_admin']::public.platform_role[]);
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_staff s
    where s.user_id = auth.uid()
      and s.status = 'active'
  );
$$;

revoke execute on function public.is_platform_role(public.platform_role[]) from public, anon;
revoke execute on function public.is_platform_owner() from public, anon;
revoke execute on function public.is_system_admin() from public, anon;
revoke execute on function public.is_platform_staff() from public, anon;
grant execute on function public.is_platform_role(public.platform_role[]) to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.is_platform_staff() to authenticated;

create or replace function public.bootstrap_platform_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.platform_staff where role = 'platform_owner') then
    raise exception 'a platform owner already exists';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'profile not found';
  end if;

  insert into public.platform_staff (user_id, role, status, created_by)
  values (p_user_id, 'platform_owner', 'active', p_user_id);
end;
$$;

revoke execute on function public.bootstrap_platform_owner(uuid) from public, anon, authenticated;

create or replace function public.manage_platform_staff(
  p_user_id uuid,
  p_role public.platform_role,
  p_status public.platform_staff_status default 'active'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'authentication required';
  end if;

  if p_user_id = v_caller then
    raise exception 'users cannot manage their own platform staff record';
  end if;

  if p_role = 'platform_owner' and not public.is_platform_owner() then
    raise exception 'only a platform owner can assign the platform owner role';
  end if;

  if not (
    public.is_platform_owner()
    or public.is_platform_role(array['system_admin']::public.platform_role[])
  ) then
    raise exception 'insufficient platform privileges';
  end if;

  if public.is_platform_role(array['system_admin']::public.platform_role[])
     and p_role = 'platform_owner' then
    raise exception 'system administrators cannot assign platform owner';
  end if;

  insert into public.platform_staff (user_id, role, status, created_by)
  values (p_user_id, p_role, p_status, v_caller)
  on conflict (user_id) do update
    set role = excluded.role,
        status = excluded.status,
        updated_at = timezone('utc', now());
end;
$$;

revoke execute on function public.manage_platform_staff(uuid, public.platform_role, public.platform_staff_status) from public, anon;
grant execute on function public.manage_platform_staff(uuid, public.platform_role, public.platform_staff_status) to authenticated;

alter table public.platform_staff enable row level security;

create policy platform_staff_select_self_or_admin on public.platform_staff
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy platform_staff_insert_admin on public.platform_staff
for insert to authenticated
with check (
  user_id <> auth.uid()
  and (
    public.is_platform_owner()
    or (
      public.is_platform_role(array['system_admin']::public.platform_role[])
      and role <> 'platform_owner'
    )
  )
);

create policy platform_staff_update_admin on public.platform_staff
for update to authenticated
using (
  user_id <> auth.uid()
  and (
    public.is_platform_owner()
    or public.is_platform_role(array['system_admin']::public.platform_role[])
  )
)
with check (
  user_id <> auth.uid()
  and (
    public.is_platform_owner()
    or (
      public.is_platform_role(array['system_admin']::public.platform_role[])
      and role <> 'platform_owner'
    )
  )
);

create policy platform_staff_delete_owner on public.platform_staff
for delete to authenticated
using (
  user_id <> auth.uid()
  and public.is_platform_owner()
);
