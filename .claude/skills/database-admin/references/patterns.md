# Architecture Patterns

## Outbox pattern — reliable event publishing

**Problem**: your domain write and your event publish must either both happen or both not. An app that updates a row then publishes to Kafka is a distributed transaction in disguise — it will drop events.

**Solution**: write the domain change and an `outbox` row in the same Postgres transaction. A separate process drains the outbox to Kafka / SQS / NATS.

```sql
CREATE TABLE outbox (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  aggregate_type  text NOT NULL,
  aggregate_id    uuid NOT NULL,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);

CREATE INDEX idx_outbox_unpublished ON outbox (created_at)
  WHERE published_at IS NULL;
```

### Drain approaches

**Polling + SKIP LOCKED** (simple, 1–10k events/sec):

```sql
UPDATE outbox SET published_at = now()
WHERE id IN (
  SELECT id FROM outbox WHERE published_at IS NULL
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 100
)
RETURNING *;
```

**Debezium + pgoutput** (production-grade, 10k+ events/sec): logical replication streams every WAL change. Debezium's outbox event router SMT expects `aggregatetype`, `aggregateid`, `type`, `payload` columns and routes to per-aggregate topics.

Use `pgoutput` (built-in since PG 10). Avoid `wal2json` — tends to OOM on large transactions.

## CDC — Change Data Capture

**Three paths in Postgres**:

1. **Triggers → audit table** (simplest, synchronous, works on any Postgres)
2. **Logical replication + pgoutput → Debezium** (async, external consumer, most production)
3. **Logical replication → own decoder** (e.g. Sequin, pg_net HTTP callbacks)

For CMMC audit trails, path #1 is defensible and local. For event-driven architectures at scale, path #2.

## Multi-tenancy strategies

| Strategy | Pros | Cons | When |
|---|---|---|---|
| **Shared schema + tenant_id + RLS** | Cheapest, simplest ops | Noisy neighbor risk, RLS complexity | Default for B2B SaaS |
| **Schema per tenant** | Clean isolation, per-tenant migrations | Migration overhead grows with tenant count | Mid-sized tenants, some regulated |
| **Database per tenant** | Strong isolation, independent tuning | Operational overhead high | Enterprise, HIPAA, CMMC-sensitive |
| **Citus sharding** | Scales beyond one node | Complexity, limited features | >100M rows per tenant |

### Default: shared schema + RLS

```sql
-- Every tenant-scoped table gets this
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  -- ... business columns ...
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_tenant ON documents (tenant_id);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

App sets `SET LOCAL app.tenant_id = '...'` inside each transaction. Or uses JWT-based claim via `auth.jwt() ->> 'tenant_id'`.

### When to escalate

- **Shared → schema-per-tenant**: tenant count <500, each tenant has customizations, migrations feasible per-tenant
- **Schema → database-per-tenant**: regulated tenant data, independent backup/restore, cross-region residency
- **→ Citus**: a single tenant outgrows a node, or cross-tenant analytics must fan out

## Audit trail patterns

### Generic trigger pattern

One table, one trigger, all changes captured:

```sql
CREATE SCHEMA audit;

CREATE TABLE audit.logged_actions (
  id            bigserial PRIMARY KEY,
  table_name    text NOT NULL,
  row_id        text NOT NULL,
  operation     text NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data      jsonb,
  new_data      jsonb,
  changed_by    text NOT NULL DEFAULT session_user,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  client_ip     inet
) PARTITION BY RANGE (changed_at);

-- Monthly partitions via pg_partman

CREATE OR REPLACE FUNCTION audit.log_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit.logged_actions(table_name, row_id, operation, old_data, changed_by, client_ip)
    VALUES (TG_TABLE_NAME, OLD.id::text, TG_OP, to_jsonb(OLD), session_user, inet_client_addr());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit.logged_actions(table_name, row_id, operation, old_data, new_data, changed_by, client_ip)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(OLD), to_jsonb(NEW), session_user, inet_client_addr());
    RETURN NEW;
  ELSE
    INSERT INTO audit.logged_actions(table_name, row_id, operation, new_data, changed_by, client_ip)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(NEW), session_user, inet_client_addr());
    RETURN NEW;
  END IF;
END $$;

-- Apply to any table
CREATE TRIGGER audit_documents
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION audit.log_changes();
```

Simple, auditable, partition-friendly. Handles CMMC AU-2 / AU-3 for one database.

### Scale escalation

- <10 TPS audit writes: triggers fine
- 10–500 TPS: triggers OK but partition audit table weekly, archive old partitions
- >500 TPS or multi-DB: CDC-based audit via Debezium, route to dedicated audit pipeline

## Idempotency keys

For retry-safe APIs.

```sql
CREATE TABLE idempotency_keys (
  user_id         uuid NOT NULL,
  key             text NOT NULL,
  request_hash    text NOT NULL,     -- hash of method + path + body
  recovery_point  text,               -- where in the flow we got
  response_code   int,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  PRIMARY KEY (user_id, key)
);
```

On request:
1. Look up `(user_id, key)`
2. If exists and `request_hash` matches → return cached response
3. If exists and hash differs → 409 Conflict
4. If not exists → acquire row lock, do work, advance `recovery_point` as you go, cache response

Classify errors as `is_transient` (retry same key) vs `permanent` (cache the failure so client doesn't loop).

## UUIDs — which version

| Version | Use | Notes |
|---|---|---|
| **v7** | **Default for PKs** | Time-ordered, B-tree friendly. Native in PG 18 |
| **v4** | Surface IDs where timestamp leakage matters | `gen_random_uuid()` |
| **v1** | Never | Leaks MAC address |
| **bigserial** | High-append internal tables where PK won't leak | Compact, monotonic |

**UUIDv4 primary keys on high-append tables cause B-tree bloat** because inserts land randomly. UUIDv7 fixes this — sortable by time, so inserts mostly hit the same page.

```sql
-- PG 18 native
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  ...
);

-- Pre-18: use an extension (e.g. pg_uuidv7) or generate in app
```

## Soft delete — don't

Common pattern: `deleted_at timestamptz` column, `WHERE deleted_at IS NULL` everywhere.

**Problems**:
- Every query carries the filter. Forget once → data leak.
- FKs don't enforce cleanly (delete parent, children still reference it).
- Unique constraints get awkward (need partial unique).
- Indexes bloat with dead rows.
- In a decade, nobody has ever cared about undeleting the row in practice.

**Alternative (Brandur Leach pattern)**: hard delete + generic audit. If you truly might need to restore, a `deleted_record` trigger archives the full row into a single JSONB table before the DELETE fires:

```sql
CREATE TABLE deleted_record (
  id        uuid PRIMARY KEY DEFAULT uuidv7(),
  table_name text NOT NULL,
  row_data  jsonb NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION archive_deleted() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO deleted_record(table_name, row_data)
  VALUES (TG_TABLE_NAME, to_jsonb(OLD));
  RETURN OLD;
END $$;

CREATE TRIGGER archive_on_delete_users
BEFORE DELETE ON users FOR EACH ROW
EXECUTE FUNCTION archive_deleted();
```

Clean main table, safety net for 1-in-a-million restore cases, no query pollution.

## Event sourcing / CQRS in Postgres

**Event sourcing** is possible in Postgres (`events` table as append-only log, projections materialized into read tables), but is heavier than people expect. Rebuild times grow with event count. Most teams who think they want event sourcing actually want:

- **Audit trail** → use the generic trigger pattern above
- **CDC** → use Debezium
- **Append-only domain logs** → outbox pattern is usually enough

Only reach for full event sourcing when temporal replay is a core domain feature (finance, medical records, legal).

## Anti-patterns

- **Distributed transactions across Postgres and Kafka.** Use outbox.
- **Multi-tenancy via `WHERE tenant_id = ?` in application code.** Use RLS.
- **Soft delete as the default.** Prefer hard delete + archive trigger.
- **UUIDv4 PKs on high-write tables.** Use UUIDv7.
- **Triggers for business logic.** Triggers are great for audit, terrible for workflow — they're invisible in code review, bypassable by `TRUNCATE ... RESTART IDENTITY CASCADE`, and a debugging nightmare.
- **Dual-write without outbox.** Guaranteed data inconsistency.
- **`SERIAL` / `BIGSERIAL` new tables in PG 10+.** Use `GENERATED BY DEFAULT AS IDENTITY` — SQL-standard, cleaner semantics.
