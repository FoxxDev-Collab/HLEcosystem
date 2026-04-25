# Stack: Neon

## What Neon is

Serverless Postgres with **separated compute and storage**. Compute scales to zero. Storage is pageserver + safekeepers backed by S3.

Owned by Databricks (acquired May 2025, ~$1B), being folded into "Lakebase Database."

## What makes Neon actually different

### Copy-on-write branching

Instant database branches — per-PR preview DBs in seconds, zero storage cost until divergence.

```bash
# Via CLI
neon branches create --name feature-xyz
# Get a connection string for the new branch
```

**Primary use case**: dev / staging / preview environments. Each PR gets a branch with real production data (after sanitization).

### Scale to zero

Compute suspends when idle. Cold start 300–800 ms. Storage cost continues ($0.35/GB-month after Aug 2025 price reform, -80%).

**Good for**: spiky workloads, dev environments, low-traffic internal apps.
**Bad for**: anything with steady traffic — the suspend/resume cycle adds latency and complexity. Just turn off auto-suspend for production.

## Extensions available

Curated list. Common ones work (pgvector, pg_trgm, pg_stat_statements, pgcrypto, postgis, pg_cron). Check the Neon docs for current list.

**Notable exclusions / deprecations**:
- pg_search (ParadeDB) — **deprecated for new projects March 2026**
- TimescaleDB — apache subset only
- Some superuser-requiring extensions

## Connection patterns

Neon gives you two endpoints:

- **Pooled** (PgBouncer-backed, ends in `-pooler.neon.tech`): use for serverless functions, edge, high connection counts. Transaction-mode.
- **Direct**: use for long sessions, LISTEN/NOTIFY, prepared statements (pre-PgBouncer 1.21).

Most apps should use the pooled endpoint.

## HTTP-based queries

Neon has a `neon-serverless` driver that uses HTTP instead of TCP — works from Cloudflare Workers, Vercel Edge, etc. where TCP is hard.

```js
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const users = await sql`SELECT * FROM users WHERE tenant_id = ${tenantId}`;
```

## Pricing gotchas

- **CU-hours** (Compute Units × time). 1 CU = 1 vCPU + 4 GB RAM.
- Storage: $0.35/GB-month after Aug 2025 reform
- **HIPAA eligibility, SOC 2 Type 2, Private Link, 30-day PITR**: moved into Scale plan at $0.222/CU-hr
- Branches share storage until they diverge (COW) — a 1 TB branch is near-free until you write to it

## When Neon is a bad fit

- **Sustained high TPS OLTP**: the safekeeper hop adds latency vs local storage
- **Exotic extensions** requiring superuser
- **FedRAMP High / IL5 workloads**: check current compliance posture; may not fit
- **You want predictable fixed-cost pricing**: CU-hours can surprise

## When Neon is a great fit

- **Development and preview environments** — branching is genuinely transformative
- **Multi-tenant SaaS where each tenant gets a DB** — create/destroy is cheap
- **Spiky or intermittent workloads** — scale-to-zero saves real money
- **Edge / serverless apps** — HTTP driver + pooled endpoint

## Operational notes

- Azure regions are being sunset (April 2026). New projects should be on AWS or GCP.
- Can't SSH to the server. Can't install arbitrary extensions. Can't tune every GUC.
- Standard Postgres client tooling (psql, pg_dump, pgBackRest with --no-ssh mode) works.
- For backup beyond Neon's 30-day PITR, run your own `pg_dump` to a separate S3 bucket on a schedule.

## Decision vs RDS

| Consideration | Choose Neon | Choose RDS |
|---|---|---|
| Dev branching matters | ✓ | — |
| Scale-to-zero matters | ✓ | — |
| Edge / serverless deployment | ✓ | — |
| Sustained 1000+ QPS | — | ✓ |
| Need RDS Proxy / AWS ecosystem glue | — | ✓ |
| CMMC / FedRAMP | Verify compliance attestations | Generally easier |
| Predictable costs | — | ✓ |
