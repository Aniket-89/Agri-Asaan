begin;

create extension if not exists pgtap;

select plan(31);

-- Fixtures (fake data only). Tenant A: org admin, North and South regional
-- admins, a mitra. created_at has no column default: Supabase Auth sets it
-- for real accounts, so fixtures set it explicitly.
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pa-org-admin@example.test', null, now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pa-regional-north@example.test', null, now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pa-regional-south@example.test', null, now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pa-mitra@example.test', null, now(), now(), now()),
  -- An existing, confirmed account that was never invited
  ('b1000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'pa-existing@example.test', null, now(), now(), now());

insert into public.organizations (id, name, slug)
values ('bb000000-0000-4000-8000-00000000000a', 'PA Tenant', 'pa-tenant');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('bb000000-0000-4000-8000-00000000000a', 'bb000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000001', 'organization_admin'),
  ('bb000000-0000-4000-8000-00000000000a', 'bb000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000002', 'regional_admin'),
  ('bb000000-0000-4000-8000-00000000000a', 'bb000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000003', 'regional_admin'),
  ('bb000000-0000-4000-8000-00000000000a', 'bb000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000004', 'mitra');

insert into public.regions (id, tenant_id, name)
values
  ('bb100000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-00000000000a', 'North'),
  ('bb200000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-00000000000a', 'South');

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values
  ('bb000000-0000-4000-8000-00000000000a', 'bb100000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002'),
  ('bb000000-0000-4000-8000-00000000000a', 'bb200000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003');

-- Holds invite ids returned by claims, so later steps can refer to them.
create temporary table pa_ids (label text primary key, id uuid);
grant select, insert on pa_ids to service_role, authenticated;

set local role authenticated;

-- ── Session-level checks (regional admin's own session) ───────────────────
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000002';
select is(public.can_invite_pilot('bb100000-0000-4000-8000-000000000001'), true, 'a regional admin can invite pilots into their region');
select is(public.can_invite_pilot('bb200000-0000-4000-8000-000000000002'), false, 'a regional admin cannot invite pilots into another region');
select throws_ok(
  $$update public.organization_members set role = 'pilot' where user_id = 'b1000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'existing members cannot be promoted to pilot'
);
select throws_ok(
  $$select * from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000002', 'x@example.test', 'bb100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'claim_pilot_invite is not executable from a browser session'
);
select throws_ok(
  $$select public.provision_invited_pilot(gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'provision_invited_pilot is not executable from a browser session'
);

set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000001';
select is(public.can_invite_pilot('bb100000-0000-4000-8000-000000000001'), false, 'organization admins cannot invite pilots (regional admins only)');
select throws_ok(
  $$select public.add_organization_member('bb000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000013', 'pilot')$$,
  'P0001', 'pilots are added through the regional admin pilot invite',
  'pilots cannot be added through the generic add-member function'
);
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000004';
select is(public.can_invite_pilot('bb100000-0000-4000-8000-000000000001'), false, 'mitras cannot invite pilots');

-- ── Claim -> invite -> provision (service key) ─────────────────────────────
reset role;
set local role service_role;

insert into pa_ids
select 'claim1', invite_id from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000002', ' PA-New-1@Example.TEST ', 'bb100000-0000-4000-8000-000000000001');
select is(
  (select status::text || '|' || email from public.pilot_invites where id = (select id from pa_ids where label = 'claim1')),
  'claimed|pa-new-1@example.test', 'a regional admin claims a new email (normalized)'
);

-- Supabase's invite creates the account after the claim.
reset role;
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values
  ('b1000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'pa-new-1@example.test', now(), null, null, now()),
  ('b1000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'pa-other@example.test', now(), null, null, now());
set local role service_role;

select is(
  public.provision_invited_pilot((select id from pa_ids where label = 'claim1'), 'b1000000-0000-4000-8000-000000000021', ' rpc-pa-01 '),
  'bb000000-0000-4000-8000-00000000000a'::uuid,
  'the claimed invite is provisioned into the inviter''s tenant'
);
select is(
  (select home_region_id::text || '|' || license_number || '|' || created_by::text
   from public.pilot_profiles where user_id = 'b1000000-0000-4000-8000-000000000021'),
  'bb100000-0000-4000-8000-000000000001|RPC-PA-01|b1000000-0000-4000-8000-000000000002',
  'the pilot profile is homed in the claimed region, with the inviter recorded'
);
select is(
  (select status::text || '|' || user_id::text from public.pilot_invites where id = (select id from pa_ids where label = 'claim1')),
  'provisioned|b1000000-0000-4000-8000-000000000021', 'the invite record is marked provisioned'
);
select throws_ok(
  $$select public.provision_invited_pilot((select id from pa_ids where label = 'claim1'), 'b1000000-0000-4000-8000-000000000021')$$,
  '23514', 'no open invite claim', 'a claim can be provisioned only once'
);

-- ── Race and capture protection ────────────────────────────────────────────
insert into pa_ids
select 'race', invite_id from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000002', 'pa-race@example.test', 'bb100000-0000-4000-8000-000000000001');
select is(
  (select outcome::text from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000003', 'pa-race@example.test', 'bb200000-0000-4000-8000-000000000002')),
  'email_in_use', 'a second invite for an email with an open claim is refused before any account exists'
);
select throws_ok(
  $$select public.provision_invited_pilot((select id from pa_ids where label = 'race'), 'b1000000-0000-4000-8000-000000000022')$$,
  '23514', 'account does not match this invite', 'a claim cannot capture an account with a different email'
);
select is(
  (select outcome::text from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000002', 'pa-existing@example.test', 'bb100000-0000-4000-8000-000000000001')),
  'email_in_use', 'an email with an existing account cannot be claimed'
);
select is(
  (select count(*)::integer from public.pilot_invites where email = 'pa-existing@example.test' and status = 'email_in_use'),
  1, 'refused attempts are recorded'
);

-- ── Authorization of the claim itself ──────────────────────────────────────
select throws_ok(
  $$select * from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000001', 'pa-x@example.test', 'bb100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'an organization admin cannot claim a pilot invite'
);
select throws_ok(
  $$select * from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000002', 'pa-x@example.test', 'bb200000-0000-4000-8000-000000000002')$$,
  '42501', null, 'a regional admin cannot claim an invite for another region'
);

-- ── Releasing, expiry, and rate limiting ───────────────────────────────────
select lives_ok(
  $$select public.fail_pilot_invite((select id from pa_ids where label = 'race'), 'invite email could not be sent')$$,
  'a failed invite releases its claim'
);
select is(
  (select outcome::text from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000003', 'pa-race@example.test', 'bb200000-0000-4000-8000-000000000002')),
  'claimed', 'a released email can be claimed again'
);

reset role;
insert into public.pilot_invites (tenant_id, email, inviter_id, home_region_id, status, created_at)
values ('bb000000-0000-4000-8000-00000000000a', 'pa-stale@example.test', 'b1000000-0000-4000-8000-000000000002',
  'bb100000-0000-4000-8000-000000000001', 'claimed', now() - interval '2 hours');
set local role service_role;
select is(
  (select outcome::text from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000002', 'pa-stale@example.test', 'bb100000-0000-4000-8000-000000000001')),
  'claimed', 'a claim left open for over an hour expires and no longer blocks the email'
);

-- The South admin has made 2 attempts so far; add 18 to reach the limit of 20.
reset role;
insert into public.pilot_invites (tenant_id, email, inviter_id, home_region_id, status)
select 'bb000000-0000-4000-8000-00000000000a', 'pa-burst-' || n || '@example.test', 'b1000000-0000-4000-8000-000000000003',
  'bb200000-0000-4000-8000-000000000002', 'failed'
from generate_series(1, 18) as n;
set local role service_role;
select is(
  (select outcome::text from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000003', 'pa-limit@example.test', 'bb200000-0000-4000-8000-000000000002')),
  'rate_limited', 'a regional admin is limited to 20 invite attempts per hour'
);

-- ── An inviter demoted mid-invite cannot complete it ───────────────────────
insert into pa_ids
select 'demote', invite_id from public.claim_pilot_invite('b1000000-0000-4000-8000-000000000002', 'pa-demote@example.test', 'bb100000-0000-4000-8000-000000000001');
reset role;
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values ('b1000000-0000-4000-8000-000000000023', 'authenticated', 'authenticated', 'pa-demote@example.test', now(), null, null, now());
update public.organization_members set role = 'mitra' where user_id = 'b1000000-0000-4000-8000-000000000002';
set local role service_role;
select throws_ok(
  $$select public.provision_invited_pilot((select id from pa_ids where label = 'demote'), 'b1000000-0000-4000-8000-000000000023')$$,
  '42501', 'inviter is not a regional admin of this region', 'provisioning re-checks the inviter''s current role'
);
reset role;
update public.organization_members set role = 'regional_admin' where user_id = 'b1000000-0000-4000-8000-000000000002';

-- ── Guarded clean-up never removes real accounts ───────────────────────────
set local role service_role;
select is(
  public.delete_orphaned_pilot_invite('b1000000-0000-4000-8000-000000000021', now() - interval '1 hour'),
  false, 'clean-up never deletes an account that is a member somewhere'
);
select is(
  public.delete_orphaned_pilot_invite('b1000000-0000-4000-8000-000000000023', now() + interval '1 hour'),
  false, 'clean-up never deletes an account created before this request'
);
select is(
  public.delete_orphaned_pilot_invite('b1000000-0000-4000-8000-000000000023', now() - interval '1 hour'),
  true, 'clean-up removes a fresh, unconfirmed orphan invite'
);

-- ── Audit trail visibility ─────────────────────────────────────────────────
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000001';
select ok(
  (select count(*)::integer from public.pilot_invites where tenant_id = 'bb000000-0000-4000-8000-00000000000a') >= 20,
  'organization admins see their tenant''s invite records'
);
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::integer from public.pilot_invites where inviter_id is distinct from auth.uid()),
  0, 'a regional admin sees only the invites they sent'
);
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000004';
select is((select count(*)::integer from public.pilot_invites), 0, 'mitras see no invite records');
select throws_ok(
  $$insert into public.pilot_invites (tenant_id, email, home_region_id, status) values ('bb000000-0000-4000-8000-00000000000a', 'forged@example.test', 'bb100000-0000-4000-8000-000000000001', 'provisioned')$$,
  '42501', null, 'invite records cannot be written through the API'
);

select * from finish();
rollback;
