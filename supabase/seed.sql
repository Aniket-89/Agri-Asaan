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
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'admin@greenfield.test', 'Demo Greenfield Admin', '910000000107')
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
  ('e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000007', 'organization_admin');
