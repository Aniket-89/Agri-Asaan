begin;

create extension if not exists pgtap;

select plan(6);

set local role anon;
select is(
  (select count(*)::integer from public.geo_districts where state_code = 9),
  75, 'anyone can read the districts of Uttar Pradesh'
);
select is(
  (select name from public.geo_subdistricts where code = 764),
  'Mathura', 'tehsils carry their LGD code and name'
);
select is(
  (select count(*)::integer from public.geo_subdistricts where name like '%*%'),
  0, 'LGD footnote markers are removed from names'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000001';
select throws_ok(
  $$insert into public.geo_districts (code, state_code, name) values (999999, 9, 'Fake District')$$,
  '42501', null, 'signed-in users cannot add places'
);
select throws_ok(
  $$update public.geo_subdistricts set name = 'Renamed' where code = 764$$,
  '42501', null, 'signed-in users cannot rename places'
);
select throws_ok(
  $$select public.region_for_subdistrict('00000000-0000-4000-8000-00000000000a', 764)$$,
  '42501', null, 'region lookup is internal to the database'
);

select * from finish();
rollback;
