# Analytics in Postgres

## Three levels

| Level | Tool | Use when |
|---|---|---|
| In-query aggregates | Window functions, CTEs | Ad-hoc reporting, dashboards <100ms |
| Materialized views | Native `CREATE MATERIALIZED VIEW` | Precomputed snapshots, refresh on schedule |
| OLAP in-database | `pg_duckdb`, `pg_mooncake` | Parquet/Iceberg on S3, columnar analytics |
| Separate warehouse | Snowflake, BigQuery, ClickHouse, Databricks | Petabyte scale, shared governance |

## Materialized views done right

Standard view: query runs every time. Materialized view: result stored on disk, refreshed on demand.

```sql
CREATE MATERIALIZED VIEW mv_tenant_daily_stats AS
SELECT tenant_id,
       date_trunc('day', created_at) AS day,
       count(*) AS event_count,
       count(DISTINCT user_id) AS unique_users
FROM events
GROUP BY tenant_id, day
WITH DATA;

-- CRITICAL: unique index enables CONCURRENTLY refresh
CREATE UNIQUE INDEX ON mv_tenant_daily_stats (tenant_id, day);

-- Refresh without locking readers
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_daily_stats;
```

**`REFRESH ... CONCURRENTLY` requires a unique index.** Without it, the refresh takes an AccessExclusive lock and blocks all reads.

Schedule refresh via pg_cron:

```sql
SELECT cron.schedule('refresh-daily-stats', '*/15 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_daily_stats $$);
```

### Limitations of native materialized views

- **Not incremental.** Every refresh re-runs the whole query. For 100M-row source tables this hurts.
- **No auto-refresh on source changes.** Trigger-based freshness is possible but rarely worth building.
- For incremental, use **Timescale continuous aggregates** (if on Timescale) or build a rollup table with triggers/cron.

## Window functions

Underused. Most "group by and compare to previous row" problems want window functions.

```sql
-- Running total
SELECT user_id, created_at, amount_cents,
       sum(amount_cents) OVER (PARTITION BY user_id ORDER BY created_at) AS running_total
FROM orders;

-- Rank within group
SELECT tenant_id, product_id, revenue,
       rank() OVER (PARTITION BY tenant_id ORDER BY revenue DESC) AS r
FROM product_revenue;

-- Compare to previous
SELECT day, visits,
       visits - lag(visits) OVER (ORDER BY day) AS day_over_day
FROM daily_visits;
```

## CTEs — note the behavior change

Pre-PG 12: CTEs were always a materialization fence (forced to run separately).
PG 12+: CTEs are inlined by default if used once. Use `MATERIALIZED` hint to force the old behavior.

```sql
WITH recent AS MATERIALIZED (       -- force materialization
  SELECT * FROM events WHERE created_at > now() - interval '1 day'
)
SELECT ... FROM recent ...;
```

Most of the time you want inlining. Force materialization only when:
- The CTE is expensive and referenced multiple times
- You need to break up planner mis-estimation
- The CTE has side effects (data-modifying)

## Columnar / OLAP in-database

### pg_duckdb — DuckDB embedded

Vectorized execution over Parquet/Iceberg/Delta on S3/GCS. Active, production-ready.

```sql
CREATE EXTENSION pg_duckdb;

-- Query Parquet directly on S3
SELECT count(*) FROM read_parquet('s3://my-bucket/events/*.parquet')
WHERE event_type = 'click';

-- Create DuckDB-execution table
CREATE TABLE events_columnar () WITH (columnstore = true);
```

### pg_mooncake — lakehouse in Postgres

Mirrors Postgres tables into Iceberg/Delta via logical replication, queries through DuckDB. Gets you a lakehouse without leaving Postgres.

### Archived / unmaintained (do not start new projects here)

- `pg_analytics` (ParadeDB) — archived March 2025
- `columnar` (Hydra fork) — unmaintained

They converged on DuckDB.

## When to leave Postgres

- **>1 TB hot columnar workloads** with sub-second scan requirements
- **Petabyte-scale** analytics across many sources
- **Shared governance** across many analysts / tools
- **Dbt-centric teams** with heavy DAG orchestration

Even then, a common pattern is "Postgres for OLTP, CDC into warehouse for analytics" — not replacement.

## Anti-patterns

- **Running heavy aggregates in production OLTP connection pool.** Dedicate a read replica or analytics connection pool.
- **Refreshing a materialized view without CONCURRENTLY** on a production read path.
- **Building reports off `SELECT *` views** — the view can't be reused by the planner because every column is materialized.
- **Treating Postgres as a warehouse at 1 TB** without measuring first — with good indexes, partitioning, and `pg_duckdb`, it may still be fine.
