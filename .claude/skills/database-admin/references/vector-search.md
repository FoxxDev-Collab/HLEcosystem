# Vector Search (pgvector, pgvectorscale, VectorChord)

## Extension selection

| Extension | Use when | Notes |
|---|---|---|
| **pgvector 0.8.x** | Default. 10k–10M vectors, simple needs | Widest managed-service support (RDS, Aurora, Neon, Supabase) |
| **pgvectorscale** (Timescale) | 10M–100M+ vectors, need StreamingDiskANN, filtered search | Requires pgvector; self-hosted or Timescale Cloud |
| **VectorChord** (TensorChord) | Very large indexes, 100× faster index build than pgvector | Newer, less managed-service support |
| Dedicated (Pinecone, Weaviate, Qdrant) | Multi-billion vectors, <10ms p99 at extreme scale | Probably overkill for most Postgres users |

**Current pgvector is 0.8.2 (CVE-2026-3172 patched, parallel HNSW fix). Upgrade if below 0.8.2.**

## Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  doc_id      uuid NOT NULL,
  chunk_idx   int  NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536) NOT NULL,    -- OpenAI text-embedding-3-small
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Supported types (pgvector 0.7+):
- `vector(N)` — 32-bit floats, most common
- `halfvec(N)` — 16-bit floats, ~50% size, slight accuracy loss
- `bit(N)` — binary, for extreme scale quantization
- `sparsevec(N)` — for sparse embeddings (SPLADE etc.)

## Distance operators

| Op | Distance | Use for |
|---|---|---|
| `<->` | L2 (Euclidean) | General purpose |
| `<=>` | Cosine | **Most common for text embeddings.** Normalize vectors first |
| `<#>` | Negative inner product | If vectors are normalized, equivalent to cosine and faster |

## Index types

### HNSW — default choice

Hierarchical Navigable Small World. Graph-based. Faster queries, slower build, higher memory.

```sql
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query-time recall/speed tradeoff
SET hnsw.ef_search = 40;  -- default 40, higher = more accurate, slower
```

Parameters:
- `m` (default 16): connections per layer. Higher = better recall, more memory.
- `ef_construction` (default 64): build-time search depth. Higher = better graph, slower build.
- `ef_search` (runtime): query-time search depth. Tune per query.

### IVFFlat — older, still useful

Inverted file with flat storage. Faster build, slower queries, lower memory. Needs data loaded before indexing (clusters on existing data).

```sql
-- Load data first, then:
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);   -- rule of thumb: rows / 1000 for <1M, sqrt(rows) for >1M

SET ivfflat.probes = 10;  -- query-time: how many lists to search
```

**Default to HNSW.** Use IVFFlat only when build time dominates (large static corpora, infrequent queries).

## Query pattern

```sql
-- Basic k-NN
SELECT id, content, 1 - (embedding <=> $1) AS similarity
FROM embeddings
ORDER BY embedding <=> $1
LIMIT 10;

-- Hybrid: vector + relational filter (the killer feature)
SELECT id, content, 1 - (embedding <=> $1) AS similarity
FROM embeddings
WHERE tenant_id = $2
  AND created_at > now() - interval '30 days'
ORDER BY embedding <=> $1
LIMIT 10;
```

**Hybrid filter is where Postgres beats dedicated vector DBs.** Pinecone requires pre-filtering metadata separately; in Postgres, the planner optimizes both in one query.

## Tuning for larger indexes

- **Build in parallel**: `SET max_parallel_maintenance_workers = 7;` before `CREATE INDEX`
- **Raise maintenance_work_mem**: HNSW build is memory-hungry. Set to several GB temporarily.
- **Avoid HNSW on tables under constant insert pressure with huge dimensions** — index maintenance cost climbs. Consider pgvectorscale's StreamingDiskANN which handles this better.

## pgvectorscale (Timescale)

Drop-in augmentation. StreamingDiskANN handles much larger indexes with better recall/memory ratio, plus:
- Statistical Binary Quantization (SBQ) — ~32× smaller index with minimal accuracy loss
- Label-based filtered search without index rebuild
- Outperforms pgvector on >10M vectors

```sql
CREATE EXTENSION vectorscale CASCADE;   -- pulls pgvector too
CREATE INDEX ON embeddings USING diskann (embedding);
```

## Anti-patterns

- **No index, then complaining it's slow.** Vector search without an index is a sequential scan of every vector.
- **Storing vectors without normalizing** when using cosine distance. Not required but makes `<#>` usable.
- **Using `vector(1536)` for everything when `halfvec(1536)` would save 50%** with negligible accuracy loss on most models.
- **Reindexing pgvector on every schema change** — use `CREATE INDEX CONCURRENTLY`.
- **Trying to store vectors in JSONB** — it works but throws away all indexing and distance operators. Use `vector`.
