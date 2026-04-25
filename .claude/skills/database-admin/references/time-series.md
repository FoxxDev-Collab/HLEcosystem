# Time Series and Partitioning

## When partitioning matters

- Table exceeds ~100M rows
- Clear time-based retention (e.g. delete > 90 days)
- Queries typically filter on the partition key (usually a timestamp)
- VACUUM times are becoming painful

If none apply, don't partition. The planning overhead isn't worth it.

## Native declarative partitioning (PG 10+)

Range partitioning on time is by far the most common pattern.

```sql
CREATE TABLE events (
  id          uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL,
  event_type  text NOT NULL,
  payload     jsonb NOT NULL,
  PRIMARY KEY (id, created_at)   -- partition key must be in PK
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE events_2026_04 PARTITION OF events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE events_2026_05 PARTITION OF events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Default partition (catches everything else)
CREATE TABLE events_default PARTITION OF events DEFAULT;
```

Partition pruning works both at plan time and execution time (PG 11+).

### pg_partman — don't manage partitions by hand

```sql
CREATE EXTENSION pg_partman;

SELECT partman.create_parent(
  p_parent_table := 'public.events',
  p_control := 'created_at',
  p_interval := '1 month',
  p_premake := 4        -- keep 4 future partitions ready
);

-- Retention: drop partitions older than 12 months
UPDATE partman.part_config
SET retention = '12 months', retention_keep_table = false
WHERE parent_table = 'public.events';
```

Schedule `partman.run_maintenance()` hourly via pg_cron.

## BRIN — the time-series index

Block Range Index stores min/max per block range. On naturally-ordered data (time, append-only log), BRIN is **~1000× smaller than B-tree** and nearly as fast for range scans.

```sql
-- Default: 128 pages per range
CREATE INDEX idx_events_created_brin ON events USING brin (created_at);

-- Tighter range, larger index, more selective
CREATE INDEX idx_events_created_brin ON events USING brin (created_at) WITH (pages_per_range = 32);

-- PG 14+: handles out-of-order data better
CREATE INDEX idx_events_created_brin ON events USING brin (created_at timestamptz_minmax_multi_ops);
```

**BRIN requires physical ordering.** If data is inserted out of order (backfills, concurrent writers), use `minmax_multi` opclass or CLUSTER periodically.

## TimescaleDB / Tiger Data

Drop-in extension. Hypertables are auto-partitioned on time. Adds:

- **Continuous aggregates** — incremental materialized views on hypertables
- **Hypercore** — hybrid row+columnstore with SIMD compression on old chunks
- **Retention and compression policies**
- **Native time-series functions** (time_bucket, gap fill, last/first)

```sql
CREATE EXTENSION timescaledb;

SELECT create_hypertable('events', 'created_at', chunk_time_interval => interval '1 day');

-- Compression policy: compress chunks older than 7 days
ALTER TABLE events SET (timescaledb.compress, timescaledb.compress_segmentby = 'tenant_id');
SELECT add_compression_policy('events', interval '7 days');

-- Retention policy
SELECT add_retention_policy('events', interval '180 days');

-- Continuous aggregate: hourly rollup
CREATE MATERIALIZED VIEW events_hourly WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', created_at) AS bucket,
       tenant_id, event_type, count(*) AS n
FROM events
GROUP BY bucket, tenant_id, event_type;

SELECT add_continuous_aggregate_policy('events_hourly',
  start_offset => interval '3 hours', end_offset => interval '1 hour',
  schedule_interval => interval '30 minutes');
```

### License note

- Core TimescaleDB (hypertables): Apache 2.0
- **Compression, continuous aggregates, retention policies, Hypercore**: Timescale License (source-available, not open source)
- Managed clouds (Azure, AWS RDS) usually only expose the Apache subset. Supabase supports Apache only.
- Rebranded to **Tiger Data** (Oct 2024). Self-hosted is free.

## When native is enough vs when to go Timescale

| Need | Native sufficient | Timescale preferred |
|---|---|---|
| <100M rows, time-based retention | ✓ | — |
| 100M–10B rows, mixed query patterns | Maybe | ✓ |
| Need compressed old data | — | ✓ |
| Incremental aggregates | Manual with triggers | ✓ |
| Managed cloud (RDS/Aurora/Neon) | ✓ (no Timescale) | Self-host or Timescale Cloud |
| CMMC / regulated environments | ✓ | Depends on license review |

## When to leave Postgres entirely

**ClickHouse** for:
- >10 TB hot columnar data
- Sub-second scan queries over billions of rows
- OLAP-only workload, no OLTP

**InfluxDB** for:
- High-cardinality metrics with specialized retention
- Prometheus-style monitoring at scale

Don't leave Postgres until you have a specific, measured pain point.

## Anti-patterns

- **Partitioning before you need it.** Adds planning overhead for modest row counts.
- **BRIN on non-ordered data.** Useless. It'll return huge bitmap ranges that rechecking defeats.
- **Unique constraints that don't include the partition key.** Postgres can't enforce them across partitions.
- **Too many partitions.** >1000 partitions makes planning slow. Increase interval (daily → weekly → monthly).
- **Forgetting to VACUUM default partition.** It catches overflow, silently grows, no one notices.
