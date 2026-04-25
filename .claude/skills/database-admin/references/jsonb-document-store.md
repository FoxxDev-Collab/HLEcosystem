# JSONB as Document Store

## The 30-second rule

**Use `jsonb`, never `json`.** Plain `json` stores exact input text and reparses on every query. `jsonb` is a decomposed binary format — indexable, deduplicates keys, preserves last value on key collision.

## When JSONB wins over MongoDB

- You need ACID, joins, and relational integrity alongside flexible fields
- Team already runs Postgres
- Document size is under ~1 MB typical
- Updates rewrite the whole document rarely (updates cause a full rewrite of the JSONB value)
- You want one datastore, one backup pipeline, one skill to hire for

## When to actually use MongoDB

- Automatic sharding with built-in balancer is a hard requirement
- In-place updates on large nested structures are hot-path (Mongo can update a deep field without rewriting the document; Postgres can't)
- You're all-in on change streams + WiredTiger document compression + the Atlas ecosystem
- You're doing massive write volume with eventual consistency appetite

Almost no SaaS team in the 1–50M-row range legitimately needs MongoDB over Postgres JSONB.

## Schema pattern

Fixed columns for everything that's stable, hot-filtered, or relational. JSONB for the truly variable.

```sql
CREATE TABLE products (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),          -- PG 18
  tenant_id   uuid NOT NULL,
  sku         text NOT NULL,
  price_cents bigint NOT NULL,
  status      text NOT NULL,
  attributes  jsonb NOT NULL DEFAULT '{}'::jsonb,         -- brand, color, size, etc.
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
```

## Indexing JSONB

### GIN with `jsonb_ops` (default)

Supports every JSONB operator: `@>`, `?`, `?|`, `?&`, `@?`, `@@`.
Larger index (~60–80% of table size).

```sql
CREATE INDEX idx_products_attrs ON products USING gin (attributes);
```

### GIN with `jsonb_path_ops`

2–3× smaller, usually faster. **Only supports containment (`@>`, `@?`, `@@`)**.

```sql
CREATE INDEX idx_products_attrs ON products USING gin (attributes jsonb_path_ops);
```

**Default to `jsonb_path_ops`.** Most real queries are containment (`WHERE attributes @> '{"brand": "Patagonia"}'`). Only use `jsonb_ops` if you also need `?` (key exists) or `?|`/`?&` (any/all keys exist) operators.

### B-tree on extracted scalar

For hot-path equality or range on a single known attribute, GIN is overkill. B-tree the expression:

```sql
CREATE INDEX idx_products_brand ON products ((attributes ->> 'brand'));
SELECT * FROM products WHERE attributes ->> 'brand' = 'Patagonia';
```

### Partial GIN

If only some rows have the key:

```sql
CREATE INDEX idx_products_premium ON products USING gin (attributes jsonb_path_ops)
  WHERE (attributes ->> 'tier') = 'premium';
```

## Query patterns

```sql
-- Containment (use with jsonb_path_ops GIN)
SELECT * FROM products WHERE attributes @> '{"brand": "Patagonia", "color": "blue"}';

-- Key exists (requires jsonb_ops GIN)
SELECT * FROM products WHERE attributes ? 'warranty_years';

-- Path extraction and cast
SELECT id, (attributes ->> 'rating')::int AS rating FROM products
WHERE (attributes ->> 'rating')::int >= 4;

-- JSON path (PG 12+) with GIN support via @@ and @?
SELECT * FROM products WHERE attributes @@ '$.reviews[*].rating >= 4';
SELECT * FROM products WHERE attributes @? '$.reviews ? (@.rating >= 4)';
```

## JSON_TABLE (PG 17+) — relationalize a document

Single biggest document-workload improvement since 9.4. Turns a JSONB structure into rows in one LATERAL join.

```sql
SELECT p.sku, r.reviewer, r.rating, r.comment
FROM products p,
     JSON_TABLE(p.attributes, '$.reviews[*]'
       COLUMNS (
         reviewer text PATH '$.user',
         rating   int  PATH '$.rating',
         comment  text PATH '$.comment' DEFAULT '' ON EMPTY
       )) r
WHERE p.tenant_id = $1;
```

## Constructors (PG 16+)

Use these instead of `jsonb_build_object` / `jsonb_build_array` for new code — they're SQL-standard.

```sql
SELECT JSON_OBJECT('sku' VALUE sku, 'price' VALUE price_cents),
       JSON_ARRAY(VALUES ('a'), ('b'), ('c'))
FROM products;

-- Validation predicate
SELECT * FROM imports WHERE payload IS JSON OBJECT;
```

## Storage and TOAST

JSONB values >2 KB get TOASTed (compressed + stored out-of-line). This is fine. But:

- **Every UPDATE to any field rewrites the entire JSONB value.** If you have a 100 KB document and update a single field, you write 100 KB + WAL. Design update patterns accordingly.
- TOAST compression is LZ4 by default (PG 14+), previously PGLZ. LZ4 is noticeably faster.
- Don't store binary blobs in JSONB. Use `bytea` or S3 + a reference.

## Anti-patterns

- **EAV in JSONB.** If you're storing `{"attribute_name": "color", "attribute_value": "blue"}`, stop. Use `{"color": "blue"}`. Better yet, add a column.
- **Nested arrays of objects for relational data.** Reviews, comments, line items → separate table. JSONB is not a substitute for a foreign key.
- **`jsonb_set` in a hot write path.** It rewrites the whole value. For frequent partial updates, split out the hot fields into columns.
- **Querying `WHERE jsonb_column -> 'field' = '"value"'`** — note the quoted value. Use `->> 'field' = 'value'` (text extraction) or `@> '{"field": "value"}'` (containment).
