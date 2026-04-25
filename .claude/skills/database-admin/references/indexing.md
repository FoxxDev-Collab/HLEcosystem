# Indexing

## Index type selection

| Index | Use for | Avoid for | Notes |
|---|---|---|---|
| **B-tree** (default) | Equality, range, ORDER BY, `LIKE 'prefix%'`, UNIQUE | Very wide rows, text search | Only index supporting UNIQUE, INCLUDE, and PKs |
| **GIN** | JSONB, arrays, tsvector, pg_trgm | Update-heavy scalar columns | Slow writes; tune `fastupdate`, `gin_pending_list_limit` |
| **GiST** | geometry/PostGIS, ranges, FTS, trigrams, kNN, exclusion constraints | Equality-only workloads | Lossy for FTS → rechecks, slower reads than GIN |
| **BRIN** | Large, physically-ordered tables (logs, telemetry, append-only) | Randomly-ordered data | ~1000× smaller than B-tree; `minmax_multi` (PG 14+) tolerates some disorder |
| **SP-GiST** | Quadtree, k-d tree, radix tree, non-balanced data | General-purpose | Niche but cheap |
| **Hash** | Equality only, no sort/range | Almost anything else | WAL-logged since PG 10 but rarely beats B-tree |
| **Bloom** | Multi-column AND equality filters | Anything with range/order | Probabilistic, requires `CREATE EXTENSION bloom` |

## Decision flow

```
Is the data ordered on disk? (time series, logs, append-only)
  → BRIN on the ordered column (use minmax_multi if bulk-loaded)

Is it JSONB, array, or full text?
  → GIN (or GiST if you also need kNN / geometry)

Is it geometry, range, or need exclusion constraints?
  → GiST

Default: B-tree
```

## Patterns that matter more than index type

### Partial indexes

Index only the rows that matter. Use for soft-delete-still-in-the-schema, hot status flags, or enforcing conditional uniqueness.

```sql
-- Fast lookup of active users only
CREATE INDEX idx_users_active ON users (email) WHERE deleted_at IS NULL;

-- Unique email only among live rows
CREATE UNIQUE INDEX users_email_live_uniq
  ON users (email) WHERE deleted_at IS NULL;
```

### Expression indexes

Neutralize casts and function calls that would otherwise disable index use.

```sql
CREATE INDEX idx_users_lower_email ON users (lower(email));
-- Query must match exactly: WHERE lower(email) = lower($1)
```

### Covering indexes (PG 11+)

`INCLUDE` carries extra columns in the leaf without making them part of the key. Enables Index Only Scans without polluting the sort order.

```sql
CREATE INDEX idx_orders_user_created
  ON orders (user_id, created_at DESC)
  INCLUDE (status, total_cents);
```

### Multi-column indexes and skip scan

Pre-PG 18: leading column must appear with `=` for the index to help.
PG 18+: **B-tree skip scan** lets queries that omit the leading column still use the index, if the leading column has few distinct values.

```sql
-- Works in PG 18 even without tenant_id filter, if tenant_id has low cardinality
CREATE INDEX ON events (tenant_id, created_at);
SELECT * FROM events WHERE created_at > now() - interval '1 day';
```

### Foreign keys — always index them

Postgres does **not** auto-create an index on the referencing column. Missing FK indexes cause lock amplification on DELETE/UPDATE of the parent and slow joins. Check every time.

```sql
-- parent has UNIQUE/PK. You add the FK. Then:
CREATE INDEX ON child (parent_id);
```

## Index maintenance

- `REINDEX CONCURRENTLY` (PG 12+) rebuilds without long locks. Use for bloated indexes.
- `CREATE INDEX CONCURRENTLY` is the default for production. Skips the AccessExclusive lock but takes longer and can fail — check with `\d` for `INVALID` indexes and drop/recreate.
- `DROP INDEX CONCURRENTLY` is also a thing. Use it.

## Diagnosing indexes

```sql
-- Unused indexes (over time; needs pg_stat_statements history)
SELECT schemaname, relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Index bloat (rough estimate — use pgstattuple for precision)
SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC LIMIT 20;

-- Duplicate indexes (same column set, different names)
SELECT pg_size_pretty(sum(pg_relation_size(idx))::bigint) AS size,
       (array_agg(idx))[1] AS idx1, (array_agg(idx))[2] AS idx2
FROM (
  SELECT indexrelid::regclass AS idx,
         (indrelid::text || E'\n' || indclass::text || E'\n' || indkey::text || E'\n' ||
          coalesce(indexprs::text,'')||E'\n' || coalesce(indpred::text,'')) AS key
  FROM pg_index
) sub GROUP BY key HAVING count(*) > 1 ORDER BY sum(pg_relation_size(idx)) DESC;
```

## Red flags

- More than ~8–10 indexes on a hot write table — you're probably duplicating coverage.
- Indexes on low-cardinality columns (boolean, 3-state enum) without being partial.
- Any index that appears in no `pg_stat_user_indexes` scan count after a week.
- UUIDv4 primary keys on high-append tables — random inserts cause B-tree bloat. UUIDv7 fixes this.
