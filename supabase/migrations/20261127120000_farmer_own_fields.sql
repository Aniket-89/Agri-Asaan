-- Farmers add and edit their own fields (ADR 0021 follow-up).
--
-- A self-registered farmer had no way to add fields, so they could not book
-- until a mitra or admin added them. A farmer's linked login may now insert
-- fields for their own farmer record and update them. Deleting stays with the
-- farmer's managers. Column grants are unchanged: the boundary, tenant and
-- farmer link are never written by the farmer.

-- The caller is the farmer's own linked login and still a farmer member.
create or replace function public.is_own_farmer(p_farmer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farmers as farmer
    where farmer.id = p_farmer_id
      and farmer.profile_id = auth.uid()
      and farmer.is_active
      and public.has_organization_role(farmer.tenant_id, array['farmer']::public.organization_role[])
  );
$$;

revoke execute on function public.is_own_farmer(uuid) from public, anon;
grant execute on function public.is_own_farmer(uuid) to authenticated;

drop policy fields_insert on public.fields;
create policy fields_insert on public.fields
for insert to authenticated
with check (public.can_manage_farmer(farmer_id) or public.is_own_farmer(farmer_id));

drop policy fields_update on public.fields;
create policy fields_update on public.fields
for update to authenticated
using (public.can_manage_farmer(farmer_id) or public.is_own_farmer(farmer_id))
with check (public.can_manage_farmer(farmer_id) or public.is_own_farmer(farmer_id));

-- A generous cap on active fields per farmer, so an open sign-up cannot be
-- used to fill the table. Staff and farmers share it.
create or replace function public.limit_fields_per_farmer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and (
    select count(*) from public.fields
    where farmer_id = new.farmer_id and is_active and id <> new.id
  ) >= 50 then
    raise exception 'a farmer can have at most 50 active fields' using errcode = '23514', hint = 'too_many_fields';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_fields_per_farmer() from public, anon, authenticated;

create trigger limit_fields_per_farmer before insert or update of is_active on public.fields
  for each row execute function public.limit_fields_per_farmer();
