# Row-Level Security and Backend-in-DB

## Why RLS matters

**RLS is what makes Postgres uniquely strong for multi-tenant SaaS.** Tenant isolation becomes a database-level guarantee, not an application-code convention. The boundary is enforced regardless of which service connects.

## Turning on RLS

```sql
-- Enable and FORCE (important — without FORCE, table owner bypasses)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
```

`FORCE` matters: without it, the table owner (often your app's migration role) is not subject to RLS — which means policies you think are protecting you are only protecting you from non-owners.

## The three canonical patterns

### 1. Multi-tenancy by tenant_id in JWT

```sql
CREATE POLICY tenant_isolation ON documents
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_documents_tenant ON documents (tenant_id);  -- REQUIRED
```

### 2. User-owned rows (the SELECT trick)

```sql
-- Slow: auth.uid() evaluated per row
CREATE POLICY user_owns_row ON notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Fast: SELECT subquery evaluated once as InitPlan
CREATE POLICY user_owns_row ON notes
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()));
```

The `SELECT auth.uid()` wrapping turns the function call into a one-shot InitPlan. Massive difference on large tables.

### 3. Team membership without policy join

**Never embed a join in a policy.** Wrap in a stable SECURITY DEFINER function.

```sql
CREATE OR REPLACE FUNCTION auth.is_team_member(team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp   -- closes CVE-2018-1058
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = is_team_member.team_id
      AND team_members.user_id = (SELECT auth.uid())
  );
$$;

CREATE POLICY team_members_only ON documents
  FOR ALL TO authenticated
  USING (auth.is_team_member(team_id));
```

`SECURITY DEFINER` runs the function as the owner, bypassing RLS on `team_members` — which is what you want (otherwise you'd need RLS on team_members that allows this lookup, which recurses).

## Performance footguns

### Non-LEAKPROOF operators disable index push-down

RLS creates a security barrier. Operators that aren't marked `LEAKPROOF` can't push below the barrier, which silently disables index usage.

- `ILIKE` — not LEAKPROOF
- `pg_trgm` `%` — not LEAKPROOF
- Custom functions — not LEAKPROOF unless you mark them

Workaround: create a SECURITY DEFINER function that applies the filter + uses the operator inside, so RLS is evaluated once.

### Policy predicate indexes are mandatory

Every column referenced in a policy `USING` clause should be indexed. Forget this and your 5ms queries become 500ms table scans.

### Referential integrity bypasses RLS

A unique constraint will leak that another tenant already has that email. For strict multi-tenant isolation, scope constraints to tenant:

```sql
-- WRONG: leaks existence across tenants
UNIQUE (email)

-- RIGHT: scoped to tenant
UNIQUE (tenant_id, email)
```

Same for FKs — a FK will reveal whether a parent row exists regardless of RLS.

## PERMISSIVE vs RESTRICTIVE

- **PERMISSIVE** (default): multiple policies are OR'd together
- **RESTRICTIVE**: policies are AND'd with the permissive result

Use RESTRICTIVE to add a hard floor that can't be opened up by adding more permissive policies.

```sql
CREATE POLICY deny_deleted ON documents AS RESTRICTIVE
  FOR ALL USING (deleted_at IS NULL);
```

## Pooling pitfall

In transaction-mode pooling (pgBouncer, RDS Proxy, Supavisor), connections are shared across requests. Never use session-scoped `SET`:

```sql
-- WRONG in transaction pooling: leaks to next request
SET my.tenant_id = '...';

-- RIGHT: scoped to transaction
BEGIN;
SET LOCAL my.tenant_id = '...';
SELECT ...;
COMMIT;

-- Or function-local
SELECT set_config('my.tenant_id', $1, true);  -- third arg = is_local
```

## Supabase architecture (reference)

Postgres at the center. PostgREST serves REST off the schema. pg_graphql serves GraphQL. GoTrue does auth (returns JWTs). Storage is S3-compatible with RLS metadata. Realtime streams logical replication over WebSockets. All share the same Postgres, all enforce RLS.

**`service_role` has `BYPASSRLS` and must only exist server-side.** If it ever reaches a client, your tenant isolation is gone.

## PostgREST

Introspects the schema at startup. Tables → collections. FKs → embedding. Functions → `/rpc/<n>`. Validates JWTs, runs `SET LOCAL ROLE` from the claim's role. RLS does authorization.

Pros: fast, simple, type-safe-ish.
Cons: schema is your API — migrations are visible. Complex business logic in PL/pgSQL is a commitment.

## pg_graphql

Rust extension inside Postgres. Reflects a Relay-compliant GraphQL schema from the SQL schema. Supabase exposes it via PostgREST calling `graphql.resolve()`.

Pros: auto-generated, follows the schema.
Cons: less flexible than Hasura. Mutations are cursor-based and can be surprising.

## Hasura

External engine, not an extension. Uses Postgres metadata + its own permission system. Good for GraphQL subscriptions, remote schemas, multi-source federation.

Pros: mature, subscriptions via WebSockets, UI for permissions.
Cons: heavier runtime, permissions live outside SQL (so auditing is different).

## Anti-patterns

- **RLS without FORCE.** Your migration role bypasses RLS, so tests pass and production leaks.
- **Policies without role scoping.** `FOR ALL` with no `TO authenticated` runs for anonymous too.
- **Joins embedded in policies.** Always wrap in SECURITY DEFINER functions.
- **`auth.uid()` without `SELECT` wrapper.** Re-evaluates per row.
- **Skipping the policy-predicate index.** RLS without indexes is a table scan.
- **`service_role` JWT given to clients.** Game over. Rotate keys immediately.
- **Session `SET` in transaction pooling.** Leaks across requests.
