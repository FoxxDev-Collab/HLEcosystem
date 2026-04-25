# Replication and HA

## Two modes

| Mode | What it replicates | Use for |
|---|---|---|
| **Physical streaming** | Raw WAL, byte-for-byte | HA, read replicas, disaster recovery |
| **Logical** | Row-level changes via decoding | Zero-downtime upgrades, CDC, selective replication, cross-version |

## Physical streaming replication

Replays raw WAL on standbys. Exact binary copy. Same major version required.

```conf
# primary postgresql.conf
wal_level = replica           # or 'logical' if you also need logical
max_wal_senders = 10
max_replication_slots = 10
```

```conf
# replica postgresql.conf
hot_standby = on
hot_standby_feedback = on     # prevent query cancellation from VACUUM conflicts
```

### Replication slots

A slot retains WAL the primary would otherwise recycle, ensuring the replica doesn't fall behind fatally. The downside: if a replica disconnects forever, the primary's disk fills with WAL.

```sql
-- Create slot on primary
SELECT pg_create_physical_replication_slot('replica_01');

-- Monitor slot lag
SELECT slot_name, active, pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS lag_bytes
FROM pg_replication_slots;
```

### Synchronous commit levels

| Level | Guarantee | Trade-off |
|---|---|---|
| `off` | Commit before flush | Fastest, risk last second of commits on crash |
| `local` | Local flush only | Default, ignores replicas |
| `remote_write` | Replica received WAL | Replica OS crash could lose |
| `on` | Replica flushed WAL | Standard sync replication |
| `remote_apply` | Replica applied WAL | Strongest, read-after-write on replica |

## Logical replication

Decodes WAL into row-level changes. Primary publishes, subscriber subscribes. Works across major versions.

```sql
-- Publisher
CREATE PUBLICATION my_pub FOR TABLE users, orders, products;

-- Subscriber (can be a different PG major version)
CREATE SUBSCRIPTION my_sub
  CONNECTION 'host=primary dbname=app user=repl password=...'
  PUBLICATION my_pub;
```

### What's new in recent versions

- **PG 15**: row filters (`WHERE` on publication), column lists
- **PG 16**: bidirectional replication (with conflict handling caveats)
- **PG 17**: **failover slots** (`failover=true`), `pg_createsubscriber` (convert physical standby → logical subscriber without resync), `pg_upgrade` preserves logical slots

### pg_createsubscriber — the zero-downtime upgrade tool

PG 17 feature. Take a physical standby, convert it into a logical subscriber without a full data resync. This is the missing piece for major-version upgrades with minimal downtime.

```bash
# On the future-subscriber (physical standby with pg_upgrade target version)
pg_createsubscriber \
  -d app \
  -P "host=primary dbname=app user=repl" \
  -s /path/to/socket \
  -D /path/to/new/data
```

## Connection pooling (not optional)

Each Postgres backend is a ~5–10 MB OS process. Apps must pool.

| Pooler | Language | Notes |
|---|---|---|
| **pgBouncer** | C | Default. Lightweight, single-threaded. 1.21+ supports prepared statements in transaction mode |
| **PgCat** | Rust | Multi-threaded, sharding, ~59k tps |
| **Supavisor** | Elixir | Built for 1M+ connections, Supabase default |
| **AWS RDS Proxy** | AWS-managed | IAM auth, Secrets Manager, watch for pinning |
| **Pgagroal** | C | High-performance |

### Pooling modes

- **Session**: connection assigned for whole client session. Supports LISTEN/NOTIFY, advisory locks, session `SET`. Low pooling ratio.
- **Transaction**: connection assigned per transaction. **Best default for stateless web apps.** High pooling ratio.
- **Statement**: connection per statement. Extreme pooling. Most features break. Almost never the right choice.

### Sizing heuristic

`pool_size ≈ 2 × cores + effective_spindles`. For modern SSD: `2 × cores`. For a 16-vCPU db, start with pool of 32 and tune.

## HA options

### CloudNativePG — Kubernetes default

CNCF Sandbox (Jan 2025), Apache 2.0, most-adopted Postgres K8s operator on GitHub. Uses K8s API directly (no StatefulSet), no Patroni, no etcd. Handles failover, PITR, physical + logical replication, backup to S3.

### Patroni — VM / bare-metal default

Battle-tested. Uses etcd, Consul, or ZooKeeper as the distributed configuration store. REST API for cluster operations.

### Managed

- **AWS Aurora**: 6-copy storage, 4/6 write quorum, 3/6 read quorum, 15–30s failover, up to 15 read replicas sharing one volume
- **AWS RDS Multi-AZ DB cluster**: 2 readable standbys (PG 13.4+), ~35s failover, cheaper than Aurora for many workloads
- **Neon**: Safekeepers (Paxos-replicated WAL across AZs) + Pageservers (S3-backed layer files)

### Decision matrix

| Context | Recommendation |
|---|---|
| K8s, want open source | CloudNativePG |
| VMs, want open source | Patroni |
| AWS, need <1min failover + read scale | Aurora |
| AWS, cost-sensitive, OK with ~35s failover | RDS Multi-AZ DB cluster |
| Need scale-to-zero / branching / preview DBs | Neon |
| Want full BaaS (auth, storage, realtime) | Supabase |

## Sharding

**Citus** — open source, works as an extension. Distributes tables across worker nodes. Now part of Microsoft's managed offering (Azure Cosmos DB for PostgreSQL → being steered toward Azure Database for PostgreSQL Elastic Clusters).

Use Citus only when:
- A single tenant outgrows a node
- Sustained >50k writes/sec need to scale horizontally
- Analytics fan-out across many workers is the bottleneck

Most teams never need Citus. Vertical scaling carries you far on modern hardware (a 32-vCPU / 128 GB RDS instance is ~$2k/month and handles enormous loads).

## Anti-patterns

- **Not monitoring replication lag.** Replicas silently fall behind, reads return stale data, nobody knows until a failover.
- **`hot_standby_feedback=off` on a read replica with long analytics queries.** VACUUM on primary kills replica queries.
- **Running session-mode pooling when you could use transaction mode.** Ties up connections unnecessarily.
- **No slot monitoring.** Dead replica's slot fills primary's disk.
- **Treating replicas as a backup.** They're not — a DROP TABLE replicates instantly. Use PITR backups for backup.
- **Failing over without testing.** Do chaos drills quarterly.
