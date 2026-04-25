-- pg_trgm is already installed in public schema by the previous migration attempt.
-- Ensure it exists (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

-- Covering index for Transaction aggregation queries.
-- Carries amount, type, categoryId in the leaf so reports/advisor/budgets
-- can do Index Only Scans without touching the heap.
CREATE INDEX IF NOT EXISTS "Transaction_householdId_date_covering_idx"
  ON family_finance."Transaction" ("householdId", date DESC)
  INCLUDE (amount, type, "categoryId");

-- Trigram GIN indexes — schema-qualified operator class because Prisma
-- runs migrations with search_path=family_finance, not public.
-- Enables ILIKE '%pattern%' to use index lookups instead of a full scan.
CREATE INDEX IF NOT EXISTS "Transaction_payee_trgm_idx"
  ON family_finance."Transaction" USING gin (payee public.gin_trgm_ops)
  WHERE payee IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Transaction_description_trgm_idx"
  ON family_finance."Transaction" USING gin (description public.gin_trgm_ops)
  WHERE description IS NOT NULL;
