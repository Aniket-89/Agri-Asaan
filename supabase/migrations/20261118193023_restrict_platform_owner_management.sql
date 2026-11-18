drop policy platform_staff_update_admin on public.platform_staff;

create policy platform_staff_update_admin on public.platform_staff
for update to authenticated
using (
  user_id <> auth.uid()
  and (
    public.is_platform_owner()
    or (
      public.is_platform_role(array['system_admin']::public.platform_role[])
      and role <> 'platform_owner'
    )
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

  if exists (
    select 1
    from public.platform_staff
    where user_id = p_user_id
      and role = 'platform_owner'
  ) and not public.is_platform_owner() then
    raise exception 'only a platform owner can modify an existing platform owner';
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
