# Local Supabase Development

## Prerequisites

- Docker Desktop or a running Docker daemon
- Node.js and npm
- Repository dependencies installed with `npm install`

The Supabase CLI is installed as an npm development dependency. Use npm scripts or `npx supabase` from the repository root.

## Start and verify

```bash
npm run db:start
npm run db:status
npm run db:reset
```

The default local endpoints are:

- API: `http://127.0.0.1:54321`
- Database: `127.0.0.1:54322`
- Studio: `http://127.0.0.1:54323`
- Local email testing: `http://127.0.0.1:54324`

Run `npm run db:status` to obtain the local publishable key. Do not copy it into documentation or commit it. The CLI also prints service-role and secret credentials; keep those out of logs, source files, and browser variables.

## Connect Next.js

Create `apps/web/.env.local` with local public values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-local-key
```

The legacy variable `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted for compatibility.

The Next.js integration is in:

- `apps/web/src/lib/supabase/client.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/src/lib/supabase/middleware.ts`
- `apps/web/src/proxy.ts`

The browser and proxy use only public keys. Server-only Supabase operations must use the server client and must never expose a service-role key to the browser.

## Migrations

Create a forward-only migration:

```bash
npx supabase migration new migration_name
```

Apply migrations and seed data:

```bash
npm run db:reset
```

Inspect migration status:

```bash
npx supabase migration list
```

Do not edit migrations that have already been applied. PostGIS is enabled by `supabase/migrations/20261118180523_enable_postgis.sql`.

## Seed data

`npm run db:reset` loads `supabase/seed.sql`. It contains fake data only:

- a platform owner (`owner@agriasaan.test`)
- the AgriAsaan organization with one user per role (`orgadmin@`, `regional@`, `mitra@`, `pilot@`, `farmer@agriasaan.test`)
- a white-label demo organization, Greenfield Agri (`admin@greenfield.test`), with the verified domain `greenfield.localhost`
- territory: AgriAsaan has a North and a South demo region. `regional@agriasaan.test` covers North, and `mitra@agriasaan.test` covers Demo Village Alpha and Beta. South has no regional admin, so the regional admin sees it read-only.

All seeded users sign in with `demo-password-123`. Open `http://greenfield.localhost:3000` to see tenant branding, and `http://localhost:3000` for the platform default. Both redirect to a language prefix (`/en` or `/hi`).

Never seed real farmer, customer, or production information.

## Generated types

After changing a migration, regenerate and commit the database types:

```bash
npm run db:types
```

CI fails when `apps/web/src/types/database.types.ts` is out of date.

## Stop and reset

```bash
npm run db:stop
npm run db:reset
```

Stopping Supabase leaves Docker data until the stack is started again or explicitly removed through Docker/Supabase commands.

## Troubleshooting

- If Docker is unavailable, start Docker Desktop or the Docker daemon before `npm run db:start`.
- If containers fail to download or start, inspect `docker ps -a` and `npm run db:status`.
- If Next.js cannot connect, verify `apps/web/.env.local` and restart the Next.js development server.
- If migrations fail, run `npm run db:reset` from the repository root and inspect the migration SQL.
- Do not use `supabase db push` or `supabase link` for local development. They can affect remote projects.
