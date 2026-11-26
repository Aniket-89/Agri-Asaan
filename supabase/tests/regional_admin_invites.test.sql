begin;

create extension if not exists pgtap;

select plan(20);

-- Fixtures (fake data only). Tenant A: org admin, a regional admin, a mitra.
-- Tenant B: its own org admin.
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values
  ('c2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ri-org-admin@example.test', null, now(), now(), now()),
  ('c2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ri-regional@example.test', null, now(), now(), now()),
  ('c2000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ri-mitra@example.test', null, now(), now(), now()),
  ('c2000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'ri-other-admin@example.test', null, now(), now(), now());

insert into public.organizations (id, name, slug)
values
  ('c2a00000-0000-4000-8000-00000000000a', 'RI Tenant A', 'ri-tenant-a'),
  ('c2a00000-0000-4000-8000-00000000000b', 'RI Tenant B', 'ri-tenant-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('c2a00000-0000-4000-8000-00000000000a', 'c2a00000-0000-4000-8000-00000000000a', 'c2000000-0000-4000-8000-000000000001', 'organization_admin'),
  ('c2a00000-0000-4000-8000-00000000000a', 'c2a00000-0000-4000-8000-00000000000a', 'c2000000-0000-4000-8000-000000000002', 'regional_admin'),
  ('c2a00000-0000-4000-8000-00000000000a', 'c2a00000-0000-4000-8000-00000000000a', 'c2000000-0000-4000-8000-000000000003', 'mitra'),
  ('c2a00000-0000-4000-8000-00000000000b', 'c2a00000-0000-4000-8000-00000000000b', 'c2000000-0000-4000-8000-000000000004', 'organization_admin');

insert into public.regions (id, tenant_id, name, is_active)
values
  ('c2100000-0000-4000-8000-000000000001', 'c2a00000-0000-4000-8000-00000000000a', 'East', true),
  ('c2100000-0000-4000-8000-000000000002', 'c2a00000-0000-4000-8000-00000000000a', 'Closed', false),
  ('c2100000-0000-4000-8000-000000000003', 'c2a00000-0000-4000-8000-00000000000b', 'B Region', true);

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values ('c2a00000-0000-4000-8000-00000000000a', 'c2100000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002');

create temporary table ri_ids (label text primary key, id uuid);
grant select, insert on ri_ids to service_role, authenticated;

set local role authenticated;

-- ── Session-level checks ───────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'c2000000-0000-4000-8000-000000000001';
select is(public.can_invite_regional_admin('c2100000-0000-4000-8000-000000000001'), true, 'an organization admin can invite a regional admin into their region');
select is(public.can_invite_regional_admin('c2100000-0000-4000-8000-000000000002'), false, 'an organization admin cannot invite into an inactive region');
select is(public.can_invite_regional_admin('c2100000-0000-4000-8000-000000000003'), false, 'an organization admin cannot invite into another tenant''s region');
select throws_ok(
  $$select * from public.claim_regional_admin_invite('c2000000-0000-4000-8000-000000000001', 'x@example.test', 'c2100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'claim_regional_admin_invite is not executable from a browser session'
);
select throws_ok(
  $$select public.provision_invited_regional_admin(gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'provision_invited_regional_admin is not executable from a browser session'
);

set local "request.jwt.claim.sub" = 'c2000000-0000-4000-8000-000000000002';
select is(public.can_invite_regional_admin('c2100000-0000-4000-8000-000000000001'), false, 'regional admins cannot invite regional admins');
set local "request.jwt.claim.sub" = 'c2000000-0000-4000-8000-000000000003';
select is(public.can_invite_regional_admin('c2100000-0000-4000-8000-000000000001'), false, 'mitras cannot invite regional admins');

reset role;
set local role anon;
select throws_ok(
  $$select public.can_invite_regional_admin('c2100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'anonymous visitors cannot call can_invite_regional_admin'
);

-- ── Claim -> invite -> provision (service key) ─────────────────────────────
reset role;
set local role service_role;

insert into ri_ids
select 'claim1', invite_id from public.claim_regional_admin_invite('c2000000-0000-4000-8000-000000000001', ' RI-New@Example.TEST ', 'c2100000-0000-4000-8000-000000000001');
select is(
  (select status::text || '|' || email from public.regional_admin_invites where id = (select id from ri_ids where label = 'claim1')),
  'claimed|ri-new@example.test', 'an organization admin claims a new email (normalized)'
);

reset role;
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values
  ('c2000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'ri-new@example.test', now(), null, null, now()),
  ('c2000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'ri-other@example.test', now(), null, null, now());
set local role service_role;

select throws_ok(
  $$select public.provision_invited_regional_admin((select id from ri_ids where label = 'claim1'), 'c2000000-0000-4000-8000-000000000022')$$,
  '23514', 'account does not match this invite', 'a claim cannot capture an account with a different email'
);
select is(
  public.provision_invited_regional_admin((select id from ri_ids where label = 'claim1'), 'c2000000-0000-4000-8000-000000000021'),
  'c2a00000-0000-4000-8000-00000000000a'::uuid, 'provisioning returns the inviter''s tenant'
);
select is(
  (select role::text from public.organization_members where user_id = 'c2000000-0000-4000-8000-000000000021'),
  'regional_admin', 'the invited account becomes a regional admin'
);
select is(
  (select region_id from public.regional_admin_regions where user_id = 'c2000000-0000-4000-8000-000000000021'),
  'c2100000-0000-4000-8000-000000000001'::uuid, 'the regional admin is assigned to the invited region'
);
select throws_ok(
  $$select public.provision_invited_regional_admin((select id from ri_ids where label = 'claim1'), 'c2000000-0000-4000-8000-000000000021')$$,
  '23514', 'no open invite claim', 'a claim can be provisioned only once'
);

-- ── Authorization and shared rules ─────────────────────────────────────────
select throws_ok(
  $$select * from public.claim_regional_admin_invite('c2000000-0000-4000-8000-000000000004', 'ri-x@example.test', 'c2100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'another tenant''s organization admin cannot claim an invite for this region'
);
select throws_ok(
  $$select * from public.claim_regional_admin_invite('c2000000-0000-4000-8000-000000000002', 'ri-x@example.test', 'c2100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a regional admin cannot claim a regional admin invite'
);

insert into ri_ids
select 'shared', invite_id from public.claim_regional_admin_invite('c2000000-0000-4000-8000-000000000001', 'ri-shared@example.test', 'c2100000-0000-4000-8000-000000000001');
select is(
  (select outcome::text from public.claim_pilot_invite('c2000000-0000-4000-8000-000000000002', 'ri-shared@example.test', 'c2100000-0000-4000-8000-000000000001')),
  'email_in_use', 'a pilot invite is refused while a regional admin invite holds the email'
);
select lives_ok(
  $$select public.fail_regional_admin_invite((select id from ri_ids where label = 'shared'), 'invite email could not be sent')$$,
  'a failed regional admin invite releases its claim'
);

-- ── Audit trail visibility ─────────────────────────────────────────────────
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c2000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.regional_admin_invites), 0, 'regional admins see no regional admin invite records');
select throws_ok(
  $$insert into public.regional_admin_invites (tenant_id, email, region_id, status) values ('c2a00000-0000-4000-8000-00000000000a', 'forged@example.test', 'c2100000-0000-4000-8000-000000000001', 'provisioned')$$,
  '42501', null, 'regional admin invite records cannot be written through the API'
);

select * from finish();
rollback;
