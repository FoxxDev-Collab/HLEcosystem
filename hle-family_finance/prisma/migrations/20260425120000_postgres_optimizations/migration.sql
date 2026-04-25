-- ============================================================================
-- Migration: postgres_optimizations
-- Date: 2026-04-25
--
-- 1. Account balance trigger — replaces all manual account.update calls.
--    The trigger fires AFTER INSERT or DELETE on Transaction and adjusts
--    Account.currentBalance atomically, eliminating the bug class where
--    a process crash between transaction.create and account.update leaves
--    balances out of sync.
--
-- 2. process_due_recurring() PG function — replaces the JS Server Action
--    loop. Each iteration is atomic; the balance trigger handles all
--    balance effects.
--
-- 3. JSONB GIN index on AdvisorReport — enables fast key-level queries
--    inside the reportData blob without loading full records.
--
-- 4. Row-Level Security on Transaction and Account — permissive policy
--    that restricts rows to the current app.household_id session variable
--    when set, and falls through to allow when not set (backward compatible).
--    Use getScopedPrisma(householdId) from lib/prisma.ts to activate.
-- ============================================================================


-- ============================================================================
-- 1. ACCOUNT BALANCE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION family_finance.sync_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'INCOME' THEN
      UPDATE family_finance."Account"
        SET "currentBalance" = "currentBalance" + NEW.amount
        WHERE id = NEW."accountId";

    ELSIF NEW.type = 'EXPENSE' THEN
      UPDATE family_finance."Account"
        SET "currentBalance" = "currentBalance" - NEW.amount
        WHERE id = NEW."accountId";

    ELSIF NEW.type = 'TRANSFER' THEN
      UPDATE family_finance."Account"
        SET "currentBalance" = "currentBalance" - NEW.amount
        WHERE id = NEW."accountId";
      IF NEW."transferToAccountId" IS NOT NULL THEN
        UPDATE family_finance."Account"
          SET "currentBalance" = "currentBalance" + NEW.amount
          WHERE id = NEW."transferToAccountId";
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'INCOME' THEN
      UPDATE family_finance."Account"
        SET "currentBalance" = "currentBalance" - OLD.amount
        WHERE id = OLD."accountId";

    ELSIF OLD.type = 'EXPENSE' THEN
      UPDATE family_finance."Account"
        SET "currentBalance" = "currentBalance" + OLD.amount
        WHERE id = OLD."accountId";

    ELSIF OLD.type = 'TRANSFER' THEN
      UPDATE family_finance."Account"
        SET "currentBalance" = "currentBalance" + OLD.amount
        WHERE id = OLD."accountId";
      IF OLD."transferToAccountId" IS NOT NULL THEN
        UPDATE family_finance."Account"
          SET "currentBalance" = "currentBalance" - OLD.amount
          WHERE id = OLD."transferToAccountId";
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_balance_sync
  AFTER INSERT OR DELETE ON family_finance."Transaction"
  FOR EACH ROW
  EXECUTE FUNCTION family_finance.sync_account_balance();


-- ============================================================================
-- 2. PROCESS DUE RECURRING TRANSACTIONS — PG FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION family_finance.process_due_recurring(
  p_household_id TEXT,
  p_user_id      TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  rec               RECORD;
  v_next_occurrence DATE;
  v_days_in_month   INTEGER;
  v_count           INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT *
    FROM family_finance."RecurringTransaction"
    WHERE "householdId" = p_household_id
      AND "isActive"      = true
      AND "autoCreate"    = true
      AND "nextOccurrence" IS NOT NULL
      AND "nextOccurrence" <= CURRENT_DATE
    ORDER BY "nextOccurrence"
  LOOP
    -- Insert the generated transaction.
    -- The sync_account_balance trigger fires automatically on this INSERT,
    -- updating Account.currentBalance for the correct account(s).
    INSERT INTO family_finance."Transaction" (
      id,
      "householdId",
      "accountId",
      "categoryId",
      "transferToAccountId",
      "recurringTransactionId",
      type,
      amount,
      date,
      payee,
      description,
      "isReconciled",
      "isCleared",
      "isBalanceAdjustment",
      tags,
      "createdByUserId",
      "createdAt",
      "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      rec."householdId",
      rec."accountId",
      rec."categoryId",
      rec."transferToAccountId",
      rec.id,
      rec.type,
      rec.amount,
      rec."nextOccurrence",
      rec.payee,
      'Auto: ' || rec.name,
      false,
      false,
      false,
      ARRAY[]::text[],
      p_user_id,
      NOW(),
      NOW()
    );

    -- Advance nextOccurrence using the same rules as calculateNextOccurrence() in TS.
    v_next_occurrence := CASE rec.frequency
      WHEN 'DAILY'      THEN (rec."nextOccurrence" + (rec."frequencyInterval" || ' days')::INTERVAL)::DATE
      WHEN 'WEEKLY'     THEN (rec."nextOccurrence" + (rec."frequencyInterval" * 7 || ' days')::INTERVAL)::DATE
      WHEN 'BI_WEEKLY'  THEN (rec."nextOccurrence" + INTERVAL '14 days')::DATE
      WHEN 'MONTHLY'    THEN (rec."nextOccurrence" + (rec."frequencyInterval" || ' months')::INTERVAL)::DATE
      WHEN 'QUARTERLY'  THEN (rec."nextOccurrence" + INTERVAL '3 months')::DATE
      WHEN 'YEARLY'     THEN (rec."nextOccurrence" + (rec."frequencyInterval" || ' years')::INTERVAL)::DATE
      ELSE rec."nextOccurrence"
    END;

    -- Apply dayOfPeriod snapping for month-based frequencies.
    IF rec."dayOfPeriod" IS NOT NULL AND rec.frequency IN ('MONTHLY', 'QUARTERLY') THEN
      v_days_in_month := EXTRACT(DAY FROM (
        DATE_TRUNC('month', v_next_occurrence) + INTERVAL '1 month' - INTERVAL '1 day'
      ))::INTEGER;
      v_next_occurrence := (
        DATE_TRUNC('month', v_next_occurrence)::DATE +
        (LEAST(rec."dayOfPeriod", v_days_in_month) - 1)
      );
    END IF;

    -- Deactivate if past end date; otherwise advance.
    IF rec."endDate" IS NOT NULL AND v_next_occurrence > rec."endDate" THEN
      UPDATE family_finance."RecurringTransaction"
        SET "isActive"       = false,
            "nextOccurrence" = NULL,
            "lastProcessed"  = rec."nextOccurrence",
            "updatedAt"      = NOW()
        WHERE id = rec.id;
    ELSE
      UPDATE family_finance."RecurringTransaction"
        SET "nextOccurrence" = v_next_occurrence,
            "lastProcessed"  = rec."nextOccurrence",
            "updatedAt"      = NOW()
        WHERE id = rec.id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 3. JSONB GIN INDEX ON AdvisorReport
-- ============================================================================

CREATE INDEX "AdvisorReport_reportData_gin_idx"
  ON family_finance."AdvisorReport" USING gin ("reportData");


-- ============================================================================
-- 4. ROW-LEVEL SECURITY
--
-- Permissive policy: when app.household_id is set in the session,
-- only rows matching that householdId are visible/mutable. When not set
-- (existing code paths that predate RLS adoption), all rows pass through.
--
-- To activate strict enforcement for a request, call getScopedPrisma()
-- from lib/prisma.ts. As all Server Actions migrate to that helper, the
-- fallback clauses can be removed and RLS becomes mandatory.
-- ============================================================================

ALTER TABLE family_finance."Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_finance."Account"     ENABLE ROW LEVEL SECURITY;

CREATE POLICY household_rls ON family_finance."Transaction"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.household_id', true) IS NULL
    OR current_setting('app.household_id', true) = ''
    OR "householdId" = current_setting('app.household_id', true)
  );

CREATE POLICY household_rls ON family_finance."Account"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.household_id', true) IS NULL
    OR current_setting('app.household_id', true) = ''
    OR "householdId" = current_setting('app.household_id', true)
  );
