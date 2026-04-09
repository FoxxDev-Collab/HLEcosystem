# ADR-0001: Single database with schema-level isolation

**Status:** Accepted
**Date:** 2025-11-14 (original decision, retroactively documented 2026-04-08)
**Deciders:** Jeremiah Price

## Context

HLEcosystem is a family of ten purpose-specific Next.js applications — finance, health, home care, meal prep, file server, and so on. They share users, households, and cross-app references (e.g. a finance transaction might reference a family member owned by FamilyHub). We needed a data isolation strategy that:

1. Kept each app's domain model decoupled so teams/contributors could own one app without understanding the others
2. Supported strong tenant isolation for household data
3. Allowed cross-app reads (especially `User` and `Household` lookups) without duplicating state
4. Minimized operational complexity — this is self-hosted software for families, not a SaaS with an SRE team

## Options considered

### Option A — Separate database per app (microservice pattern)

Each app gets its own PostgreSQL database. Cross-app lookups happen via HTTP calls to `family_manager`'s API.

- ✅ Maximum isolation — a bug in one app's migration cannot affect another
- ✅ Apps can scale / shard independently
- ❌ Ten database instances to operate for a self-hosted family deployment
- ❌ Synchronous HTTP lookups on every page load — every app would need to resolve the current user via a network call, increasing latency and blast radius
- ❌ Eventual-consistency headaches for data that needs to reference users (gifts, transactions, health appointments) — referential integrity becomes an application concern
- ❌ Container bloat (ten Postgres containers) and backup complexity

### Option B — Single database, single schema, shared Prisma client

All apps use one Prisma schema. Tables are prefixed (`finance_transaction`, `health_appointment`) to avoid collisions.

- ✅ Trivial cross-table joins
- ✅ Single migration story
- ❌ One schema becomes a god-schema — no domain boundaries
- ❌ Prisma client contains every app's models, slowing type checking and bundle analysis
- ❌ Impossible to tell which app "owns" a table at a glance
- ❌ A broken migration in one app breaks every app

### Option C — Single database, one PostgreSQL schema per app (chosen)

All apps share one PostgreSQL instance and one `foxxlab` database. Each app owns its own PostgreSQL schema (`family_manager`, `family_finance`, `family_health`, ...). Each app has its own `prisma/schema.prisma` pinned to its schema via `?schema=<name>` in the connection string. Cross-schema reads (User and Household lookups) use `prisma.$queryRaw` with tagged-template parameterization.

- ✅ Each app's Prisma client only knows about its own tables — fast type checking, clean separation
- ✅ Single database instance and single backup target for operators
- ✅ Cross-schema reads are explicit in code (`$queryRaw`) and trivially greppable for audit
- ✅ PostgreSQL enforces schema-level permissions — a per-app DB role can be restricted to its own schema (optional hardening for production)
- ✅ Referential integrity within each app's domain is guaranteed
- ❌ Cross-schema foreign keys are not possible — cross-app references are "soft" (stored IDs without FK enforcement)
- ❌ One global DB outage affects all apps — but for a self-hosted family deployment, this is acceptable

## Decision

We use **Option C: single database, one PostgreSQL schema per app.**

- `hle-family_manager` owns the `family_manager` schema, which contains `User`, `Session`, `Household`, and `HouseholdMember`.
- Every other app has its own schema and reads `family_manager` tables via `prisma.$queryRaw` in `lib/users.ts` and `lib/household.ts`.
- The connection string for each app pins the schema: `DATABASE_URL=postgresql://...?schema=family_finance`.
- Cross-schema references are stored as IDs without foreign keys. Applications are responsible for handling the "referenced user was deleted" case.

## Consequences

### Positive

- New contributors can learn one app's schema in isolation.
- Each app can be deployed, rolled back, or paused independently.
- Tenant isolation is enforced by the `householdId` column at the application layer, not by database boundaries — simpler to reason about.
- Backup is one `pg_dump` against one database.
- Prisma's per-app code generation keeps type surfaces manageable.

### Negative / tradeoffs

- Cross-schema reads must use `$queryRaw` — there is no Prisma relation from finance's `Transaction` to `family_manager.User`. Every app reimplements a thin `getUserById()` helper in `lib/users.ts`. This duplication is intentional; see [ADR-0005](./0005-household-scoped-tenancy.md) for why.
- A broken migration in any app can leave the shared database in a mixed state. Mitigated by always testing migrations against a fresh `./hle.sh rebuild`.
- Schema-per-app means a single database user can theoretically query any schema. A production-hardening step is to create per-app database roles with schema-scoped `GRANT`s; this is documented but not enforced in the default compose setup.

## Enforcement

- `CLAUDE.md` states: "One database, seven schemas. Never create a separate database per app."
- CI has no explicit check for this rule, but any attempt to add a new `DATABASE_URL` would appear in PR diff and be caught in review.
- The PR template security checklist requires reviewers to verify household scoping on any new query.
