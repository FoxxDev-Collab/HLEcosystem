# Security and Compliance

## Authentication

| Method | Use for | Avoid |
|---|---|---|
| `scram-sha-256` | Default for passwords | `md5` — officially deprecated in PG 18 |
| `cert` | Service-to-service with mTLS | Plain password over untrusted network |
| LDAP / Kerberos | Enterprise SSO | Ad-hoc LDAP without TLS |
| IAM | RDS/Aurora | Long-lived DB passwords |
| OAuth 2.0 | PG 18+ | — |

**Never `trust` authentication outside Docker dev loopback.**

## pg_hba.conf essentials

```conf
# TYPE      DATABASE  USER          ADDRESS          METHOD
local       all       postgres                       peer

# Application connections — require TLS
hostssl     app_db    app_user      10.0.0.0/8       scram-sha-256
hostssl     app_db    app_user      0.0.0.0/0        scram-sha-256 clientcert=verify-full

# Replication
hostssl     replication repl        10.0.0.0/8       scram-sha-256

# Deny everything else
host        all       all           0.0.0.0/0        reject
```

Always use `hostssl` not `host`. Never `trust`. Make the last rule an explicit `reject`.

Client side: `sslmode=verify-full` prevents MITM. `require` is not enough — it doesn't verify the cert.

## Roles and permissions

Default principle: **least privilege, predefined roles, no superuser in apps.**

```sql
-- Application role (no login, just a container for permissions)
CREATE ROLE app_role;
GRANT CONNECT ON DATABASE app_db TO app_role;
GRANT USAGE ON SCHEMA public TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;

-- Login role inherits app_role
CREATE ROLE app_user LOGIN PASSWORD '...';
GRANT app_role TO app_user;
```

### Predefined roles (built in)

- `pg_read_all_data` (14+) — SELECT on all tables/views
- `pg_write_all_data` (14+) — INSERT/UPDATE/DELETE
- `pg_monitor` — pg_stat_*, lock monitoring
- `pg_maintain` (16+) — VACUUM, ANALYZE, CLUSTER, REFRESH MV, REINDEX
- `pg_checkpoint` (15+) — CHECKPOINT
- `pg_signal_backend` — cancel/terminate other sessions

Grant these instead of SUPERUSER for operational roles.

### PG 15+ default: no CREATE on public

In PG 15+, `CREATE` on `public` schema is revoked from PUBLIC by default. Pre-15, run:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

## Row-level security

See `references/rls-and-backend.md` — the primary defense for multi-tenant SaaS.

## TLS in transit

```conf
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/ssl/postgres/server.crt'
ssl_key_file = '/etc/ssl/postgres/server.key'
ssl_ca_file = '/etc/ssl/postgres/ca.crt'
ssl_min_protocol_version = 'TLSv1.2'   # TLS 1.3 if possible
ssl_ciphers = 'HIGH:!aNULL:!MD5:!3DES'
```

RDS/Aurora: use the regional or global CA bundle, verify the chain. Rotate with the 2024+ CA migration.

## Encryption at rest

Postgres has **no native TDE as of PG 18**. Options:

1. **Filesystem / volume** (most common): LUKS, ZFS native encryption, EBS+KMS, RDS storage encryption (KMS). Good enough for most compliance frameworks.
2. **pgcrypto** for column-level encryption of specific sensitive fields. Keep keys out of the DB.
3. **Application-layer encryption** (libraries like libsodium, Tink) — strongest control, hardest to search/index.

For CMMC L2: KMS-backed volume encryption is the usual baseline. pgcrypto for PII you might need to surrender to a subpoena.

## Audit logging — pgAudit

Not optional for CMMC.

```sql
CREATE EXTENSION pgaudit;
```

```conf
# postgresql.conf
shared_preload_libraries = 'pgaudit'
pgaudit.log = 'write, ddl, role'
pgaudit.log_catalog = off
pgaudit.log_client = on
pgaudit.log_level = 'log'
pgaudit.log_parameter = on

# Object-level audit (fine-grained, to a role)
pgaudit.role = 'auditor'
```

Then assign SELECT to `auditor` role on specific sensitive tables — reads to those are audited, others aren't.

Pair with:

```conf
log_connections = on
log_disconnections = on
log_hostname = on
log_line_prefix = '%m [%p] %q%u@%d '
log_min_duration_statement = 1000   # log >1s queries
log_statement = 'ddl'
```

Ship logs to CloudWatch / Splunk / SIEM. Don't let them sit on the DB host.

## Recent CVEs (know these)

- **CVE-2024-10979** (PL/Perl env var injection, CVSS 8.8) + siblings — November 2024 security release
- **CVE-2025-1094** (pg_dump SQL injection) — 2025 minor release
- **CVE-2025-4207** (GB18030 encoding) — 2025 minor release
- **CVE-2026-3172** (pgvector parallel HNSW) — upgrade pgvector to 0.8.2+

Patch discipline: apply minor releases within 30 days. Major releases: read notes, test, upgrade within 12 months.

## FIPS compliance

- Requires Postgres linked against FIPS-validated OpenSSL
- RHEL: `fips-mode-setup --enable`
- RDS/Aurora: use FIPS endpoints (`rds-fips.us-east-1.amazonaws.com`)
- SCRAM-SHA-256 and TLS 1.2+ are FIPS-approved; md5 is not

## Controls mapping — NIST 800-171 / CMMC Level 2

| Control | Postgres implementation |
|---|---|
| **AC-2** (Account Management) | Roles, `pg_roles`, periodic review of CREATE ROLE / ALTER ROLE |
| **AC-3** (Access Enforcement) | GRANT/REVOKE, RLS policies |
| **AC-6** (Least Privilege) | Predefined roles (`pg_monitor`, `pg_maintain`), revoke CREATE on public |
| **AU-2** (Audit Events) | pgAudit session + object audit |
| **AU-3** (Audit Content) | `log_line_prefix` with user, db, timestamp |
| **AU-6** (Audit Review) | Ship to CloudWatch/Splunk, alerts |
| **AU-12** (Audit Generation) | pgAudit + server logs continuously |
| **IA-2** (Identification & Auth) | SCRAM-SHA-256 or IAM (AWS) or certs |
| **IA-5** (Authenticator Management) | Secrets Manager / Vault rotation |
| **SC-8** (Transmission Confidentiality) | `hostssl`, TLS 1.2+, `sslmode=verify-full` |
| **SC-13** (Cryptographic Protection) | FIPS OpenSSL, KMS for at-rest |
| **SC-28** (Protection at Rest) | Volume encryption (LUKS/EBS-KMS), pgcrypto for columns |
| **CM-6** (Configuration Settings) | CIS Benchmark, DISA STIG baselines |
| **SI-4** (System Monitoring) | pgBadger, pganalyze, CloudTrail, Performance Insights |

For the full SSP narrative and POA&M management, defer to **ISSO-1** (assessment, gap analysis, SSP content) and **ISSO-2** (POA&M tracking, continuous monitoring).

## Hardening checklist

- [ ] `listen_addresses` bound to specific interfaces, not `'*'` unless intentional
- [ ] pg_hba.conf: only `hostssl`, last rule is `reject`
- [ ] `ssl_min_protocol_version = 'TLSv1.2'`
- [ ] `password_encryption = 'scram-sha-256'`
- [ ] No SUPERUSER accounts in application config
- [ ] pgAudit enabled, logs shipped off-host
- [ ] `log_connections` and `log_disconnections` on
- [ ] RLS enabled on every tenant-scoped table with `FORCE`
- [ ] Volume encryption on at-rest data
- [ ] pgBackRest encrypted repo in separate failure domain
- [ ] Weekly automated backup restore test
- [ ] Monthly CVE review, patches applied within SLA
- [ ] Quarterly failover / disaster drill
- [ ] DISA STIG or CIS Benchmark scan passing

## Anti-patterns

- **Superuser in application connection strings.** Blast radius of any bug is total.
- **Password auth without TLS.** Credentials in plaintext on the wire.
- **RLS without FORCE.** Migration role bypasses, you never notice.
- **`service_role` key given to browser clients.** BYPASSRLS = game over.
- **Audit logs on the same disk as WAL.** Disk fills, both die.
- **Encrypting at rest with the key on the same server.** You've added a speed bump, not encryption.
- **Skipping minor version patches because "the upgrade is scary."** CVEs accumulate.
