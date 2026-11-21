-- Territory: regions, villages, and who covers them (ADR 0008).
--
-- All four tables are tenant-owned. Composite foreign keys on
-- (tenant_id, ...) make cross-tenant references impossible. Assignment rows
-- point at organization memberships, and a trigger checks that the member
-- holds the right role. Access helpers re-check the current role, so an
-- assignment stops granting anything once a member's role changes.

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint regions_name_not_blank check (btrim(name) <> '' and char_length(name) <= 120),
  constraint regions_tenant_id_id_unique unique (tenant_id, id)
);

create unique index regions_tenant_name_unique on public.regions (tenant_id, lower(btrim(name)));

create table public.villages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  region_id uuid not null,
  name text not null,
  -- Official Local Government Directory (LGD) village code, when known.
  lgd_code text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  -- Derived from latitude/longitude so writes stay simple; SRID 4326 (WGS 84).
  location extensions.geography(Point, 4326) generated always as (
    case
      when latitude is null or longitude is null then null
      else extensions.st_setsrid(
        extensions.st_makepoint(longitude::double precision, latitude::double precision),
        4326
      )::extensions.geography
    end
  ) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint villages_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id) on delete cascade,
  constraint villages_name_not_blank check (btrim(name) <> '' and char_length(name) <= 120),
  constraint villages_lgd_code_format check (lgd_code is null or lgd_code ~ '^[0-9]{1,10}$'),
  constraint villages_coordinates_paired check ((latitude is null) = (longitude is null)),
  constraint villages_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint villages_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint villages_tenant_id_id_unique unique (tenant_id, id)
);

create unique index villages_region_name_unique on public.villages (region_id, lower(btrim(name)));
create unique index villages_tenant_lgd_code_unique on public.villages (tenant_id, lgd_code) where lgd_code is not null;
create index villages_tenant_region_idx on public.villages (tenant_id, region_id);
create index villages_location_gist on public.villages using gist (location);

create table public.regional_admin_regions (
  tenant_id uuid not null,
  region_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (region_id, user_id),
  constraint regional_admin_regions_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id) on delete cascade,
  constraint regional_admin_regions_member_same_tenant
    foreign key (tenant_id, user_id) references public.organization_members (organization_id, user_id) on delete cascade
);

create index regional_admin_regions_user_idx on public.regional_admin_regions (tenant_id, user_id);

create table public.mitra_villages (
  tenant_id uuid not null,
  village_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (village_id, user_id),
  constraint mitra_villages_village_same_tenant
    foreign key (tenant_id, village_id) references public.villages (tenant_id, id) on delete cascade,
  constraint mitra_villages_member_same_tenant
    foreign key (tenant_id, user_id) references public.organization_members (organization_id, user_id) on delete cascade
);

create index mitra_villages_user_idx on public.mitra_villages (tenant_id, user_id);

-- ── Assignment role checks ──────────────────────────────────────────────────

create or replace function public.check_territory_assignment_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_required public.organization_role :=
    case tg_table_name
      when 'regional_admin_regions' then 'regional_admin'::public.organization_role
      else 'mitra'::public.organization_role
    end;
begin
  if not exists (
    select 1 from public.organization_members as member
    where member.organization_id = new.tenant_id
      and member.user_id = new.user_id
      and member.role = v_required
  ) then
    raise exception 'only a % member can be assigned here', v_required using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_territory_assignment_role() from public, anon, authenticated;

create trigger check_assignment_role before insert or update on public.regional_admin_regions
  for each row execute function public.check_territory_assignment_role();
create trigger check_assignment_role before insert or update on public.mitra_villages
  for each row execute function public.check_territory_assignment_role();

-- ── Access helpers ──────────────────────────────────────────────────────────

-- Organization admin of the tenant, or a regional admin currently assigned to
-- the region (and still holding the regional_admin role).
create or replace function public.can_manage_region(p_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.regions as region
    join public.organization_members as member
      on member.organization_id = region.tenant_id
     and member.user_id = auth.uid()
    where region.id = p_region_id
      and (
        member.role = 'organization_admin'
        or (
          member.role = 'regional_admin'
          and exists (
            select 1 from public.regional_admin_regions as assignment
            where assignment.region_id = region.id
              and assignment.user_id = member.user_id
          )
        )
      )
  );
$$;

create or replace function public.can_manage_village(p_village_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.villages as village
    where village.id = p_village_id
      and public.can_manage_region(village.region_id)
  );
$$;

create or replace function public.is_mitra_for_village(p_village_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mitra_villages as assignment
    join public.organization_members as member
      on member.organization_id = assignment.tenant_id
     and member.user_id = assignment.user_id
    where assignment.village_id = p_village_id
      and assignment.user_id = auth.uid()
      and member.role = 'mitra'
  );
$$;

revoke execute on function public.can_manage_region(uuid) from public, anon;
revoke execute on function public.can_manage_village(uuid) from public, anon;
revoke execute on function public.is_mitra_for_village(uuid) from public, anon;
grant execute on function public.can_manage_region(uuid) to authenticated;
grant execute on function public.can_manage_village(uuid) to authenticated;
grant execute on function public.is_mitra_for_village(uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.regions enable row level security;
alter table public.villages enable row level security;
alter table public.regional_admin_regions enable row level security;
alter table public.mitra_villages enable row level security;

revoke all on public.regions, public.villages, public.regional_admin_regions, public.mitra_villages from anon;

-- Regions and villages are non-sensitive reference data for every member of
-- the tenant (farmers and mitras need them to choose a village).
create policy regions_select_member on public.regions
for select to authenticated
using (public.is_organization_member(tenant_id));

create policy regions_insert_organization_admin on public.regions
for insert to authenticated
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy regions_update_organization_admin on public.regions
for update to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy regions_delete_organization_admin on public.regions
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy villages_select_member on public.villages
for select to authenticated
using (public.is_organization_member(tenant_id));

create policy villages_insert_region_manager on public.villages
for insert to authenticated
with check (public.can_manage_region(region_id));

create policy villages_update_region_manager on public.villages
for update to authenticated
using (public.can_manage_region(region_id))
with check (public.can_manage_region(region_id));

create policy villages_delete_region_manager on public.villages
for delete to authenticated
using (public.can_manage_region(region_id));

-- Regional admin assignments: managed by organization admins; visible to them
-- and to the assigned regional admin.
create policy regional_admin_regions_select on public.regional_admin_regions
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[])
);

create policy regional_admin_regions_insert_organization_admin on public.regional_admin_regions
for insert to authenticated
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy regional_admin_regions_delete_organization_admin on public.regional_admin_regions
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

-- Mitra assignments: managed by whoever manages the village's region; visible
-- to them and to the assigned mitra.
create policy mitra_villages_select on public.mitra_villages
for select to authenticated
using (user_id = auth.uid() or public.can_manage_village(village_id));

create policy mitra_villages_insert_region_manager on public.mitra_villages
for insert to authenticated
with check (public.can_manage_village(village_id));

create policy mitra_villages_delete_region_manager on public.mitra_villages
for delete to authenticated
using (public.can_manage_village(village_id));

-- Assignments are created and deleted, never edited in place.
revoke update on public.regional_admin_regions, public.mitra_villages from authenticated;

-- Villages cannot be moved between tenants, and the generated location is
-- never written directly.
revoke update on public.villages from authenticated;
grant update (region_id, name, lgd_code, latitude, longitude, is_active, updated_at) on public.villages to authenticated;
revoke update on public.regions from authenticated;
grant update (name, is_active, updated_at) on public.regions to authenticated;
