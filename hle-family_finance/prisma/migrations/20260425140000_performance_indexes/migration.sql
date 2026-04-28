-- Widen search_path so gin_trgm_ops is visible without schema qualification
-- in the CREATE INDEX statements below. Prisma sets search_path=family_finance
-- at the connection level; this SET persists for the duration of this
-- migration transaction.
SET search_path TO public, family_finance;

-- SCHEMA public is explicit so the extension lands in public regardless of
-- the active search_path or whether another app's migration already installed
-- pg_trgm into a different schema. Without this, IF NOT EXISTS would silently
-- skip installing into public if pg_trgm exists elsewhere, and gin_trgm_ops
-- would not resolve via the search_path set above.
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

-- Covering index: carries amount, type, categoryId in the leaf so reports,
-- budgets, and advisor queries can do Index Only Scans without heap fetches.
CREATE INDEX IF NOT EXISTS "Transaction_householdId_date_covering_idx"
  ON family_finance."Transaction" ("householdId", date DESC)
  INCLUDE (amount, type, "categoryId");

-- Trigram GIN indexes — enables ILIKE '%pattern%' to hit the index instead
-- of scanning every row. Partial: only index non-null values.
CREATE INDEX IF NOT EXISTS "Transaction_payee_trgm_idx"
  ON family_finance."Transaction" USING gin (payee gin_trgm_ops)
  WHERE payee IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Transaction_description_trgm_idx"
  ON family_finance."Transaction" USING gin (description gin_trgm_ops)
  WHERE description IS NOT NULL;
