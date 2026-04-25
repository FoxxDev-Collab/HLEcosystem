# Migrations and Tooling

## Migration tool selection

| Tool | Language/Ecosystem | Style | Notes |
|---|---|---|---|
| **Atlas** | Language-agnostic (Go binary) | Declarative + imperative | 50+ analyzers, K8s operator, best in 2026 |
| **Flyway** | JVM / CLI | Imperative (versioned SQL) | Mature, boring, works |
| **Liquibase** | JVM / CLI | XML/YAML/JSON changelog | Enterprise-favored |
| **Alembic** | Python / SQLAlchemy | Imperative | Default for Python/SQLAlchemy |
| **Prisma Migrate** | Node/TS | Declarative (schema-first) | Tightly coupled to Prisma ORM |
| **Drizzle Kit** | Node/TS | Schema-first or SQL-first | Lightweight, fast |
| **sqlx migrate** | Rust | Imperative | Best for Rust/sqlx |
| **Goose** | Go | Imperative | Simple, widely used in Go |
| **golang-migrate** | Go | Imperative | Alternative to Goose |

**Opinion**: Atlas is the strongest language-agnostic choice in 2026. If you're in an ecosystem (Rails → Active Record, Django → Django migrations, Laravel → Eloquent, etc.), use the native tool. Cross-team / polyglot / infra-as-code: Atlas.

## Atlas essentials

```bash
# Declare schema in HCL or SQL
atlas schema inspect --url postgres://... > schema.hcl

# Plan a migration
atlas migrate diff --env local --to file://schema.hcl

# Apply
atlas migrate apply --env local

# CI: lint migrations
atlas migrate lint --latest 1 --env local
```

Analyzers catch:
- Missing concurrent index creation
- Destructive changes (DROP COLUMN, ALTER TYPE)
- Missing NOT NULL safety (default before NOT NULL on a big table locks)
- Backward-incompatible changes

## Zero-downtime migration rules

These are not guidelines — they're survival rules for production.

### Always use CONCURRENTLY for indexes

```sql
-- WRONG: takes AccessExclusive lock, blocks everything
CREATE INDEX idx_users_email ON users (email);

-- RIGHT
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
```

Can fail and leave an `INVALID` index. Check with `\d users` and drop/retry.

### Add columns with DEFAULT — safe since PG 11

```sql
-- PG 11+: fast metadata-only change even with DEFAULT
ALTER TABLE large_table ADD COLUMN status text DEFAULT 'pending' NOT NULL;
```

Pre-PG 11 this rewrote the whole table. Not an issue on modern Postgres.

### Remove columns in two phases

1. First deploy: app stops using column, but column stays. Migration sets DEFAULT if needed.
2. Wait until no code references it. One release minimum, often two.
3. Second deploy: `ALTER TABLE ... DROP COLUMN`.

### Rename columns — don't

Rename is an incompatibility bomb between deploys. Instead:

1. Add new column
2. Dual-write from app
3. Backfill
4. Read from new
5. Drop old

### Make NOT NULL safely

```sql
-- 1. Add CHECK constraint NOT VALID (doesn't validate existing rows, fast)
ALTER TABLE users ADD CONSTRAINT users_email_not_null
  CHECK (email IS NOT NULL) NOT VALID;

-- 2. Validate in background
ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;

-- 3. Add NOT NULL (now cheap because CHECK exists)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- 4. Drop the CHECK (optional)
ALTER TABLE users DROP CONSTRAINT users_email_not_null;
```

### ALTER TYPE considerations

Changing column type usually rewrites the whole table and takes an AccessExclusive lock. For big tables:

1. Add new column with target type
2. Dual-write / backfill
3. Swap column references
4. Drop old

## Type-safe clients

| Client | Language | Style |
|---|---|---|
| **sqlc** | Go | SQL-first: write .sql, generate typed Go |
| **Prisma** | Node/TS | ORM, schema-first |
| **Drizzle** | Node/TS | Lightweight, SQL-like DSL |
| **Kysely** | Node/TS | Query builder, strongly typed |
| **SQLAlchemy 2.0** | Python | ORM, async support |
| **sqlx** | Rust | SQL at compile time, checked against DB |
| **Ecto** | Elixir | Native changeset-based |

**If you have a choice, prefer SQL-first tools (sqlc, sqlx, Drizzle SQL-like) over ORMs for anything performance-sensitive.** ORMs generate N+1 queries, surprising joins, and hide the real SQL until production.

## Testing patterns

### Transactional rollback tests

```go
tx, _ := db.BeginTx(ctx, nil)
defer tx.Rollback()
// ... run test against tx ...
```

Test isolation without cleaning tables.

### testcontainers

Spin up real Postgres per test run:

```go
pg, _ := postgres.RunContainer(ctx,
    testcontainers.WithImage("postgres:18-alpine"),
    postgres.WithDatabase("testdb"))
```

Slow but accurate. Use for integration suites, not unit tests.

### Neon branches for PR preview

Unique advantage: each PR gets a real DB branch with production-sanitized data. See `stack-neon.md`.

### pg_tap

SQL-native testing framework. Useful for testing RLS policies, triggers, stored procedures:

```sql
SELECT plan(2);
SELECT has_table('users');
SELECT col_not_null('users', 'email');
SELECT * FROM finish();
```

## CI patterns

- Run migrations forward + rollback in CI
- Lint migrations with Atlas or Squawk
- Run a smoke test after migration against a representative dataset
- For schema-sensitive changes, dump schema before/after and diff in the PR

## ORM tradeoffs

ORMs shine for rapid prototyping and CRUD. They become liabilities for:

- **Complex queries**: N+1, surprise joins, inefficient execution
- **Performance tuning**: can't use window functions, CTEs, lateral joins cleanly
- **RLS**: some ORMs bypass session settings, breaking tenant isolation
- **Schema migrations**: auto-generated migrations are often wrong for zero-downtime

Common pattern: ORM for 80% of CRUD, raw SQL (sqlc / sqlx) for hot paths and reports.

## Anti-patterns

- **Migrations without rollback tested.** You'll need it at 3 AM.
- **`CREATE INDEX` (non-concurrent) on production tables.** Blocks writes.
- **Dropping columns in the same deploy that removes code referencing them.** Cascading failures.
- **ORM-generated migrations without review.** Often wrong for production scale.
- **Running migrations from the application itself at startup.** Multi-instance race conditions, unpredictable timing. Run migrations as a separate job.
- **No schema diff in PRs.** Reviewers can't see what changed.
