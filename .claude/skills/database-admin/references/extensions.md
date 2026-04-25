# Extensions Catalog

## The must-know list

| Extension | Purpose | RDS | Neon | Supabase | Self-host |
|---|---|---|---|---|---|
| **pg_stat_statements** | Query performance stats | ✓ | ✓ | ✓ | ✓ |
| **pgcrypto** | Column-level encryption, random UUIDs | ✓ | ✓ | ✓ | ✓ |
| **pg_trgm** | Trigram fuzzy/ILIKE acceleration | ✓ | ✓ | ✓ | ✓ |
| **pgaudit** | Session and object audit logging | ✓ | ? | ✓ | ✓ |
| **pgvector** | Vector similarity search | ✓ | ✓ | ✓ | ✓ |
| **postgis** | Geospatial | ✓ | ✓ | ✓ | ✓ |
| **pg_cron** | Scheduled SQL jobs | ✓ | ✓ | ✓ | ✓ |
| **hstore** | Key-value (superseded by jsonb) | ✓ | ✓ | ✓ | ✓ |
| **citext** | Case-insensitive text | ✓ | ✓ | ✓ | ✓ |
| **unaccent** | Strip accents for search | ✓ | ✓ | ✓ | ✓ |
| **uuid-ossp** | UUID generation (PG 18 has native uuidv7) | ✓ | ✓ | ✓ | ✓ |

## Specialized

| Extension | Purpose | Notes |
|---|---|---|
| **timescaledb** | Time-series hypertables | Apache + TSL split; managed support varies |
| **pg_partman** | Declarative partition management | Run with pg_cron for maintenance |
| **pg_graphql** | GraphQL API from schema | Supabase-native; Rust extension |
| **pgvectorscale** | StreamingDiskANN, better vector scale | Requires pgvector; self-host or Timescale |
| **vectorchord** | Alternative vector engine, 100× faster builds | TensorChord; newer |
| **pg_search** | BM25 full-text (ParadeDB) | Self-host; Neon deprecated Mar 2026; not on RDS |
| **pg_duckdb** | Embedded DuckDB for OLAP | Parquet/Iceberg on S3 from Postgres |
| **pg_mooncake** | Lakehouse — Iceberg/Delta mirror via replication | Newer, ambitious |
| **citus** | Sharding / distributed tables | Self-host or Azure Cosmos DB for PostgreSQL |
| **pg_net** | Async HTTP from SQL | Supabase-native |
| **pg_jsonschema** | JSON Schema validation | Supabase-native |
| **pglogical** | Enhanced logical replication | Older; native logical is usually enough now |
| **hypopg** | Hypothetical indexes | Test index impact without building it |
| **pg_hint_plan** | Plan hints | Last-resort planner override |
| **pg_stat_monitor** | Bucketed superset of pg_stat_statements | Percona; on RDS |
| **pgmq** | SQS-like message queue | Tembo; ~30k msg/s |

## Install pattern

```sql
-- Check what's available
SELECT * FROM pg_available_extensions ORDER BY name;

-- Check what's installed
SELECT * FROM pg_extension;

-- Install
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update to latest version
ALTER EXTENSION pg_trgm UPDATE;
```

Most managed services restrict which extensions you can install. Self-hosted has no restriction beyond what's compiled for your version.

## Extension hygiene

- Install extensions in a dedicated schema (`extensions`) to keep `public` clean
- Check versions after every major Postgres upgrade — some require recompilation
- Monitor CVEs on installed extensions (pgvector 0.8.2 patched CVE-2026-3172, for example)
- Don't install extensions you don't use — each one is attack surface

```sql
-- Dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION pg_trgm WITH SCHEMA extensions;
ALTER DATABASE mydb SET search_path = public, extensions;
```

## Deciding whether to add an extension

Questions in order:

1. **Does native Postgres do this?** Usually yes, with a less-shiny implementation.
2. **Is the extension maintained?** Check last commit, releases, GitHub issues.
3. **Is it available on my deployment target?** RDS / Neon / Supabase have allowlists.
4. **What's the security track record?** CVEs, maintainer responsiveness.
5. **What breaks if I can't use it anymore?** Replacement cost.

If all five check out, install. Otherwise either use native or pick a different tool.
