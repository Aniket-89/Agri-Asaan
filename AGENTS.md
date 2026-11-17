AGENTS.md

Instructions for AI coding agents (Claude Code and others) and human
contributors working in this repository.

Read this file before making changes. If it conflicts with a direct
instruction from the owner, follow the owner and flag the conflict. Do
not silently change product scope, architecture, security rules, or the
technology stack.

────────

1. Project overview

AgriAsaan is a multi-tenant platform for managed agricultural drone
spraying.

Farmers can book spray jobs for their fields directly or through a
village-level Mitra. A Regional Admin reviews requests, confirms
them, and assigns a Pilot and a company Drone (identified by
UID) for a date and slot. The pilot completes the job and records actual
acres.

The product is intended to be white-labelled and licensed to other
clients. Tenant data must remain isolated, while client-specific
branding and operational settings should be configurable rather than
hardcoded.

A lean, team-only satellite crop-monitoring module based on Sentinel-2
imagery and per-field NDVI/crop-health metrics is part of the MVP.
Keep the first implementation narrow and demonstrable. Farmer-facing
crop reports and AI diagnosis remain out of scope. Offline-first data
entry and synchronization are also out of scope for the MVP.

Current status: MVP / demo phase. Target a working end-to-end demo
in approximately one week. Optimise for a secure, maintainable
foundation without building infrastructure or features that have not
been justified.

────────

2. Roles, scope, and access rules

Application roles

────────

Role                                Scope

────────

farmer                            Own profile, fields, and bookings
within the tenant

mitra                             Farmers and bookings in assigned
village clusters; can register
farmers/fields and book on their
behalf

admin                             Regional Admin; manages requests,
pilots, and assignments within
assigned regions

pilot                             Only jobs assigned to that pilot

super_admin                       Tenant-wide administrator; manages that tenant’s regions, villages, users, pilots, and drones

super_admin is tenant-scoped, not automatically a platform-wide
administrator. If platform operations later require cross-tenant access,
introduce a separate platform_admin concept with explicit approval,
separate authorization rules, and audit logging. Never give a tenant
administrator implicit cross-tenant access.

The rule that matters most

Access control lives in the database (Postgres Row-Level Security),
not only in the UI or API code. A bug in a screen or route must never
expose another tenant’s data.

RLS is the final enforcement layer. Server-side authorization must also
be checked before executing operations, but application checks do not
replace RLS.

────────

3. Technology stack

The stack is decided. Change it only through an Architecture Decision
Record (ADR) and owner approval.

• Web app: Next.js App Router + TypeScript (strict: true),
installable PWA, Hindi and English, mobile-first, designed for
low-end Android devices and weak networks.
• Data and auth: Supabase (Postgres, Auth, Storage), production
project in Mumbai (ap-south-1). Prefer standard PostgreSQL and
portable interfaces; avoid unnecessary proprietary lock-in.
• Primary application backend: Next.js Route Handlers and Server
Actions, using a modular-monolith architecture. Next.js is the
primary backend for ordinary product functionality.
• Specialised processing: Python worker for satellite/geospatial
processing and other justified computational or asynchronous
workloads. Use FastAPI only if the worker needs an HTTP API; a
scheduled or queue-driven worker does not require FastAPI merely for
the sake of using it.
• Satellite data (MVP): Sentinel-2 from public STAC catalogs such
as Microsoft Planetary Computer or AWS Earth Search. Do not use
Google Earth Engine because of its commercial licensing constraints
for this product. Keep the MVP feature team-only and limit it to a
demonstrable per-field NDVI/crop-health workflow.
• Package manager: npm with npm workspaces. Commit
package-lock.json; use npm ci in CI and Docker builds. Do not
mix in pnpm or yarn.
• Containers: Python worker runs in Docker. Local development uses
Docker Compose for the worker and Redis when the queue is
introduced. Images must be reproducible: pinned base image tag,
non-root user, multi-stage build where useful, .dockerignore, and
no secrets baked into images.
• Redis: Introduce only when a real queue, rate-limiting, or
caching requirement exists. It is never a source of truth. Anything
that must survive lives in Postgres. Local Redis comes from Docker
Compose; hosted environments use managed Redis (for example
Upstash). Vercel functions must never depend on a developer’s local
Redis. Any production connection must use a managed TLS-enabled URL.
• Hosting: Web app deploys to Vercel. Supabase hosts data and
auth. Python worker image runs on a suitable container host (for
example Fly.io, Render, Railway, or a small VPS); record the final
choice in an ADR before production use.
• Auth: Phone OTP for farmers, Mitras, and pilots. Supabase Auth
is the initial provider unless an ADR approves a change. Google
sign-in may be added for staff if required. Application data must
not depend on provider-specific user identifiers beyond the stable
profiles.id relationship. Keep provider-specific logic inside the
auth integration module.
• Maps: MapLibre with OpenStreetMap-compatible tiles. No paid map
provider in the MVP.

Do not add FastAPI, Redis, Celery, Kubernetes, Kafka, or additional
services before a concrete requirement exists. Do not assume a
particular Python queue library; select one in an ADR when queue
implementation is needed.

────────

4. Repository layout

Keep this monorepo layout unless an ADR approved by the owner explains
why it must change.

apps/
  web/                       # Next.js PWA and primary application backend
    src/
      app/                   # routes, layouts, pages, route handlers
      modules/               # domain modules and business logic
      components/            # reusable UI
      lib/                   # infrastructure, auth, config, utilities
      types/
services/
  worker/                    # Python processing worker (MVP satellite work)
    app/
    tests/
    Dockerfile
    pyproject.toml
packages/
  shared/                    # shared TypeScript types, Zod schemas, constants
supabase/
  migrations/                # forward-only SQL migrations
  tests/                     # pgTAP tests (RLS, constraints, RPCs)
  seed.sql                   # fake local/demo data only
docs/
  architecture.md            # system overview and diagrams
  data-model.md              # ERD and table notes
  adr/                       # Architecture Decision Records
  runbook.md                 # deploy, rollback, backups, incident steps
  product/                   # briefs and feature documents
.github/
  workflows/                 # CI/CD
  pull_request_template.md
docker-compose.yml
.env.example
.dockerignore
package.json                 # npm workspaces
AGENTS.md
CLAUDE.md
README.md
CHANGELOG.md

Do not create empty directories or placeholder modules solely to match
this tree. Add files as real functionality is implemented. Keep
Python-only dependencies inside services/worker; keep shared
TypeScript dependencies in the relevant npm workspace.

────────

5. Architecture principles

1. Multi-tenant from day one. Every tenant-owned table has a
non-null tenant_id referencing organizations.id. Not every table
is tenant-owned: global lookup tables, platform-level metadata, and
user identity/profile records may be global where justified.
Document each global table and how it is safely related to tenant
membership. Never create a tenant-owned record without tenant
ownership.
2. Tenant isolation is enforced in Postgres. RLS policies must
check tenant membership and then apply role, region, or village
scope. Use composite foreign keys or equivalent database constraints
where practical so a row cannot reference another tenant’s row.
3. Configuration, not code, for client differences. Branding,
supported languages, crop lists, status labels, units, and pricing
rules belong in tenant configuration or well-defined configuration
tables/JSON. Do not hardcode client names or tenant-specific
behaviour into application logic.
4. Critical state changes use database transactions. Booking and
job transitions must go through narrowly scoped database RPCs or
another explicitly justified transactional mechanism:
create_booking, set_booking_status, assign_job, start_job,
and complete_job. Each operation validates the caller, tenant,
scope, allowed transition, and required fields, and writes status
history in the same transaction.
5. Invariants are enforced by the database. No double-booking of a
pilot or drone. Enforce conflicts with database constraints/indexes
or an exclusion constraint appropriate to the actual time-slot
model. Do not rely only on an application-level pre-check. If
bookings have durations or can overlap across slots, model
timestamps/ranges and enforce actual overlap rather than assuming
slot labels cannot overlap.
6. Idempotent writes. Important create operations should support
safe retries. Use client-generated UUIDs / idempotency keys where
appropriate, including for future offline synchronization. This does
not mean implementing offline sync in the MVP.
7. Snapshots, not mutable references, for history. Booking lines
copy relevant crop and acreage details at booking time so later
field edits do not rewrite historical booking facts.
8. Audit important actions. Status history is append-only. Record
actor, tenant, timestamp, previous state, new state, and reason
where applicable. Avoid logging sensitive farmer data.
9. Auth provider is replaceable. Do not scatter provider-specific
calls throughout the codebase. Wrap auth integration in one module
and use profiles.id as the application identity.
10. Keep business rules out of RLS where they become complex. RLS
answers whether a user may access a row. Workflow rules belong in
transactional RPCs and domain services.
11. Design for growth, build for current demand. Add indexes for
foreign keys and frequently used RLS predicates. Do not build
microservices or a tenant-management UI until needed. Redis is never
a source of truth.
12. Geospatial readiness. Enable PostGIS when the database
foundation is created. A GPS pin alone is not sufficient for
meaningful field-level satellite analysis. For the MVP satellite
demonstration, support a field boundary polygon (drawn, imported, or
supplied through a controlled seed/demo workflow). Store geometry
using an appropriate PostGIS type and SRID.
13. Satellite time series are append-only. Store one
observation/metric record per field, acquisition/observation time,
source, and processing version. Do not overwrite historical
observations. Keep imagery/raster files in object storage, not as
large blobs in Postgres. The MVP may use a narrow observation history
and limited processing cadence.
14. Privacy. Farmer data is personal data. Collect only necessary
information and consent where required. Never log phone numbers,
exact GPS pins, authentication tokens, or sensitive farmer data in
plain application logs.
15. Offline is deferred. MVP may use ordinary browser/service-worker
caching for the app shell and static assets if useful, but must not
promise offline writes, offline drafts, or synchronization. Preserve
clean seams for future idempotent sync without implementing the sync
engine now.

────────

6. Next.js application architecture

Pattern: modular monolith. Next.js is the primary application
backend. Do not introduce a separate general-purpose FastAPI backend for
ordinary application functionality.

6.1 Separation of concerns

• app/: routing, layouts, pages, Server Actions, and HTTP Route
Handlers. Keep these thin.
• modules/: domain-specific business logic, schemas, permissions,
and persistence.
• components/: reusable UI components. Components must not own
business rules.
• lib/: infrastructure integrations, shared utilities, environment
validation, auth, and configuration.
• packages/shared/: shared TypeScript types, Zod schemas, and
constants where genuinely reused.

6.2 Domain modules

Organise code by business domain, for example:

modules/
  bookings/
    booking.schema.ts
    booking.service.ts
    booking.repository.ts
    booking.types.ts
    booking.permissions.ts
    index.ts
  farmers/
  fields/
  organizations/
  regions/
  villages/
  pilots/
  drones/

Responsibilities:

• schema: validates external input with Zod.
• service: implements domain rules and workflows.
• repository: owns database queries and persistence.
• types: domain-specific types when not already shared.
• permissions: domain-specific authorization helpers.

Do not create files or abstractions that add no value to a small module.
Avoid giant service files.

6.3 Dependency direction

Use this general dependency direction:

UI / Route Handlers / Server Actions
                 |
                 v
           Domain Services
                 |
                 v
             Repositories
                 |
                 v
          Supabase / Postgres

Domain services must not depend on React components. Keep
request-specific Next.js APIs at the application boundary; pass the
required authenticated context into services explicitly.

6.4 Server Components, Server Actions, and Route Handlers

• Use Server Components by default.
• Use Client Components only where browser-side interaction requires
them.
• Use Server Actions for mutations initiated by the Next.js UI.
• Use Route Handlers for public APIs, external integrations, webhooks,
and independently consumable HTTP endpoints.
• Both Server Actions and Route Handlers must call the same domain
service layer. Never duplicate business rules between them.
• Validate all external input with Zod, including route params, query
params, form data, request bodies, and environment variables.
• Do not use Server Actions as a substitute for a domain/service
layer.

6.5 Database access and authorization

• Use the Supabase SSR client for authenticated server-side
operations.
• Use browser Supabase clients only for operations explicitly
permitted by RLS.
• Keep database queries inside repositories or clearly defined
infrastructure modules.
• Derive tenant and user context from the authenticated session and
verified membership, not from arbitrary client-supplied tenant_id
values.
• A client may submit a tenant selector when a user belongs to
multiple tenants, but the server must verify membership before using
it.
• Check authorization server-side before performing privileged
operations; RLS remains the final enforcement layer.
• Never use the service-role/secret key for ordinary user-scoped
requests.
• Never expose service-role or secret keys to the browser.
• Do not bypass or weaken RLS to make a feature work.

6.6 Maintainability

• Prefer explicit, domain-oriented code over generic abstractions.
• Avoid unnecessary repository interfaces, dependency-injection
frameworks, and generic CRUD frameworks.
• Do not create microservices for internal domain modules.
• Extract a service only when there is a concrete independent
deployment, scaling, security, or ownership requirement.
• Keep business logic out of pages, layouts, and UI components.

────────

7. Database rules

• Schema changes happen only through new migration files in
supabase/migrations/.
• Never edit a migration that has already been applied or merged; add
a new migration.
• Every tenant-owned table must have tenant_id, a primary key,
timestamps as appropriate, RLS enabled, policies in the same
migration, and indexes on foreign keys and common policy predicates.
• Global tables must be explicitly identified and documented; do not
add a meaningless tenant_id to every global identity or lookup
table.
• Never grant anon access to application tables unless a specific
public read use case is documented, reviewed, and restricted to
non-sensitive data.
• The service-role key is server-only and never reaches the browser or
repository.
• SECURITY DEFINER functions must set a safe search_path (prefer
an empty path with fully qualified object names, or explicitly set
search_path = public where appropriate), validate caller identity
and tenant/region scope, and have execute permissions revoked from
PUBLIC/anon unless explicitly required.
• Every RLS policy and security-sensitive RPC needs pgTAP tests
proving allowed and denied access, including cross-tenant attempts.
• Add constraints for tenant-consistent foreign keys wherever
practical.
• After schema changes, regenerate typed clients
(supabase gen types) and commit the result.
• Local development uses Supabase CLI (supabase start). Demo and
production are separate Supabase projects. Never test against
production.
• Enable PostGIS through a migration and document spatial columns,
SRIDs, and indexes.

────────

8. Coding standards

TypeScript

• TypeScript strict mode is required.
• Do not use any without a specific explanatory comment.
• Use Zod for external inputs and environment variables.
• Prefer Server Components by default.
• Do not put business rules in UI components.
• Avoid unnecessary client-side JavaScript.
• Keep shared types and schemas in packages/shared only when more
than one workspace needs them.

Python worker

• Use type hints.
• Use ruff and ruff format; use mypy for the worker.
• Keep NDVI and geospatial calculations in pure, testable functions
where practical.
• Unit tests for mathematical processing must not require network
access.
• Retry external calls with bounded backoff and clear failure states.
• Handle cloudy, empty, unavailable, or invalid scenes without
crashing the entire worker.
• Pin Python dependencies in services/worker using a lock file or
hashed requirements.

General

• Small functions, explicit names, no dead code, and no commented-out
code.
• Handle errors at boundaries. Never silently swallow exceptions.
• No secrets, real farmer data, or real phone numbers in code, tests,
fixtures, logs, or screenshots. Use obviously fake data.
• All user-facing strings go through i18n (Hindi and English).
• Use accessible controls, large tap targets, and readable contrast.
• Test on a throttled network and a small viewport.
• Prefer existing platform capabilities and dependencies. Justify new
dependencies in the PR.

────────

9. Testing

Testing is required, but the MVP test setup should remain proportionate.
Do not build an elaborate test infrastructure before the application
exists.

────────

Layer                   Tool                    What to cover

────────

Unit (TS)               Vitest                  Pure logic, Zod
schemas,
status-transition
helpers, i18n key
checks

Component               Vitest + Testing        Important forms and
Library                 role-based rendering

Database                pgTAP via               RLS, constraints, RPC
supabase test db      rules, cross-tenant
denials, double-booking

Worker                  pytest                  NDVI maths, cloud
masking, field-to-pixel
sampling, empty/cloudy
scenes using local
fixtures

E2E                     Playwright              Core demo flow and
critical authorization
paths

Offline sync            Later                   Add only when offline write/sync work is approved

Rules:

• Every bug fix should start with a failing test that reproduces it
when practical.
• Every new RLS policy or security-sensitive RPC ships with pgTAP
tests in the same change.
• Tests must be deterministic: no real network, no real SMS, and no
dependence on the current date without a fixed clock.
• Tests requiring Redis use a throwaway local/container Redis
instance, never a shared or hosted instance.
• Queue jobs must be idempotent and covered by retry tests when the
queue is introduced.
• Aim for at least 80% coverage on shared logic and worker maths as
the project matures. Do not chase a global coverage number at the
expense of shipping; all RLS policies and security-sensitive RPCs
must have deny-case tests.
• Do not mark work done until relevant tests have actually been run
and pass. If a test could not be run, state that plainly.

────────

10. CI/CD

MVP baseline

Start with a small, reliable CI pipeline:

1. Install dependencies with npm ci.
2. Run ESLint and Prettier checks.
3. Run TypeScript typecheck.
4. Run Vitest.
5. Apply Supabase migrations and run database tests for schema/RLS
changes.
6. Run the Next.js production build.

Add Playwright E2E tests for the critical demo flow as soon as the flow
is stable.

Later hardening

As the product approaches production, add:

• GitHub Actions jobs for worker linting, typing, and tests.
• Docker image build and vulnerability scanning.
• Dependency and secret scanning (for example Dependabot and
gitleaks).
• Full Playwright E2E suite with traces on failure.
• Generated-type drift checks.
• Preview deployments for pull requests.
• Protected demo and production environments with approvals.
• Worker image publishing and rollout.
• Backup verification and migration rollback procedures.

Deployment conventions

• Web deploys use Vercel.
• Keep demo and production Supabase projects separate.
• Never deploy migrations to production without an explicit
release/approval process and a verified backup.
• Store secrets in GitHub Environments or the relevant hosting
provider’s secret manager.
• Use least-privilege CI permissions, pin GitHub Actions versions, and
never echo secrets.
• A red main is fixed or reverted before unrelated work continues.

Do not implement a complex deployment pipeline before the MVP foundation
is working.

────────

11. Branching and Git workflow

• main should remain deployable and protected when the repository
hosting workflow is established.
• Use short-lived branches named by type:
  • feat/<scope>-<short-desc>
  • fix/<scope>-<desc>
  • chore/<desc>
  • docs/<desc>
  • refactor/<desc>
  • test/<desc>
• Example: feat/booking-multi-field.
• Keep one concern per branch and changes reviewable.
• Use squash merges where supported; PR title becomes the commit
message.
• Use Conventional Commits:
  • feat(booking): allow multi-field requests
  • fix(rls): hide farmers outside mitra villages
• Types: feat, fix, docs, test, refactor, perf, chore,
ci, build.
• Breaking changes use ! and a BREAKING CHANGE: footer.
• Releases use vMAJOR.MINOR.PATCH tags from main.
• Never force-push to main, rewrite shared history, or push directly
to main.
• Never commit as the agent unless the owner explicitly asks.

For solo development, self-review using the PR checklist is acceptable.

────────

12. Environments and configuration

Environment   Purpose            Data

────────

local       Development        Fake seed data
demo        Stakeholder demo   Fake or anonymised data only
prod        Real farmers       Real data, backups enabled

• Validate environment variables with Zod at startup.
• Keep .env.example current; real .env* files are git-ignored.
• Never prefix server-only keys (service role, Redis URL, Vercel
token) with NEXT_PUBLIC_.
• The service-role key must never be exposed to the browser.
• A demo role-switcher is permitted only when
NEXT_PUBLIC_DEMO_MODE=true; it must be impossible to enable in
production through deployment configuration.
• .env.example should list all required variables with fake
placeholder values.
• docker compose up should bring up the worker and Redis only when
the worker/queue is part of the current development scope. Supabase
runs separately via its CLI.

────────

13. Product scope guard

MVP — build now

• Mobile-first Next.js PWA.
• Hindi and English foundations.
• Phone OTP authentication.
• Tenant-aware user profiles and role-based access.
• Organization/tenant foundation and tenant isolation.
• Regions, villages, and Mitra village-cluster assignment.
• Farmer registration and search.
• Field registration with crop, acreage, and GPS pin (manual
adjustment).
• Multi-field booking by farmer or Mitra.
• Preferred date and booking status history.
• Regional Admin inbox and confirmation.
• Pilot and drone assignment with database-enforced conflict
prevention.
• Pilot start/complete workflow and actual acres.
• Admin verification.
• Basic audit trail.
• Per-tenant branding configuration foundation.
• Lean, team-only satellite crop monitoring using Sentinel-2, with a
demonstrable per-field NDVI/crop-health workflow. Clearly show
observation date, source, cloud/quality limitations, and data
freshness; do not present estimates as definitive diagnoses.
• Working end-to-end demo with fake or anonymised data.

Explicitly out of scope for MVP

• Offline drafts, offline writes, and offline synchronization.
• Farmer-facing crop reports.
• AI crop diagnosis.
• Advanced field-boundary editing, bulk boundary import, and boundary refinement. The minimum field polygon capability needed for the MVP satellite workflow is in scope.
• Subscriptions and subscription payments.
• Detailed finance and cost tracking.
• Drone owner/leasing management.
• Push and WhatsApp automation.
• Native mobile applications.
• Full tenant self-service management UI.

V1 and later

• Advanced field-boundary drawing, bulk import, and boundary refinement.
• Expanded Sentinel-2 ingestion, historical per-field crop-health
trends, and additional vegetation metrics beyond the MVP workflow.
• Farmer-facing crop reports and subscriptions, only when explicitly
scoped.
• Expanded background processing, scheduling, and operational
monitoring.
• Offline-first workflows and synchronization with conflict
resolution.
• Tenant subscriptions, advanced reporting, and other capabilities
when validated.

Do not pull V1 or later features into the MVP without the owner’s
explicit instruction.

────────

14. Documentation

Keep documentation in step with code.

• README.md: what the product is, prerequisites, local setup, tests,
and deployment.
• docs/architecture.md: components, data flow, trust boundaries, and
diagrams.
• docs/data-model.md: ERD and notes on tables, tenant ownership, and
policies.
• docs/adr/NNNN-title.md: one concise record per significant
decision, including context, decision, alternatives, and
consequences.
• docs/runbook.md: deploy, rollback, backup/restore, key rotation,
and common incidents.
• docs/product/: product briefs and feature scope.
• CHANGELOG.md: user-visible changes per release.

An ADR is required for stack changes, tenancy model changes, auth
provider changes, worker hosting, queue selection, and significant new
dependencies.

A change affecting behaviour, schema, configuration, or deployment is
incomplete without the corresponding documentation update.

────────

15. Definition of done

Copy this checklist into each relevant PR or change description.

☐ Works locally for each affected role, including at least one
role that must be denied.
☐ Tests added/updated and passing (unit, database, and E2E as
relevant).
☐ Lint, typecheck, and production build pass.
☐ Schema changes use new migrations; RLS is enabled; indexes and
tenant-consistent constraints are added where needed.
☐ Generated database types are up to date.
☐ No secrets, real farmer data, or debug logging remain.
☐ User-facing strings are translated (Hindi and English).
☐ Usable on a small screen and slow network.
☐ Docs, ADR, and changelog updated if needed.
☐ Preview/demo deployment checked when deployment is part of the
change.

────────

16. How AI agents should work in this repository

1. Understand before changing. Read this file and relevant source
files, migrations, and docs first. Do not assume a table, function,
or environment variable exists; inspect the repository.
2. Plan non-trivial work. For changes touching schema, RLS, auth,
tenancy, money, or more than three files, present a short plan and
list files to be changed before editing.
3. Small, reviewable changes. Implement one concern at a time. Do
not refactor unrelated code in a feature change.
4. Do not silently make architecture decisions. If a task requires
changing the stack, tenancy model, auth provider, service
boundaries, or data ownership, explain the options and ask for owner
approval. Record approved significant decisions in an ADR.
5. Run it. Execute relevant tests, linters, typecheck, and build
before saying work is complete. Report actual results. If something
could not be run, say so.
6. Never edit applied migrations, disable or loosen RLS to make
something work, commit secrets, use the service-role key in client
code, push to main, rewrite shared Git history, or delete data
without explicit confirmation.
7. Ask when it matters. If ambiguity affects the data model, tenant
isolation, access rules, privacy, money, or product scope, ask
before building. For low-risk presentation details, use sensible
defaults.
8. Security-sensitive changes are explicit. Call out changes to
RLS, RPCs, auth, tenant isolation, and privileged operations at the
top of the PR/change summary.
9. No invented completion. Never claim tests passed, deployments
succeeded, or migrations were applied unless the command was
actually run and its result observed.
10. Leave the repository better. Update docs and tests alongside
code. Record follow-up work as actionable issues rather than
ownerless TODO comments.

Initial project instruction

When the repository is first created, do not immediately implement all
product features.

First review this document, identify contradictions or missing
decisions, and propose: - final repository structure; - tenant/global
entity model; - initial ERD; - RLS and authorization strategy; - Next.js
module boundaries; - MVP/V1 scope split; - local development and test
commands.

Wait for owner approval before implementing the initial database schema
or changing architectural decisions.

────────

17. Commands

Keep this section accurate and update it whenever the scaffold or
tooling changes. Commands may be added as the relevant tooling is
introduced; do not require commands for services that do not yet exist.

# Install JavaScript dependencies
npm ci

# Start local Supabase (Docker is required)
supabase start

# Apply migrations and seed local database
supabase db reset

# Run the Next.js app
npm run dev

# Static checks
npm run lint
npm run typecheck

# Unit/component tests
npm test

# Database tests
supabase test db

# Production build
npm run build

# Start worker/Redis only after those services are introduced
docker compose up -d

Worker, Playwright, Vercel, and deployment commands must be added here
when their scripts and configuration actually exist. Never leave
placeholder commands that do not work.