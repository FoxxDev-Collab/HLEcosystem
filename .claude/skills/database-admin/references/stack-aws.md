# Stack: AWS RDS and Aurora

## RDS vs Aurora

| Feature | RDS PostgreSQL | Aurora PostgreSQL |
|---|---|---|
| Storage | EBS (gp3 / io2) | Distributed 6-copy across 3 AZs |
| Max size | 64 TiB | 256 TiB |
| Failover | Multi-AZ DB cluster: ~35s | 15–30s |
| Read replicas | Up to 15, each with own storage | Up to 15 sharing one volume |
| Replication | Physical streaming | Shared-storage |
| Cost | Generally cheaper | ~20% more, plus I/O or I/O-Optimized |
| Serverless | No | Aurora Serverless v2 (0.5–256 ACU) |

**Rule of thumb**: RDS Multi-AZ DB cluster is the defensible default for cost-conscious teams with sub-minute failover tolerance. Aurora is worth the premium when you need:
- 15-second failover
- >10 TiB storage
- Many read replicas sharing data
- Aurora-specific features (Backtrack, Global Database, Serverless v2)

## Aurora I/O-Optimized

Removes I/O charges, ~30% higher compute, ~2.25× storage cost.

**Break-even**: switch when I/O is **>25% of your Aurora bill**. Check CloudWatch `VolumeReadIOPs` + `VolumeWriteIOPs` × $0.20 per million.

Many teams over-pay because they never measure. Run the numbers.

## Parameter Groups

Postgres GUCs live in a Parameter Group, not in a postgresql.conf you can edit.

```bash
# Create a custom group (can't edit the default)
aws rds create-db-parameter-group \
  --db-parameter-group-name my-postgres-18 \
  --db-parameter-group-family postgres18 \
  --description "Custom tuning"

# Modify parameters
aws rds modify-db-parameter-group \
  --db-parameter-group-name my-postgres-18 \
  --parameters "ParameterName=work_mem,ParameterValue=32MB,ApplyMethod=immediate" \
               "ParameterName=random_page_cost,ParameterValue=1.1,ApplyMethod=immediate"

# Apply to instance
aws rds modify-db-instance --db-instance-identifier mydb \
  --db-parameter-group-name my-postgres-18 --apply-immediately
```

Many parameters require reboot. Check `ApplyType` in the docs.

## Extensions — the allowlist

RDS / Aurora only allow a curated list via `rds.extensions`. Common ones:

- pg_stat_statements, pg_trgm, pgcrypto, pgaudit, postgis
- pgvector (check version — RDS tracks upstream with a lag)
- pg_cron
- pg_partman (extension body; schedule via pg_cron)

**Not available**: extensions requiring superuser or modifications to core files (e.g. pg_repack as a background worker, pg_hint_plan historically). Always check the RDS extension list for your PG version.

## IAM database authentication

Eliminates long-lived DB passwords.

```sql
CREATE USER iam_user;
GRANT rds_iam TO iam_user;
```

Application generates a 15-minute token:

```bash
aws rds generate-db-auth-token \
  --hostname mydb.us-east-1.rds.amazonaws.com \
  --port 5432 --region us-east-1 \
  --username iam_user
```

Use the token as password, connect with TLS. **Throttled at ~200 tokens/sec** account-wide — pool carefully.

## RDS Proxy

Managed connection pooler. Worth using when:
- You have Lambda or other connection-heavy serverless
- You want IAM + Secrets Manager rotation
- You need automatic failover with connection multiplexing

**Pinning pitfalls** (connection can't be reused):
- Prepared statements (pre-PgBouncer 1.21 compatibility)
- SET statements
- Session variables
- Temporary tables
- Large query text (statement >16 KB pins the session)

Monitor `DatabaseConnectionsCurrentlySessionPinned` CloudWatch metric. If it's high, find what's pinning and fix it.

## Secrets Manager integration

```bash
aws secretsmanager create-secret --name prod/db/myapp \
  --secret-string '{"username":"app","password":"...","host":"mydb.us-east-1.rds.amazonaws.com"}'

# Enable rotation with Lambda
aws secretsmanager rotate-secret --secret-id prod/db/myapp \
  --rotation-lambda-arn arn:aws:lambda:... \
  --rotation-rules "AutomaticallyAfterDays=30"
```

Rotation is mandatory for CMMC-aligned deployments.

## Performance Insights

Enable on every production instance. Free for 7 days retention, paid beyond. Shows query-level load with per-wait-event breakdown — the managed equivalent of `pg_stat_statements` + `pg_stat_activity`.

```bash
aws rds modify-db-instance --db-instance-identifier mydb \
  --enable-performance-insights \
  --performance-insights-retention-period 7
```

## Enhanced Monitoring

OS-level metrics at 1–60 second granularity. Enable it, especially for diagnosing CPU steal, I/O contention, memory pressure.

## Backup patterns

**Default**: automated snapshots + PITR (7–35 days). Good.

**Better**: automated snapshots + PITR + **cross-region snapshot copy** for DR.

**Best for CMMC**: all of the above + **your own pgBackRest to an S3 bucket you control**, with KMS encryption, Object Lock, and an MFA-delete policy. Managed backups can disappear with the account.

## Multi-AZ options

### Multi-AZ Instance (legacy)
Standby is not readable. ~60–120s failover. Cheaper but limited.

### Multi-AZ DB Cluster (PG 13.4+)
**Preferred.** One writer + 2 readable standbys. ~35s failover. You get read scale for free.

### Aurora Multi-AZ
Default architecture. 6 copies across 3 AZs. ~15–30s failover. Read replicas share storage.

## Network / VPC patterns

- **Private subnets only**. No public IP.
- **Security group** allows only application SG on port 5432. No 0.0.0.0/0. Ever.
- **VPC endpoints** for Secrets Manager and KMS (keep traffic off the internet).
- **Transit Gateway** or VPC peering for cross-VPC access.

## CloudTrail + Database Activity Streams

**Database Activity Streams** (Aurora only) emits near-real-time audit events to Kinesis. Mandatory for high-sensitivity CMMC workloads.

**CloudTrail** catches the AWS API calls (CreateDBInstance, ModifyDBInstance, DeleteDBInstance). Enable organization-wide, log to a dedicated security account.

## CMMC baseline on AWS

A defensible RDS PostgreSQL configuration for CMMC L2:

- RDS PostgreSQL 17+ or Aurora PostgreSQL 17+ in private subnets
- Multi-AZ DB cluster (RDS) or Aurora with multi-AZ
- Storage encrypted with customer-managed KMS key
- TLS required (`rds.force_ssl = 1`)
- IAM database authentication
- Secrets Manager with 30-day rotation
- RDS Proxy for connection management
- pgAudit extension enabled, logs to CloudWatch
- Performance Insights + Enhanced Monitoring
- Automated snapshots 35 days + weekly cross-region copy
- **Your own pgBackRest repo to KMS-encrypted S3 bucket**
- Security group allows only app tier
- CloudTrail organization trail
- AWS Config rules for RDS (`rds-instance-public-access-check`, `rds-snapshot-encrypted`, etc.)

## Anti-patterns specific to AWS

- **`db.t3.micro` for production.** Burst credits run out. Use `db.t3.medium` minimum, ideally non-burstable.
- **Storage autoscaling without upper bound.** A runaway workload fills the disk and bills you for it.
- **Publicly accessible RDS instances.** Yes, people still do this.
- **Aurora without understanding I/O cost.** Can double the bill vs RDS.
- **Forgetting to set `rds.force_ssl = 1`.** Clients can silently connect without TLS.
- **Using the master user in application config.** Create app-specific roles.
