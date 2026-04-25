# Query Diagnosis

## The one command you need

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) <query>;
```

PG 18 includes BUFFERS by default; earlier versions require the flag. Always include it — without buffer counts, you're guessing at I/O.

## Reading a plan

```
Gather  (cost=1000.00..11000.00 rows=100 width=123) (actual time=5.12..45.23 rows=87 loops=1)
  Workers Planned: 2
  Workers Launched: 2
  ->  Parallel Seq Scan on orders  (cost=0.00..10000.00 rows=42 width=123)
        (actual time=0.50..12.45 rows=29 loops=3)
        Filter: (status = 'pending'::text)
        Rows Removed by Filter: 1,000,000
        Buffers: shared hit=45 read=12000
```

Key fields:
- **cost**: planner's estimate. Abstract units. Only useful for comparing plans.
- **rows (estimated vs actual)**: the estimate. If off by >10×, stats are wrong or predicates are hard.
- **actual time**: wall clock. First number is startup, second is total per loop.
- **loops**: how many times this node ran. Multiply by per-loop time for total.
- **Buffers: shared hit/read**: cache hits vs disk reads.
- **Rows Removed by Filter**: rows scanned and thrown away. High number = missing index.

## Red flags by symptom

### "Seq Scan on huge_table"

Missing index, or planner chose seq scan because:
- Table is small (<1000 rows) — correct choice, ignore
- Query returns >5–10% of table — seq scan can be correct
- Stats are stale — run `ANALYZE huge_table`
- Predicate uses a non-indexed function: `WHERE lower(email) = $1` without expression index
- Implicit cast disabled the index: `WHERE varchar_col = 123` (int literal)

### "Rows Removed by Filter" > 10,000

Scanning rows only to throw them away. Either:
- Add an index on the filter column
- Make existing index partial with the filter predicate
- Add an expression index if filter is a function call

### "Sort Method: external merge Disk: XXXXkB"

Sort spilled to disk. Raise `work_mem` for this query or this session.

### "Hash Batches: N (originally 1)"

Hash join spilled to disk. Same fix — raise `work_mem`.

### "Heap Fetches" high on Index Only Scan

Visibility map not up to date. Run `VACUUM` on the table. Fixes Index Only Scans that degraded to regular Index Scans.

### Rows estimate off by >10x

```
(estimated rows=100) (actual rows=1,000,000)
```

Planner has bad stats. Try:
1. `ANALYZE the_table` — refresh stats
2. Raise `default_statistics_target = 500` (from default 100) globally or per-column
3. For correlated predicates, create `CREATE STATISTICS` multivariate stats (PG 10+)

### Nested Loop where Hash Join would be better

Usually means row-count underestimate. Same fixes as above.

### Parallel workers not firing

- Table too small (`min_parallel_table_scan_size`, default 8MB)
- `max_parallel_workers_per_gather = 0` disabled
- Query uses parallel-unsafe functions (PL/pgSQL without `PARALLEL SAFE`)

## pg_stat_statements — your first stop

```sql
-- Slowest queries by total time
SELECT substring(query, 1, 80) AS query,
       calls,
       round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       round(max_exec_time::numeric, 2) AS max_ms,
       rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Queries that eat the most I/O
SELECT substring(query, 1, 80), calls,
       round(blk_read_time::numeric + blk_write_time::numeric, 2) AS io_ms,
       shared_blks_read, shared_blks_hit
FROM pg_stat_statements
WHERE blk_read_time + blk_write_time > 0
ORDER BY io_ms DESC LIMIT 20;

-- Reset stats after a deploy to measure change
SELECT pg_stat_statements_reset();
```

## Currently running queries

```sql
-- Active queries >5s old
SELECT pid, now() - query_start AS runtime, state, wait_event_type, wait_event,
       substring(query, 1, 100) AS query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '5 seconds'
ORDER BY runtime DESC;

-- Kill a runaway query
SELECT pg_cancel_backend(12345);   -- graceful
SELECT pg_terminate_backend(12345); -- force
```

## Locks

```sql
-- Who's blocking who
SELECT blocked.pid AS blocked_pid, blocked.query AS blocked_query,
       blocking.pid AS blocking_pid, blocking.query AS blocking_query,
       blocked.wait_event_type, blocked.wait_event
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.wait_event_type = 'Lock';
```

## EXPLAIN tool integration

Visualize plans:
- **explain.dalibo.com** — paste plan, get annotated visualization
- **explain.depesz.com** — highlights slow nodes
- **pgMustard** — commercial, very thorough

## Anti-patterns

- **`EXPLAIN` without `ANALYZE`.** That's just the plan, not reality. Always ANALYZE unless you're afraid to run the query.
- **`EXPLAIN ANALYZE` of a DELETE/UPDATE in production.** It really runs. Wrap in `BEGIN; EXPLAIN ANALYZE ...; ROLLBACK;`.
- **Optimizing based on cost numbers.** Cost is an estimate. Only actual time matters.
- **Ignoring "loops".** A 0.1ms node with 1M loops is 100 seconds.
- **Reading plans top-down.** They execute bottom-up. Child nodes run before parent.
