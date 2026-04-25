# Anti-Patterns

The ten that cause most production fires, with fixes.

## 1. N+1 queries

ORM fetches a list, then lazy-loads a relation per row.

```
SELECT * FROM orders WHERE user_id = 123;  -- 1 query
-- for each order:
SELECT * FROM order_items WHERE order_id = ?;  -- N queries
```

**Fix**: eager load with JOIN or IN, or use `LATERAL` for correlated per-row queries. In Rails: `includes(:items)`. In SQLAlchemy: `selectinload(Order.items)`. In Drizzle / Prisma: use the relation query syntax.

## 2. Missing index on foreign key columns

Postgres does not auto-create an index on a column that has a FK. A DELETE or UPDATE of the parent then requires a full scan of the child, and takes a lock that blocks concurrent activity.

**Fix**: `CREATE INDEX ON child (parent_id);` on every FK. Audit with:

```sql
SELECT c.conrelid::regclass AS table, a.attname AS column
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND c.conkey[1] = ANY(i.indkey)
  );
```

## 3. `SELECT *` in production

- Locks app code to every schema change
- Blocks Index Only Scans (every column has to be fetched from heap)
- Ships more data than needed over the wire

**Fix**: list columns explicitly. Use code generation (sqlc, Drizzle) to keep the list honest.

## 4. OFFSET pagination on large tables

`SELECT ... OFFSET 10000 LIMIT 20` scans and discards 10,000 rows to return 20. Degrades linearly with page depth.

**Fix**: keyset / cursor pagination.

```sql
-- First page
SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT 20;

-- Next page, using last seen (created_at, id)
SELECT * FROM events
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Index on `(created_at DESC, id DESC)` serves this in O(log n) regardless of page depth.

## 5. Long-running transactions

Every open transaction holds `backend_xmin`, blocking VACUUM from cleaning tuples newer than its start. A forgotten `BEGIN` in a psql session can bloat your tables by gigabytes in hours.

**Watch for**:
- IDE database tools that open long-lived "edit mode" transactions
- Batch jobs that wrap too much in one transaction
- `FOR UPDATE` locks held across user think time

**Fix**: shorten transactions. Break batch jobs into chunks. Monitor:

```sql
SELECT pid, now() - xact_start AS duration, state, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY duration DESC;
```

Set `idle_in_transaction_session_timeout = 60s` to auto-kill stale transactions.

## 6. OR across different columns

```sql
-- Two separate indexes won't both be used here
SELECT * FROM users WHERE email = $1 OR phone = $2;
```

**Fix**: rewrite as `UNION ALL`:

```sql
SELECT * FROM users WHERE email = $1
UNION ALL
SELECT * FROM users WHERE phone = $2 AND email IS DISTINCT FROM $1;
```

Or use a composite index if the OR pattern is frequent.

## 7. Implicit type casts

```sql
-- varchar column compared to integer — cast disables the index
SELECT * FROM users WHERE phone = 5551234567;  -- phone is varchar

-- Timestamp compared to date — depends on function volatility
SELECT * FROM events WHERE date_trunc('day', created_at) = '2026-04-19';
```

**Fix**: match types explicitly. `phone = '5551234567'`. For date filters, use range comparison which stays indexable:

```sql
SELECT * FROM events
WHERE created_at >= '2026-04-19' AND created_at < '2026-04-20';
```

## 8. `IN (subquery)` that should be `EXISTS`

For large subqueries, `EXISTS` can short-circuit where `IN` materializes:

```sql
-- Often slower
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 1000);

-- Often faster
SELECT * FROM users u WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.total > 1000
);
```

The modern planner has closed much of this gap — always check EXPLAIN. But EXISTS is usually the safer default for correlated existence checks.

## 9. Unbounded queries generating temp files

Sort or hash without `work_mem` spills to disk:

```
Sort  (actual rows=10000000 ...) Sort Method: external merge  Disk: 800000kB
```

**Fix**:
- Raise `work_mem` for the session running the query
- Add an index that serves the sort (so no sort needed)
- Limit the result set with WHERE before the sort

## 10. Not monitoring bloat

Autovacuum keeps up with most workloads, but heavy update patterns, failed autovacuum runs, and long transactions cause silent bloat that slowly rots performance.

**Fix**: track bloat, alert when it crosses a threshold (>30% dead tuples or >2× expected size). Use:

```sql
-- Rough bloat check
SELECT schemaname, relname,
       n_dead_tup, n_live_tup,
       round(100 * n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS size
FROM pg_stat_user_tables
WHERE n_live_tup > 10000
ORDER BY dead_pct DESC NULLS LAST LIMIT 20;
```

For precise measurement: `pgstattuple` extension.

## Bonus: ORM-specific traps

**Rails / Active Record**
- `where(...).first` without `order` — nondeterministic
- `includes` auto-switches between JOIN and two-query strategies — check generated SQL
- `update_all` skips callbacks, validations, and timestamps — often what you want for backfills

**Django ORM**
- `Queryset.all()` is lazy, but chaining `len()` + `for` iterates twice
- `select_related` (JOIN) vs `prefetch_related` (2 queries + Python join) — pick deliberately
- `update()` skips signals — same double-edge as Rails

**SQLAlchemy**
- Session-per-request is mandatory; never a global session
- `lazy='joined'` can explode into cartesian products with multiple relations
- Async 2.0 has different semantics for expire/refresh

**Prisma**
- Connection pool defaults are tiny — raise `connection_limit`
- `findMany({ include: ... })` issues separate queries per relation — not always what you want

## The meta-antipattern

**Not reading the plan before optimizing.** Every fix above starts with `EXPLAIN (ANALYZE, BUFFERS)`. If you're proposing index changes, query rewrites, or schema changes without a plan in front of you, you're guessing.
