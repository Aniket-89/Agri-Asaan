# AgriAsaan

AgriAsaan is a multi-tenant managed agricultural drone-spraying platform.

## Monorepo

- `apps/web` — Next.js App Router application (`@agri/web`)
- `packages/shared` — reusable TypeScript types, Zod schemas, and constants (`@agri/shared`)
- `services/worker` — independent Python satellite worker when introduced
- `supabase` — local PostgreSQL, migrations, seed, and database tests

The repository uses one root `package-lock.json` and npm workspaces.

## Prerequisites

- Node.js and npm
- Docker Desktop or the Docker daemon
- npm dependencies installed from the repository root

## Install

```bash
npm install
```

## Local Supabase

```bash
npm run db:start
npm run db:reset
npm run db:status
```

Configure `apps/web/.env.local` with the local values reported by `npm run db:status`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-local-key
```

The publishable key is safe for browser use. Never place `SUPABASE_SERVICE_ROLE_KEY` or `sb_secret_*` values in browser code or `NEXT_PUBLIC_*` variables.

Additional database documentation is in `docs/database/local-development.md`, the data model in `docs/data-model.md`, and architecture decisions in `docs/adr/`.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It redirects to `/en` or `/hi` based on your last choice or your browser language. Translations live in `apps/web/src/lib/i18n/dictionaries/` (see `docs/adr/0006-i18n-locale-routing.md`).

## Shared package

```ts
import { SUPPORTED_LOCALES, supportedLocaleSchema } from "@agri/shared";
```

## Checks and build

```bash
npm run format:check  # Prettier (npm run format to fix)
npm run typecheck   # generates Next.js route types, then runs tsc
npm run lint
npm test            # Vitest
npm run db:test     # pgTAP (local Supabase must be running)
npm run build
npm run start
```

CI (`.github/workflows/ci.yml`) runs all of these, plus a generated-type drift check, on every pull request.

## Demo data

`npm run db:reset` seeds fake users for every role. See `docs/database/local-development.md` for the logins and the white-label demo domain.

## Database commands

```bash
npx supabase migration new migration_name
npm run db:reset
npm run db:types        # regenerate apps/web/src/types/database.types.ts
npx supabase migration list
npm run db:status
npm run db:stop
```

Do not run `supabase db push` or link this local project to a remote project in the MVP setup.

## Vercel deployment

- **Root Directory:** repository root (`.`)
- **Install Command:** `npm ci`
- **Build Command:** `npm run build`
- **Framework Preset:** Next.js
- **Output Directory:** leave at the Next.js default (`.next`)

Do not set `apps/web` as the Vercel Root Directory. Configure hosted Supabase public URL/key variables for the deployed environment only. Keep service-role credentials server-only.
