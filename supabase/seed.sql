-- Local development seed. FAKE DATA ONLY: never add real people, phone
-- numbers, farms, or customer details. Applied by `npm run db:reset`.
--
-- Every seeded user signs in with the password: demo-password-123
--
--   owner@agriasaan.test      platform_owner (no organization membership)
--   orgadmin@agriasaan.test   AgriAsaan       organization_admin
--   regional@agriasaan.test   AgriAsaan       regional_admin
--   mitra@agriasaan.test      AgriAsaan       mitra
--   pilot@agriasaan.test      AgriAsaan       pilot
--   farmer@agriasaan.test     AgriAsaan       farmer
--   admin@greenfield.test     Greenfield Agri organization_admin (white-label demo)
--   pilot2@agriasaan.test     AgriAsaan       pilot (South)
--
-- White-label branding demo: http://greenfield.localhost:3000 resolves to the
-- Greenfield brand through its verified domain; http://localhost:3000 shows
-- the platform default brand.

with seed_users (id, email, full_name, phone) as (
  values
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'owner@agriasaan.test', 'Demo Platform Owner', null),
    ('d0000000-0000-4000-8000-000000000002'::uuid, 'orgadmin@agriasaan.test', 'Demo Organization Admin', '910000000102'),
    ('d0000000-0000-4000-8000-000000000003'::uuid, 'regional@agriasaan.test', 'Demo Regional Admin', '910000000103'),
    ('d0000000-0000-4000-8000-000000000004'::uuid, 'mitra@agriasaan.test', 'Demo Mitra', '910000000104'),
    ('d0000000-0000-4000-8000-000000000005'::uuid, 'pilot@agriasaan.test', 'Demo Pilot', '910000000105'),
    ('d0000000-0000-4000-8000-000000000006'::uuid, 'farmer@agriasaan.test', 'Demo Farmer', '910000000106'),
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'admin@greenfield.test', 'Demo Greenfield Admin', '910000000107'),
    ('d0000000-0000-4000-8000-000000000008'::uuid, 'pilot2@agriasaan.test', 'Demo Pilot Two', '910000000108')
),
inserted_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, phone, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, phone,
    extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', full_name),
    timezone('utc', now()), timezone('utc', now()),
    '', '', '', ''
  from seed_users
  returning id, email
)
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
from inserted_users;

insert into public.platform_staff (user_id, role, status, created_by)
values (
  'd0000000-0000-4000-8000-000000000001',
  'platform_owner',
  'active',
  'd0000000-0000-4000-8000-000000000001'
);

insert into public.organizations (id, name, slug, organization_type, created_by)
values
  ('e0000000-0000-4000-8000-000000000001', 'AgriAsaan', 'agriasaan', 'agriasaan', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'Greenfield Agri Services', 'greenfield-agri', 'customer', 'd0000000-0000-4000-8000-000000000001');

insert into public.organization_settings (
  tenant_id, default_locale, timezone, brand_name, brand_primary_color, brand_accent_color, brand_tagline
)
values
  ('e0000000-0000-4000-8000-000000000001', 'hi', 'Asia/Kolkata', 'AgriAsaan', '#14532d', '#75B82A', 'Drone · Crop Monitoring · Farm Services'),
  ('e0000000-0000-4000-8000-000000000002', 'en', 'Asia/Kolkata', 'Greenfield Agri', '#1d4ed8', '#f59e0b', 'Fake demo tenant · Spraying services');

insert into public.organization_domains (tenant_id, hostname, is_primary, is_verified)
values ('e0000000-0000-4000-8000-000000000002', 'greenfield.localhost', true, true);

insert into public.organization_features (tenant_id, feature_key, enabled)
values
  ('e0000000-0000-4000-8000-000000000001', 'drone_spraying', true),
  ('e0000000-0000-4000-8000-000000000001', 'crop_monitoring', true),
  ('e0000000-0000-4000-8000-000000000002', 'drone_spraying', true);

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'organization_admin'),
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'regional_admin'),
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', 'mitra'),
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'pilot'),
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 'farmer'),
  ('e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000007', 'organization_admin'),
  ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008', 'pilot');

-- Territory (fake names and approximate demo coordinates only).
insert into public.regions (id, tenant_id, name)
values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Demo North Region'),
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Demo South Region'),
  ('e1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000002', 'Greenfield Demo Region');

insert into public.villages (id, tenant_id, region_id, name, lgd_code, latitude, longitude)
values
  ('e2000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Demo Village Alpha', '900001', 29.000000, 77.000000),
  ('e2000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Demo Village Beta', '900002', 29.050000, 77.050000),
  ('e2000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'Demo Village Gamma', null, 26.900000, 75.800000),
  ('e2000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', 'Greenfield Demo Village', null, null, null);

-- regional@agriasaan.test covers the North region; mitra@agriasaan.test covers Alpha and Beta.
insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values ('e0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003');

insert into public.mitra_villages (tenant_id, village_id, user_id)
values
  ('e0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004');

-- Crop lists (tenant configuration).
insert into public.tenant_crops (tenant_id, code, name_en, name_hi, sort_order)
select tenant.id, crop.code, crop.name_en, crop.name_hi, crop.sort_order
from (values
  ('e0000000-0000-4000-8000-000000000001'::uuid),
  ('e0000000-0000-4000-8000-000000000002'::uuid)
) as tenant (id)
cross join (values
  ('wheat', 'Wheat', 'गेहूँ', 10),
  ('paddy', 'Paddy', 'धान', 20),
  ('sugarcane', 'Sugarcane', 'गन्ना', 30),
  ('cotton', 'Cotton', 'कपास', 40),
  ('mustard', 'Mustard', 'सरसों', 50),
  ('maize', 'Maize', 'मक्का', 60)
) as crop (code, name_en, name_hi, sort_order);

-- Farmers (fake names; phone numbers are obviously fake 90000xxxxx values).
insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at)
values
  ('e3000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Demo Farmer Ramesh', '9000000101', timezone('utc', now())),
  ('e3000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Demo Farmer Sunita', '9000000102', timezone('utc', now())),
  ('e3000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 'Demo Farmer Mohan', '9000000103', timezone('utc', now())),
  ('e3000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000003', 'Demo Farmer Kavita', '9000000104', timezone('utc', now()));

-- farmer@agriasaan.test is linked to Demo Farmer Ramesh's record.
update public.farmers set profile_id = 'd0000000-0000-4000-8000-000000000006'
where id = 'e3000000-0000-4000-8000-000000000001';

insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
select field.id, 'e0000000-0000-4000-8000-000000000001', field.farmer_id, field.name, crop.id, field.area_acres, field.latitude, field.longitude
from (values
  ('e4000000-0000-4000-8000-000000000001'::uuid, 'e3000000-0000-4000-8000-000000000001'::uuid, 'Canal-side plot', 'wheat', 3.50, 29.002000, 77.003000),
  ('e4000000-0000-4000-8000-000000000002'::uuid, 'e3000000-0000-4000-8000-000000000001'::uuid, 'Home plot', 'mustard', 1.25, 29.004000, 76.998000),
  ('e4000000-0000-4000-8000-000000000003'::uuid, 'e3000000-0000-4000-8000-000000000002'::uuid, 'East plot', 'paddy', 2.00, 29.006000, 77.006000),
  ('e4000000-0000-4000-8000-000000000004'::uuid, 'e3000000-0000-4000-8000-000000000003'::uuid, 'Main plot', 'sugarcane', 5.00, 29.052000, 77.051000),
  ('e4000000-0000-4000-8000-000000000005'::uuid, 'e3000000-0000-4000-8000-000000000004'::uuid, 'Well plot', 'cotton', 4.00, 26.902000, 75.802000)
) as field (id, farmer_id, name, crop_code, area_acres, latitude, longitude)
join public.tenant_crops as crop
  on crop.tenant_id = 'e0000000-0000-4000-8000-000000000001' and crop.code = field.crop_code;

-- Demo boundary for satellite work: a ~3.5-acre square centred on the pin,
-- matching the field's recorded area (checked with ST_Area).
update public.fields
set boundary = 'SRID=4326;POLYGON((77.00239 29.00146, 77.00361 29.00146, 77.00361 29.00254, 77.00239 29.00254, 77.00239 29.00146))'
where id = 'e4000000-0000-4000-8000-000000000001';

-- Fleet: demo drones (fake UIDs) and pilot profiles.
insert into public.drones (tenant_id, uid, model, home_region_id, status)
values
  ('e0000000-0000-4000-8000-000000000001', 'UA-DEMO-N01', 'Demo Sprayer 10L', 'e1000000-0000-4000-8000-000000000001', 'active'),
  ('e0000000-0000-4000-8000-000000000001', 'UA-DEMO-N02', 'Demo Sprayer 16L', 'e1000000-0000-4000-8000-000000000001', 'maintenance'),
  ('e0000000-0000-4000-8000-000000000001', 'UA-DEMO-S01', 'Demo Sprayer 10L', 'e1000000-0000-4000-8000-000000000002', 'active'),
  ('e0000000-0000-4000-8000-000000000002', 'GF-DEMO-01', 'Demo Sprayer 10L', 'e1000000-0000-4000-8000-000000000003', 'active');

-- New pilots are created by regional admins through the invite flow; these
-- two seeded pilots stand in for already-onboarded ones.
insert into public.pilot_profiles (tenant_id, user_id, home_region_id, license_number)
values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', 'RPC-DEMO-0001'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008', 'e1000000-0000-4000-8000-000000000002', 'RPC-DEMO-0002');

-- Bookings (seed runs without a session, so rows are written directly, with
-- the same snapshots and history create_booking would produce).
insert into public.bookings (id, tenant_id, farmer_id, village_id, region_id, status, preferred_date, notes, total_acres, requested_by)
values
  ('e6000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001',
   'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'requested', current_date + 3,
   'Fake demo note: aphid spotted on wheat.', 4.75, 'd0000000-0000-4000-8000-000000000004'),
  ('e6000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003',
   'e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'confirmed', current_date + 5,
   null, 5.00, 'd0000000-0000-4000-8000-000000000004'),
  ('e6000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000004',
   'e2000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000002', 'requested', current_date + 7,
   null, 4.00, 'd0000000-0000-4000-8000-000000000002');

insert into public.booking_fields (tenant_id, booking_id, farmer_id, field_id, field_name, crop_code, crop_name_en, crop_name_hi, area_acres, latitude, longitude)
select booking.tenant_id, booking.id, booking.farmer_id, field.id, field.name, crop.code, crop.name_en, crop.name_hi, field.area_acres, field.latitude, field.longitude
from (values
  ('e6000000-0000-4000-8000-000000000001'::uuid, 'e4000000-0000-4000-8000-000000000001'::uuid),
  ('e6000000-0000-4000-8000-000000000001'::uuid, 'e4000000-0000-4000-8000-000000000002'::uuid),
  ('e6000000-0000-4000-8000-000000000002'::uuid, 'e4000000-0000-4000-8000-000000000004'::uuid),
  ('e6000000-0000-4000-8000-000000000003'::uuid, 'e4000000-0000-4000-8000-000000000005'::uuid)
) as line (booking_id, field_id)
join public.bookings as booking on booking.id = line.booking_id
join public.fields as field on field.id = line.field_id
join public.tenant_crops as crop on crop.id = field.crop_id;

insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason, actor_id)
values
  ('e0000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001', null, 'requested', null, 'd0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000002', null, 'requested', null, 'd0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000002', 'requested', 'confirmed', null, 'd0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000003', null, 'requested', null, 'd0000000-0000-4000-8000-000000000002');

-- Spraying slots (organization configuration, local time Asia/Kolkata).
insert into public.spray_slots (id, tenant_id, name_en, name_hi, start_time, end_time, sort_order)
values
  ('e7000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Early morning', 'सुबह जल्दी', '06:00', '09:00', 10),
  ('e7000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Morning', 'सुबह', '09:00', '11:30', 20),
  ('e7000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Evening', 'शाम', '16:00', '18:30', 30),
  ('e7000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000002', 'Early morning', 'सुबह जल्दी', '06:00', '09:00', 10),
  ('e7000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000002', 'Evening', 'शाम', '16:00', '18:30', 30);

-- Seeded bookings hold the early-morning slot.
update public.bookings set slot_id = 'e7000000-0000-4000-8000-000000000001'
where tenant_id = 'e0000000-0000-4000-8000-000000000001';
