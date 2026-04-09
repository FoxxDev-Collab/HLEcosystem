# ADR-0005: Household-scoped multi-tenancy

**Status:** Accepted
**Date:** 2025-11-14 (retroactively documented 2026-04-08)
**Deciders:** Jeremiah Price

## Context

HLEcosystem supports multiple households per deployment — a single running instance can serve Alice's family and Bob's family without cross-contamination. "Household" is the fundamental unit of tenancy: transactions, health records, recipes, trips, vehicles — everything belongs to exactly one household.

Multi-tenancy has three standard patterns:

1. **Database per tenant** — maximal isolation, operationally heavy
2. **Schema per tenant** — moderate isolation, moderate overhead
3. **Row-level per tenant** — minimal isolation overhead, isolation is enforced at the application layer by a discriminator column

For a self-hosted family app with typically 1–5 households per deployment, pattern 1 and 2 are over-engineered. We use pattern 3: **row-level tenancy with a `householdId` discriminator**.

This ADR documents that decision and the rules that make it safe.

## Decision

**Every table that contains tenant data has a `householdId` column of type `String`, non-nullable, indexed, and references `family_manager.Household.id` (soft reference — no foreign key across schemas; see [ADR-0001](./0001-single-database-schema-isolation.md)).**

**Every query in every Server Action and every API route must include `WHERE "householdId" = ${currentHouseholdId}` in its filter.** There are no exceptions.

The current household is resolved via a cookie (`xx_household_id`, prefix varies per app) set when the user selects or creates a household. A user may belong to multiple households but operates on one at a time.

```typescript
// Every data query looks like this:
const transactions = await prisma.transaction.findMany({
  where: { householdId, /* ... other filters ... */ },
});

// Every mutation first verifies the target belongs to the household:
const account = await prisma.account.findFirst({
  where: { id: accountId, householdId },
});
if (!account) return; // attempted cross-tenant access
```

## Why not rely on the database to enforce it?

PostgreSQL row-level security (RLS) policies can enforce this at the database layer, and in a multi-tenant SaaS deployment they would be the right choice. We do not currently use RLS for three reasons:

1. **The Prisma client does not set a session variable per request**, so RLS policies cannot key on the current household without non-trivial pgBouncer plumbing or raw session management.
2. **The check is already in application code** — adding RLS creates two sources of truth and invites the "how can this query return nothing?" debugging session.
3. **RLS does not help when `householdId` is missing from a query entirely** — the application bug is still the gap.

We may revisit RLS for production hardening in a future ADR.

## Enforcement

This is the most security-critical rule in the codebase and is reinforced in multiple places:

1. **CLAUDE.md** states explicitly: "Household scoping. Every data query in finance/health/hub MUST include `WHERE "householdId" = ${householdId}`. This is the tenant isolation boundary."
2. **PR template security checklist** requires reviewers to confirm household scoping on every new query.
3. **Threat model (TB-1, Info Disclosure)** identifies developer error as the primary risk and lists mitigations.
4. **The `getCurrentHouseholdId()` helper** is the only sanctioned way to obtain the current household. It returns `null` if the cookie is missing, and every Server Action bails with `redirect("/setup")` when it does.
5. **CodeQL custom queries** (planned) can flag Prisma queries that reference a tenant-scoped model without filtering by `householdId`.

## Consequences

### Positive

- Simple mental model — one column, one filter, one rule
- Queries are fast: `(householdId, ...)` composite indexes are natural
- Backup and restore are trivial — no per-tenant schema ops
- Cross-household data sharing (e.g. FamilyHub's "share a gift idea with another household") is straightforward because both households live in the same tables — we just add an explicit `sharedWithHouseholdId` column and gate reads by membership

### Negative

- **A single forgotten `householdId` filter leaks data.** This is a real risk and has happened once in the repo's history — see the audit fix in the 2026-04-08 security hardening commit, which caught unscoped account balance mutations in `hle-family_finance/app/(app)/transactions/actions.ts`. The fix was to re-verify account ownership before mutating balances.
- **No database-level guarantee.** A compromised DB user, a direct `psql` session, or a Prisma migration bug that bypasses the application layer will see everything.
- **Cross-household admin tooling must be explicit.** An admin viewing statistics across households must call a function that *intentionally* omits the household filter and logs the access. No such function exists today.

## Known incidents

- **2026-04-08** — `createTransactionAction` in `hle-family_finance` updated `Account.currentBalance` by `accountId` alone, without re-verifying that the account belonged to the caller's household. An attacker supplying an arbitrary `accountId` in a form submission could mutate another household's account balance. Fixed by adding a `findFirst({ where: { id: accountId, householdId } })` verification step before the balance mutation. Identified during pre-FOSS-release security audit.

This incident is explicitly documented here because it illustrates exactly the failure mode row-level tenancy is vulnerable to, and future contributors need to internalize it. "The check is obvious" is not a mitigation — the check must be in the code.
