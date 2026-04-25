# Performance Tuning

## Start here

**Don't tune before measuring.** Turn on `pg_stat_statements` and `auto_explain` first. Changes without data are guesses.

```sql
-- shared_preload_libraries = 'pg_stat_statements,auto_explain' in postgresql.conf, then restart
CREATE EXTENSION pg_stat_statements;

-- auto_explain config
ALTER SYSTEM SET auto_explain.log_min_duration = 500;  -- 500ms
ALTER SYSTEM SET auto_explain.log_analyze = on;
ALTER SYSTEM SET auto_explain.log_buffers = on;
ALTER SYSTEM SET auto_explain.sample_rate = 0.1;       -- 10% of slow queries
SELECT pg_reload_conf();
```

## Memory parameters

| Setting | Recommended start | Notes |
|---|---|---|
| `shared_buffers` | **25% of RAM** | Higher can help; OS cache handles the rest |
| `effective_cache_size` | 50–75% of RAM | Informational — tells planner how much OS cache exists |
| `work_mem` | **16–64 MB** | **Multiplied by connections × parallel workers.** Be careful |
| `maintenance_work_mem` | 1–2 GB | Used by VACUUM, CREATE INDEX, ALTER TABLE |
| `wal_buffers` | 16 MB (usually auto) | -1 = auto-tune to shared_buffers/32 |
| `autovacuum_work_mem` | Match maintenance_work_mem | Separate from maintenance_work_mem |

### work_mem trap

`work_mem` is per-sort/hash-operation, not per-query. A query with 3 sorts + 2 hash joins uses up to 5× work_mem. With parallel workers, multiply again. With 100 connections: potential = `5 × workers × work_mem × 100`.

```sql
-- Per-connection for heavy reports
SET work_mem = '256MB';  -- only for this session
```

## I/O parameters

| Setting | Recommended | Notes |
|---|---|---|
| `random_page_cost` | **1.1** on SSD/NVMe | Default 4 is for spinning rust. Single biggest planner fix |
| `seq_page_cost` | 1.0 | Leave alone |
| `effective_io_concurrency` | **200+** on SSD | Enables prefetch on bitmap scans |
| `checkpoint_timeout` | 15–30 min | Longer = less WAL amplification, longer recovery |
| `max_wal_size` | 8–32 GB | Size so checkpoints are timeout-driven, not size-driven |
| `checkpoint_completion_target` | 0.9 (default) | Spreads checkpoint I/O |

## Parallelism

```conf
max_worker_processes = 16          # total workers available
max_parallel_workers = 8            # workers for parallel query
max_parallel_workers_per_gather = 4 # per query
max_parallel_maintenance_workers = 4 # for CREATE INDEX, VACUUM
```

## Autovacuum

**Defaults are too lax.** A hot table with 1M row churn/day waits forever for the default `autovacuum_vacuum_scale_factor=0.2` (20% of table).

### Global tuning

```conf
autovacuum_max_workers = 6           # match to vCPU count
autovacuum_naptime = 30s             # check tables every 30s
autovacuum_vacuum_cost_limit = 2000  # default 200 — much more aggressive
autovacuum_vacuum_cost_delay = 2ms   # default 2ms in PG 12+
```

### Per-table for hot tables

```sql
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.02,   -- vacuum at 2% churn
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_limit = 4000
);
```

### Emergency vacuum

When a table is bloated:

```sql
-- Check bloat (approximate, install pgstattuple for exact)
SELECT schemaname, relname, n_dead_tup, n_live_tup,
       round(100 * n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC LIMIT 20;

-- VACUUM FULL locks the table. Consider pg_repack/pg_squeeze instead.
VACUUM (VERBOSE, ANALYZE) orders;

-- pg_repack (extension, no AccessExclusive lock)
pg_repack --no-order --table=public.orders mydb
```

## HOT updates and fillfactor

When an UPDATE doesn't change any indexed column and there's room on the page, Postgres does a **HOT (Heap-Only Tuple) update** — no index update needed, less bloat, less WAL.

```sql
-- Leave 20% free per page so updates stay HOT
ALTER TABLE user_sessions SET (fillfactor = 80);
```

Use for update-heavy tables. Not for append-only / insert-heavy (wastes space).

Check HOT update ratio:

```sql
SELECT relname, n_tup_upd, n_tup_hot_upd,
       round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 2) AS hot_pct
FROM pg_stat_user_tables
WHERE n_tup_upd > 1000
ORDER BY n_tup_upd DESC;
```

Aim for >80% HOT on update-heavy tables.

## Cache hit ratio

```sql
SELECT sum(heap_blks_read) AS disk, sum(heap_blks_hit) AS cache,
       round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS hit_pct
FROM pg_statio_user_tables;
```

>99% is healthy. <95% suggests `shared_buffers` too low or working set doesn't fit in RAM.

## PG 18 wins

- **Async I/O** (`io_method = worker` default, `io_workers` tunable) — 2–3× on sequential/bitmap scans
- **`EXPLAIN` shows BUFFERS by default** — no more forgetting the flag
- **B-tree skip scan** — multi-column indexes serve queries that omit the leading low-cardinality column
- **`uuidv7()`** — time-ordered UUIDs eliminate random-insert B-tree bloat

## Anti-patterns

- **Raising `work_mem` globally to solve one report.** Per-session instead.
- **`shared_buffers` > 40% of RAM.** Starves OS cache, Postgres double-buffers anyway.
- **Running without `pg_stat_statements`.** Flying blind.
- **`VACUUM FULL` on a hot table.** Use `pg_repack` or `pg_squeeze` — same effect, no lock.
- **Disabling autovacuum because "it's slow."** Bloat will kill you faster than autovacuum overhead.
- **`random_page_cost = 4` on SSD.** Planner avoids indexes. Fix this first.
