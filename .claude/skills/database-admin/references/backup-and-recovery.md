# Backup and Recovery

## The only rule that matters

**Untested backups are not backups.** Automate a weekly restore to an isolated environment. Measure RTO (time to restore) and RPO (data loss window). Document both.

## Tool selection

| Tool | Best for | Skip if |
|---|---|---|
| **pg_dump** | Small DBs (<100 GB), logical exports, dev snapshots | Production recovery of large DBs |
| **pg_basebackup** | Simple physical backup, occasional snapshots | Need PITR, cross-version, S3 |
| **pgBackRest** | Production. Parallel, encrypted, S3/GCS/Azure | — |
| **Barman** | pgBackRest alternative, similar feature set | — |
| **wal-g** | Lightweight Go-based alternative | Want mature tooling |

**Default to pgBackRest.** It's the de facto standard for production Postgres backup.

## pg_dump — logical

Produces a SQL or custom-format file. Works across major versions (PG 13 → PG 18). Slow on large DBs.

```bash
# Custom format (compressed, parallel restore)
pg_dump -Fc -j 4 -d mydb -f mydb.dump

# Restore
pg_restore -d mydb -j 4 mydb.dump

# SQL format (human-readable, portable)
pg_dump -Fp -d mydb > mydb.sql
```

**Use cases**: schema migration dev copies, cross-version exports, small DB archival. Not production recovery.

## pg_basebackup — physical

Streams a full physical copy of the cluster. Foundation for PITR setups.

```bash
pg_basebackup -D /backup/base -Ft -z -P -U replicator -h primary
```

**PG 17+ supports incremental**:

```bash
# Full backup
pg_basebackup -D /backup/full -U replicator

# Incremental against manifest from previous backup
pg_basebackup -D /backup/incr1 --incremental=/backup/full/backup_manifest

# Combine for restore
pg_combinebackup /backup/full /backup/incr1 -o /backup/restored
```

Zero dependency, but pgBackRest's block-level incrementals are still superior at scale.

## pgBackRest — production standard

Parallel full/diff/incremental. Encrypted. S3/GCS/Azure native. Block-level dedup. Backup-from-standby. Manifest validation. Archive retention policies.

### Minimal setup

```conf
# /etc/pgbackrest.conf
[global]
repo1-path=/var/lib/pgbackrest
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=<random-256-bit-key>
repo1-retention-full=2
repo1-retention-diff=7
process-max=4
start-fast=y
compress-type=lz4

[mydb]
pg1-path=/var/lib/postgresql/18/data
pg1-port=5432
```

```conf
# postgresql.conf
archive_mode = on
archive_command = 'pgbackrest --stanza=mydb archive-push %p'
```

### Common commands

```bash
# One-time stanza creation
pgbackrest --stanza=mydb stanza-create

# Full backup
pgbackrest --stanza=mydb --type=full backup

# Incremental (default type)
pgbackrest --stanza=mydb backup

# Verify backup integrity
pgbackrest --stanza=mydb check

# Restore to a point in time
pgbackrest --stanza=mydb --type=time --target="2026-04-19 12:00:00" restore
```

### S3-backed repo (production pattern)

```conf
repo1-type=s3
repo1-s3-bucket=myorg-postgres-backups
repo1-s3-region=us-east-1
repo1-s3-endpoint=s3.amazonaws.com
repo1-s3-key=<iam-key>
repo1-s3-key-secret=<iam-secret>
```

For CMMC / NIST 800-171: use an S3 bucket with KMS encryption (SSE-KMS), Object Lock for tamper-resistance, and a bucket policy that denies deletes without MFA.

## WAL archiving

PITR requires continuous WAL archiving. `archive_command` (pre-PG 15) or `archive_library` (PG 15+) hooks every WAL segment to your backup tool.

```conf
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=mydb archive-push %p'
archive_timeout = 300   # force a WAL switch every 5 min for RPO
```

`archive_timeout` balances RPO vs WAL volume. 300s = 5-minute worst-case data loss. For tighter RPO, lower it, but watch WAL volume.

## Point-in-time recovery

Required ingredients:
1. A base backup (pgBackRest `full` or `pg_basebackup`)
2. All WAL files since that backup, archived

To restore to 2026-04-19 12:00:00 UTC:

```bash
pgbackrest --stanza=mydb --type=time --target="2026-04-19 12:00:00 UTC" restore
# Edit postgresql.auto.conf to add recovery_target_time if needed
# Start Postgres — it replays WAL to the target and stops
```

## Managed backup

- **RDS / Aurora**: automated snapshots + PITR via continuous backup. Configure retention (7–35 days). Backup to a different region for DR.
- **Neon**: continuous backup to S3 via pageservers. 30-day PITR on Scale plan.
- **Supabase**: daily snapshots, PITR on Pro+ plans.

Even on managed, **take your own logical dumps for critical data** and store them in a bucket you control. Managed providers have had incidents; they're not a substitute for your own recovery plan.

## Testing restores

The one drill nobody runs and everyone needs:

1. Spin up an isolated VM or container
2. Install the same Postgres version
3. pgBackRest restore from the latest backup
4. Measure wall-clock time (that's your RTO)
5. Pick a target_time from 15 minutes ago and restore to it (that's your RPO test)
6. Verify row counts and application smoke test
7. Document result, put on quarterly calendar

**If you've never done this, your RTO is "unknown" and your CMMC assessor will notice.**

## Anti-patterns

- **Keeping backups on the same server as the database.** Single storage failure loses everything.
- **pg_dump of a 500 GB database nightly.** Takes forever, locks things, and you still can't do PITR.
- **Relying on replication for backup.** A bad DROP TABLE replicates instantly.
- **No off-region copy.** Regional outage = total data loss.
- **WAL archiving with no monitoring.** `archive_command` fails, WAL fills up, primary crashes. Monitor `pg_stat_archiver`.
- **Encrypted backups with the key stored next to them.** Keep the key in KMS / Vault.
