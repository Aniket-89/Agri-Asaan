-- Durable audit trail for platform staff actions (ADR 0005).
--
-- platform_audit_log is a GLOBAL platform table (not tenant-owned). It is
-- append-only: no role can update or delete rows, and rows are only written
-- by SECURITY DEFINER code in this migration. Details record which columns
-- changed, never their values, so personal data is not copied into the log.

create table public.platform_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default timezone('utc', now()),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_platform_role public.platform_role,
  action text not null,
  -- No foreign key: audit rows must outlive the tenant they describe.
  target_tenant_id uuid,
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  constraint platform_audit_log_action_format check (action ~ '^[a-z_]+(\.[a-z_]+)+$')
);

create index platform_audit_log_occurred_at_idx on public.platform_audit_log (occurred_at desc);
create index platform_audit_log_target_tenant_idx on public.platform_audit_log (target_tenant_id, occurred_at desc);
create index platform_audit_log_actor_idx on public.platform_audit_log (actor_id, occurred_at desc);

alter table public.platform_audit_log enable row level security;

revoke all on public.platform_audit_log from public, anon, authenticated;
grant select on public.platform_audit_log to authenticated;

create policy platform_audit_log_select_platform_admin on public.platform_audit_log
for select to authenticated
using (public.is_platform_owner() or public.is_system_admin());

create or replace function public.write_platform_audit(
  p_action text,
  p_target_tenant_id uuid,
  p_target_table text,
  p_target_id text,
  p_details jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.platform_audit_log (
    actor_id, actor_platform_role, action, target_tenant_id, target_table, target_id, details
  )
  values (
    auth.uid(),
    (select staff.role from public.platform_staff as staff where staff.user_id = auth.uid()),
    p_action,
    p_target_tenant_id,
    p_target_table,
    p_target_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.write_platform_audit(text, uuid, text, text, jsonb) from public, anon, authenticated;

-- Logs writes to tenant tables made by active platform staff. Tenant users'
-- own changes are not platform actions and are not logged here.
create or replace function public.audit_platform_tenant_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_tenant_id uuid;
  v_changed text[];
begin
  if auth.uid() is null or not public.is_platform_staff() then
    return coalesce(new, old);
  end if;

  v_tenant_id := coalesce(v_row ->> 'tenant_id', v_row ->> 'id')::uuid;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(new_values.key order by new_values.key), '{}')
      into v_changed
    from jsonb_each(to_jsonb(new)) as new_values
    where new_values.value is distinct from (to_jsonb(old) -> new_values.key);
  end if;

  perform public.write_platform_audit(
    'tenant.' || tg_table_name || '.' || lower(tg_op),
    v_tenant_id,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'feature_key', v_row ->> 'hostname', v_tenant_id::text),
    case when tg_op = 'UPDATE' then jsonb_build_object('changed_columns', to_jsonb(v_changed)) else '{}'::jsonb end
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_platform_tenant_write() from public, anon, authenticated;

create trigger audit_platform_tenant_write after insert or update or delete on public.organizations
  for each row execute function public.audit_platform_tenant_write();
create trigger audit_platform_tenant_write after insert or update or delete on public.organization_settings
  for each row execute function public.audit_platform_tenant_write();
create trigger audit_platform_tenant_write after insert or update or delete on public.organization_features
  for each row execute function public.audit_platform_tenant_write();
create trigger audit_platform_tenant_write after insert or update or delete on public.organization_domains
  for each row execute function public.audit_platform_tenant_write();
create trigger audit_platform_tenant_write after insert or update or delete on public.organization_members
  for each row execute function public.audit_platform_tenant_write();

-- Every platform staff change is logged, whoever makes it (including the
-- bootstrap, which runs without an authenticated user).
create or replace function public.audit_platform_staff_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_platform_audit(
    'platform.staff.' || lower(tg_op),
    null,
    'platform_staff',
    coalesce(new.user_id, old.user_id)::text,
    jsonb_build_object(
      'previous_role', old.role,
      'new_role', new.role,
      'previous_status', old.status,
      'new_status', new.status
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_platform_staff_change() from public, anon, authenticated;

create trigger audit_platform_staff_change after insert or update or delete on public.platform_staff
  for each row execute function public.audit_platform_staff_change();

-- Reads cannot be captured by triggers. Platform pages that show tenant data
-- call this so viewing a tenant through the app is recorded.
create or replace function public.log_platform_tenant_access(
  p_tenant_id uuid,
  p_context text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_platform_staff() then
    raise exception 'only active platform staff can record tenant access' using errcode = '42501';
  end if;

  if p_context !~ '^[a-z_]{1,40}$' then
    raise exception 'invalid access context';
  end if;

  perform public.write_platform_audit(
    'tenant.access.' || p_context,
    p_tenant_id,
    null,
    null,
    '{}'::jsonb
  );
end;
$$;

revoke execute on function public.log_platform_tenant_access(uuid, text) from public, anon;
grant execute on function public.log_platform_tenant_access(uuid, text) to authenticated;
