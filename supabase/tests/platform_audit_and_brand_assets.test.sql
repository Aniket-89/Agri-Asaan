begin;

create extension if not exists pgtap;

select plan(22);

-- Fixtures (fake data only).
insert into auth.users (id, aud, role, email)
values
  ('f1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'audit-system-admin@example.test'),
  ('f2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'audit-developer@example.test'),
  ('f3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'audit-org-admin@example.test');

insert into public.organizations (id, name, slug)
values ('fa000000-0000-4000-8000-000000000001', 'Audit Tenant', 'audit-tenant');

insert into public.organization_settings (tenant_id) values ('fa000000-0000-4000-8000-000000000001');

insert into public.organization_domains (tenant_id, hostname, is_verified, is_primary)
values ('fa000000-0000-4000-8000-000000000001', 'audit-brand.example.test', true, true);

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values ('fa000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', 'f3333333-3333-4333-8333-333333333333', 'organization_admin');

insert into public.platform_staff (user_id, role, status)
values
  ('f1111111-1111-4111-8111-111111111111', 'system_admin', 'active'),
  ('f2222222-2222-4222-8222-222222222222', 'developer', 'active');

select is(
  (select count(*)::integer from public.platform_audit_log
   where action = 'platform.staff.insert' and target_id = 'f1111111-1111-4111-8111-111111111111'),
  1,
  'platform staff changes are audited even without an authenticated user'
);

-- ── Brand asset constraints ────────────────────────────────────────────────
select throws_ok(
  $$update public.organization_settings
    set brand_logo_path = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.png'
    where tenant_id = 'fa000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'a logo path must live under the tenant''s own folder'
);
select throws_ok(
  $$update public.organization_settings
    set brand_logo_path = 'fa000000-0000-4000-8000-000000000001/logo.svg'
    where tenant_id = 'fa000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'SVG logos are rejected'
);
select throws_ok(
  $$update public.organization_settings set brand_accent_color = 'red'
    where tenant_id = 'fa000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'accent color must be #RRGGBB'
);
update public.organization_settings
set brand_tagline = 'Fake tagline',
    brand_accent_color = '#abcdef',
    brand_logo_path = 'fa000000-0000-4000-8000-000000000001/logo.png'
where tenant_id = 'fa000000-0000-4000-8000-000000000001';

set local role anon;
select is(
  (select brand_tagline || '|' || brand_accent_color || '|' || brand_logo_path
   from public.get_public_branding('audit-brand.example.test')),
  'Fake tagline|#abcdef|fa000000-0000-4000-8000-000000000001/logo.png',
  'public branding returns tagline, accent color, and logo path'
);
reset role;

-- ── Organization admin ─────────────────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claim.sub" = 'f3333333-3333-4333-8333-333333333333';

update public.organizations set name = 'Audit Tenant Renamed' where id = 'fa000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.platform_audit_log), 0, 'organization admins cannot read the audit log');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-assets', 'fa000000-0000-4000-8000-000000000001/logo.png')$$,
  '42501',
  null,
  'organization admins cannot upload brand assets'
);
select throws_ok(
  $$select public.log_platform_tenant_access('fa000000-0000-4000-8000-000000000001', 'organization_details')$$,
  '42501',
  null,
  'non-staff cannot write tenant access records'
);
select throws_ok(
  $$insert into public.platform_audit_log (action) values ('forged.entry')$$,
  '42501',
  null,
  'users cannot insert audit rows directly'
);

-- ── System admin ───────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'f1111111-1111-4111-8111-111111111111';

select is(
  (select count(*)::integer from public.platform_audit_log
   where action = 'tenant.organizations.update'
     and target_tenant_id = 'fa000000-0000-4000-8000-000000000001'),
  0,
  'tenant users'' own changes are not platform audit events'
);

update public.organizations set is_active = false where id = 'fa000000-0000-4000-8000-000000000001';
select is(
  (select details -> 'changed_columns' from public.platform_audit_log
   where action = 'tenant.organizations.update' and actor_id = auth.uid()),
  '["is_active"]'::jsonb,
  'platform staff tenant updates are audited with changed column names'
);
select is(
  (select actor_platform_role::text from public.platform_audit_log
   where action = 'tenant.organizations.update' and actor_id = auth.uid()),
  'system_admin',
  'audit rows record the actor''s platform role'
);
select is(
  (select target_tenant_id from public.platform_audit_log
   where action = 'tenant.organizations.update' and actor_id = auth.uid()),
  'fa000000-0000-4000-8000-000000000001'::uuid,
  'audit rows record the target tenant'
);

update public.organization_settings set brand_tagline = 'Changed by staff'
where tenant_id = 'fa000000-0000-4000-8000-000000000001';
select ok(
  not exists (
    select 1 from public.platform_audit_log
    where action = 'tenant.organization_settings.update'
      and details::text like '%Changed by staff%'
  ),
  'audit details never copy changed values'
);

select lives_ok(
  $$select public.log_platform_tenant_access('fa000000-0000-4000-8000-000000000001', 'organization_details')$$,
  'platform staff can record tenant access'
);
select is(
  (select count(*)::integer from public.platform_audit_log
   where action = 'tenant.access.organization_details'
     and target_tenant_id = 'fa000000-0000-4000-8000-000000000001'),
  1,
  'tenant access is recorded'
);
select throws_ok(
  $$select public.log_platform_tenant_access('fa000000-0000-4000-8000-000000000001', 'Bad Context!')$$,
  'P0001',
  'invalid access context',
  'access context is validated'
);

select throws_ok(
  $$update public.platform_audit_log set action = 'tampered.entry'$$,
  '42501',
  null,
  'audit rows cannot be updated, even by system admins'
);
select throws_ok(
  $$delete from public.platform_audit_log$$,
  '42501',
  null,
  'audit rows cannot be deleted, even by system admins'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-assets', 'fa000000-0000-4000-8000-000000000001/logo.png')$$,
  'system admins can upload brand assets'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-assets', 'fa000000-0000-4000-8000-000000000001/logo.svg')$$,
  '42501',
  null,
  'brand asset uploads must use an allowed raster format'
);

-- ── Developer (platform staff without admin rights) ────────────────────────
set local "request.jwt.claim.sub" = 'f2222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.platform_audit_log), 0, 'developers cannot read the audit log');

select * from finish();
rollback;
