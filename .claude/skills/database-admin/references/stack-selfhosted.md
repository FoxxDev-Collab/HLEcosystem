# Stack: Self-Hosted

## Install from PGDG

**Do not use distro-packaged Postgres.** They're old. Use the official PGDG repos.

### Rocky Linux 9 / 10

```bash
# Add PGDG repo
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf -qy module disable postgresql    # disable built-in module
sudo dnf install -y postgresql18-server postgresql18-contrib

# Initialize
sudo /usr/pgsql-18/bin/postgresql-18-setup initdb
sudo systemctl enable --now postgresql-18
```

### Ubuntu 24.04 LTS

```bash
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-18 postgresql-contrib-18
```

### Docker / Compose

```yaml
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./initdb:/docker-entrypoint-initdb.d:ro
    ports:
      - "127.0.0.1:5432:5432"    # bind loopback only
    shm_size: 1g                  # important for large work_mem
    restart: unless-stopped
volumes:
  pgdata:
```

## Filesystem choice

| FS | Pros | Cons |
|---|---|---|
| **ext4** | Simple, universal | No native snapshots, no compression |
| **xfs** | Good for large files, mature | No native snapshots |
| **zfs** | Snapshots, compression, checksums, encryption | Memory-hungry, license quirks on Linux |

For production:
- **ext4 / xfs**: mount with `noatime`, data=ordered (ext4 default), full journaling.
- **zfs**: `recordsize=8K` matching Postgres page size (16K for WAL), `compression=lz4`, `atime=off`, `logbias=throughput` for data, `logbias=latency` for WAL.

With ZFS `recordsize >= 8K`, you can safely set `full_page_writes = off` because ZFS's copy-on-write eliminates torn writes. Significant WAL reduction on write-heavy workloads.

## Kernel / OS tuning

```bash
# /etc/sysctl.d/99-postgres.conf
vm.swappiness = 1              # don't swap unless dying
vm.overcommit_memory = 2       # strict accounting
vm.overcommit_ratio = 95
vm.dirty_background_ratio = 5
vm.dirty_ratio = 10
vm.zone_reclaim_mode = 0
kernel.shmmax = 68719476736    # sized to RAM
kernel.shmall = 16777216

# Huge pages
vm.nr_hugepages = <calculated>   # see next step
```

### Huge pages

Postgres 18 can use huge pages efficiently. Check needed size:

```bash
head -1 /var/lib/pgsql/18/data/postmaster.pid   # get pid
grep VmPeak /proc/<pid>/status
# Divide by 2048 KB (huge page size), round up, set vm.nr_hugepages
```

In postgresql.conf: `huge_pages = try` (or `on` once confirmed).

## systemd drop-ins

Don't edit the shipped unit. Override instead:

```bash
sudo systemctl edit postgresql-18
```

```ini
[Service]
LimitNOFILE=65536
LimitCORE=infinity
OOMScoreAdjust=-1000    # don't let OOM killer pick postgres
```

## DISA STIG for PostgreSQL

**Crunchy Data maintains the STIG for Postgres.** Covers PG 13–16 as of mid-2024, InSpec validation profile refreshed July 2024.

STIG categories touched:
- **pg_hba.conf** — no trust, only hostssl, explicit reject
- **Audit** — pgAudit enabled, specific events logged
- **Auth** — SCRAM-SHA-256, not md5
- **TLS** — TLS 1.2+, specific ciphers
- **Crypto** — FIPS mode if required
- **Roles** — no SUPERUSER except specific accounts, REVOKE PUBLIC
- **Logging** — log rotation, log to centralized syslog/SIEM
- **Backups** — documented, tested, encrypted

For CMMC L2 / IL4 environments, run the InSpec profile as part of CI and track findings in your POA&M.

Links in research notes — pull latest from public.cyber.mil when assessing.

## Kubernetes — CloudNativePG

Skip Patroni. CloudNativePG is the 2026 default.

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: app-db
spec:
  instances: 3
  postgresql:
    parameters:
      shared_buffers: "4GB"
      work_mem: "32MB"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"
  bootstrap:
    initdb:
      database: app
      owner: app
  storage:
    size: 100Gi
    storageClass: fast-ssd
  backup:
    barmanObjectStore:
      destinationPath: s3://my-backups/app-db
      s3Credentials:
        accessKeyId:
          name: s3-creds
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: s3-creds
          key: SECRET_ACCESS_KEY
      wal:
        compression: gzip
    retentionPolicy: "30d"
```

CloudNativePG handles failover, PITR, replica promotion, rolling updates, and storage management. No StatefulSet quirks, no etcd.

## Monitoring

### Prometheus + Grafana

```yaml
# postgres_exporter as a sidecar or separate deployment
- name: postgres-exporter
  image: prometheuscommunity/postgres-exporter:latest
  env:
  - name: DATA_SOURCE_NAME
    value: "postgresql://monitor:password@localhost:5432/postgres?sslmode=require"
```

Grafana dashboards: Postgres Overview (ID 9628), pgwatch2, or build from postgres_exporter metrics.

### pgwatch2 / pganalyze

- **pgwatch2** (open source): comprehensive, self-hosted, InfluxDB or Postgres backend
- **pganalyze** (SaaS): best-in-class query-level analysis, index advisor, bloat tracking

## Logging

```conf
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 1GB
log_truncate_on_rotation = on

log_line_prefix = '%m [%p] %q%u@%d '
log_min_duration_statement = 1000
log_statement = 'ddl'
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0
log_autovacuum_min_duration = 5000
log_checkpoints = on
```

Ship to your SIEM. `rsyslog` + TLS to a central collector is the usual path. Or run `filebeat` / `vector` / `fluent-bit`.

## Anti-patterns

- **Distro-packaged Postgres in production.** Old versions, slow security patches.
- **Postgres on an EBS volume < 1000 IOPS provisioned.** Burst credits run out, cascading fail.
- **No huge pages configured.** Wastes ~10–15% TLB efficiency on large shared_buffers.
- **Leaving default `listen_addresses = localhost` when it needs external access, then editing pg_hba.conf and not postgresql.conf.** Classic debugging time sink.
- **`sudo -u postgres psql` as the admin workflow long-term.** Create a specific admin role, use a jump host, log everything.
- **Backups to the same server / same disk.** Fire, flood, ransomware — all take the whole thing.
