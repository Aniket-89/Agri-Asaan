begin;

create extension if not exists pgtap;

select plan(23);

-- Fixtures (fake data only). Tenant A: org admin, North regional admin,
-- South regional admin, a mitra. Plus auth accounts in different states.
-- created_at has no column default: Supabase Auth sets it for real accounts.
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pa-org-admin@example.test', null, now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pa-regional-north@example.test', null, now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pa-regional-south@example.test', null, now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pa-mitra@example.test', null, now(), now(), now()),
  -- Fresh invites (unconfirmed, never signed in)
  ('b1000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'pa-invited-1@example.test', now(), null, null, now()),
  ('b1000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'pa-invited-2@example.test', now(), null, null, now()),
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

set local role authenticated;

-- ── can_invite_pilot (asked with the caller's own session) ─────────────────
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000002';
select is(public.can_invite_pilot('bb100000-0000-4000-8000-000000000001'), true, 'a regional admin can invite pilots into their region');
select is(public.can_invite_pilot('bb200000-0000-4000-8000-000000000002'), false, 'a regional admin cannot invite pilots into another region');

set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000001';
select is(public.can_invite_pilot('bb100000-0000-4000-8000-000000000001'), false, 'organization admins cannot invite pilots (regional admins only)');
select throws_ok(
  $$select public.add_organization_member('bb000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000013', 'pilot')$$,
  'P0001', 'pilots are added through the regional admin pilot invite',
  'pilots cannot be added through the generic add-member function'
);

set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000004';
select is(public.can_invite_pilot('bb100000-0000-4000-8000-000000000001'), false, 'mitras cannot invite pilots');

-- A regional admin cannot turn an existing member into a pilot.
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000002';
select throws_ok(
  $$update public.organization_members set role = 'pilot' where user_id = 'b1000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'existing members cannot be promoted to pilot'
);

-- The provisioning function is not callable from a browser session.
select throws_ok(
  $$select public.provision_invited_pilot('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000011', 'bb100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'provision_invited_pilot is not executable by authenticated users'
);

-- ── provision_invited_pilot (server, service key) ──────────────────────────
reset role;
set local role service_role;

select is(
  public.provision_invited_pilot('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000011', 'bb100000-0000-4000-8000-000000000001', ' rpc-pa-01 '),
  'bb000000-0000-4000-8000-00000000000a'::uuid,
  'a fresh invite by a regional admin becomes a pilot of that tenant'
);
select is(
  (select role::text from public.organization_members where user_id = 'b1000000-0000-4000-8000-000000000011'),
  'pilot', 'the invited account is a pilot member'
);
select is(
  (select home_region_id::text || '|' || license_number || '|' || created_by::text
   from public.pilot_profiles where user_id = 'b1000000-0000-4000-8000-000000000011'),
  'bb100000-0000-4000-8000-000000000001|RPC-PA-01|b1000000-0000-4000-8000-000000000002',
  'the pilot profile is homed in the region, with a normalized certificate and the inviter recorded'
);
select throws_ok(
  $$select public.provision_invited_pilot('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000011', 'bb100000-0000-4000-8000-000000000001')$$,
  '23514', 'account already belongs to an organization',
  'the same invite cannot be provisioned twice'
);
select throws_ok(
  $$select public.provision_invited_pilot('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000012', 'bb100000-0000-4000-8000-000000000001')$$,
  '42501', 'inviter is not a regional admin of this region',
  'an organization admin cannot be the inviter'
);
select throws_ok(
  $$select public.provision_invited_pilot('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000012', 'bb200000-0000-4000-8000-000000000002')$$,
  '42501', 'inviter is not a regional admin of this region',
  'a regional admin cannot provision a pilot into another region'
);
select throws_ok(
  $$select public.provision_invited_pilot('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000013', 'bb100000-0000-4000-8000-000000000001')$$,
  '23514', 'only a freshly invited account can become a pilot',
  'an existing account cannot be turned into a pilot (no non-consensual enrollment)'
);
select throws_ok(
  $$select public.provision_invited_pilot('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'bb100000-0000-4000-8000-000000000001')$$,
  '23514', null,
  'an account that already belongs to an organization cannot be provisioned'
);
select is(
  (select count(*)::integer from public.organization_members where user_id = 'b1000000-0000-4000-8000-000000000012'),
  0, 'rejected provisioning attempts leave no membership behind'
);

-- ── Safeguards against deleting real accounts (regression) ─────────────────
-- A duplicate invite once deleted a legitimate, freshly provisioned pilot.
select is(public.account_exists_for_email(' PA-INVITED-1@example.test '), true, 'existing accounts are found case-insensitively');
select is(public.account_exists_for_email('nobody@example.test'), false, 'unknown emails have no account');
select is(
  public.delete_orphaned_pilot_invite('b1000000-0000-4000-8000-000000000011', now() - interval '1 hour'),
  false, 'clean-up never deletes an account that is a member somewhere (the provisioned pilot)'
);
reset role;
select is(
  (select count(*)::integer from auth.users where id = 'b1000000-0000-4000-8000-000000000011'),
  1, 'the provisioned pilot still exists'
);
set local role service_role;
select is(
  public.delete_orphaned_pilot_invite('b1000000-0000-4000-8000-000000000012', now() + interval '1 hour'),
  false, 'clean-up never deletes an account created before this request'
);
select is(
  public.delete_orphaned_pilot_invite('b1000000-0000-4000-8000-000000000012', now() - interval '1 hour'),
  true, 'clean-up removes a fresh, unconfirmed orphan invite'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'b1000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.account_exists_for_email('pa-mitra@example.test')$$,
  '42501', null, 'browser sessions cannot probe whether an email has an account'
);

select * from finish();
rollback;
