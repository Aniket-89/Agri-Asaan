# 0005. Platform audit log

- Status: Accepted
- Date: 2026-11-21

## Context

Platform owners and system admins can read and change every tenant's
organization records (ADR 0001). AGENTS.md requires that cross-tenant access
by platform staff has durable audit logging.

## Decision

- `public.platform_audit_log` is a global, append-only table.
  - No role has `insert`, `update`, or `delete` on it.
  - Rows are written only by `SECURITY DEFINER` functions that
    `authenticated` cannot execute directly.
  - Only active platform owners and system admins can read it.
- **Writes:** triggers on `organizations`, `organization_settings`,
  `organization_features`, `organization_domains`, and
  `organization_members` log every insert, update, and delete made by active
  platform staff. Tenant users' own changes are not platform events and are
  not logged here.
- **Staff changes:** every insert, update, and delete on `platform_staff` is
  logged, including the bootstrap, which runs without an authenticated user.
- **Reads:** Postgres cannot fire triggers on `select`. Platform pages that
  show a tenant's data call `public.log_platform_tenant_access` before
  loading it, and fail closed if the record cannot be written.
- **What gets recorded:** actor, actor's platform role, action, target
  tenant, target table and row, and changed column names. Never values, so
  no personal data is copied into the log.
- `target_tenant_id` has no foreign key, so audit rows survive tenant
  deletion.

## Alternatives considered

- **pgAudit or database log shipping:** more complete (it captures reads),
  but needs hosted-database configuration and a log pipeline. Too much for
  the MVP.
- **Application-level logging only:** rejected. Writes made through the API
  directly, outside the UI, would be missed.

## Consequences

- Reads made by platform staff directly through the REST API, outside the
  platform pages, are not captured. Before production, consider routing
  platform reads through RPCs that log, or adding pgAudit.
- There is no viewer UI yet. Owners and system admins can query the table.
- Tenant-level audit (actions by tenant users) is separate. It comes with
  the booking status history.
