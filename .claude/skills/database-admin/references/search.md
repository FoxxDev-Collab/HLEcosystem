# Full-Text Search

## Three tiers

| Tier | Use when | Trade-off |
|---|---|---|
| **Native `tsvector`/`tsquery`** | Basic FTS, <10M docs, OK with tsrank | Free, no extension; no BM25, limited ranking |
| **pg_trgm** | Fuzzy match, typo tolerance, unanchored LIKE | Complements other tiers |
| **pg_search (ParadeDB)** | Need BM25, phrase queries, snippets, facets | Extension required; Tantivy-based |
| **Elasticsearch / OpenSearch** | Distributed, multi-language analyzers, percolator, logs | Second datastore, operational cost |

**Start with native + pg_trgm. Add pg_search when ranking quality matters. Only graduate to Elasticsearch for a specific capability gap.**

## Native FTS

### The generated column pattern

Don't maintain a tsvector by trigger — use a generated column (PG 12+):

```sql
CREATE TABLE articles (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  title       text NOT NULL,
  body        text NOT NULL,
  search_vec  tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')),  'B')
  ) STORED
);

CREATE INDEX idx_articles_search ON articles USING gin (search_vec);
```

### Querying

```sql
-- websearch_to_tsquery handles Google-style input: "foo bar" -baz OR qux
SELECT id, title, ts_rank_cd(search_vec, query) AS rank
FROM articles, websearch_to_tsquery('english', 'postgres replication') query
WHERE search_vec @@ query
ORDER BY rank DESC
LIMIT 20;
```

Use `websearch_to_tsquery` for end-user input. `plainto_tsquery` is tolerant but loses operators. `to_tsquery` is strict — it throws on bad syntax.

### Ranking

- `ts_rank(vec, query)` — ranks by word frequency
- `ts_rank_cd(vec, query)` — ranks by word frequency and proximity (cover density). Usually better.
- Weight your vectors (`setweight(..., 'A')` etc.) so titles outrank body.

### GIN vs GiST for FTS

- **GIN**: larger, slower build, faster reads. **Default for FTS.**
- **GiST**: smaller, faster build, lossy (always rechecks). Use only for frequently-updated documents.

## pg_trgm — fuzzy and typo tolerance

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN for LIKE/ILIKE with leading wildcards
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Now this uses the index:
SELECT * FROM products WHERE name ILIKE '%patago%';

-- Similarity / typo tolerance
SELECT name, similarity(name, 'postgrss') AS sim
FROM products
WHERE name % 'postgrss'          -- default similarity threshold 0.3
ORDER BY sim DESC LIMIT 10;

-- Tune threshold per session
SET pg_trgm.similarity_threshold = 0.4;
```

`gist_trgm_ops` exists but is almost always worse than `gin_trgm_ops` for text search.

## pg_search (ParadeDB) — BM25 in Postgres

Use when native FTS ranking quality is not enough. Tantivy-based (same engine family as Elasticsearch's Lucene), custom index AM, `@@@` operator.

```sql
CREATE EXTENSION pg_search;

CREATE INDEX search_idx ON articles
  USING bm25 (id, title, body)
  WITH (key_field='id');

-- BM25 query
SELECT id, title, paradedb.score(id) AS score
FROM articles
WHERE title @@@ 'postgres' OR body @@@ 'postgres'
ORDER BY score DESC LIMIT 20;

-- Phrase, fuzzy, boosted
SELECT * FROM articles
WHERE id @@@ paradedb.boolean(must => ARRAY[
  paradedb.phrase('title', ARRAY['row', 'level', 'security']),
  paradedb.fuzzy_term('body', 'replicaton', distance => 2)
]);
```

Availability: self-hosted, ParadeDB Cloud, Neon (deprecated for new projects March 2026). Not on RDS.

## Hybrid: FTS + vector

If you have pg_search and pgvector, combine via Reciprocal Rank Fusion (RRF):

```sql
WITH bm25 AS (
  SELECT id, paradedb.score(id) AS s, row_number() OVER (ORDER BY paradedb.score(id) DESC) AS r
  FROM articles WHERE body @@@ 'user query' LIMIT 100
),
sem AS (
  SELECT id, 1 - (embedding <=> $1) AS s,
         row_number() OVER (ORDER BY embedding <=> $1) AS r
  FROM articles ORDER BY embedding <=> $1 LIMIT 100
)
SELECT COALESCE(bm25.id, sem.id) AS id,
       (COALESCE(1.0/(60+bm25.r), 0) + COALESCE(1.0/(60+sem.r), 0)) AS rrf_score
FROM bm25 FULL OUTER JOIN sem USING (id)
ORDER BY rrf_score DESC LIMIT 20;
```

## Anti-patterns

- Indexing a `tsvector` that's recomputed by the query — always store or generate it.
- Running `to_tsvector(body) @@ to_tsquery($1)` without a generated column — Postgres can't use the GIN index on a function call result unless it matches the index expression exactly.
- Falling back to `ILIKE '%foo%'` without `pg_trgm` — full table scan.
- Adding Elasticsearch because "search is hard" without trying pg_trgm + pg_search first.
