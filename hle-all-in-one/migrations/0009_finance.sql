-- Finance module: accounts, transactions, recurring transactions, categories +
-- auto-categorization rules, monthly budgets, budget planner projects, assets
-- & net worth, debts & payoff, monthly bills, tax tracking, bank import,
-- wishlists, AI advisor reports, smart-link patterns, trip expense tracker.
-- Ported from hle-family_finance/prisma/schema.prisma plus the two raw-SQL
-- legacy migrations 20260425120000_postgres_optimizations (balance trigger,
-- process_due_recurring) and 20260425140000_performance_indexes (covering +
-- trigram indexes).
--
-- Legacy source models (24): Account, Transaction, RecurringTransaction,
-- Category, CategoryRule, Budget, BudgetPlannerProject, BudgetPlannerItem,
-- Asset, AssetValueHistory, Debt, DebtPayment, MonthlyBill, BillPayment,
-- TaxYear, TaxDocument, ImportBatch, ImportedTransaction, Wishlist,
-- WishlistItem, AdvisorReport, TransactionLinkPattern, Trip, TripExpense.
--
-- Renames (collisions with already-ported modules):
--   Trip                 -> "FinanceTrip"            (travel owns "Trip", 0006)
--   TripExpense          -> "FinanceTripExpense"     (paired with FinanceTrip)
--   enum TripStatus      -> "FinanceTripStatus"      (travel owns "TripStatus", 0006)
--   enum TripExpenseType -> "FinanceTripExpenseType" (paired)
-- The plain names "Category" and "Budget"/"BudgetPlannerItem" are collision
-- free by prior reservation: meals renamed its Category -> ProductCategory
-- (0005) and travel renamed BudgetItem/Currency -> TravelBudgetItem/
-- TravelCurrency (0006). Finance has no "Document" or "Currency" table.
--
-- Differences from legacy:
-- * UUID PKs (greenfield convention); real FKs to "User"/"Household" now that
--   everything lives in one database.
-- * Money columns are NUMERIC(14,2) (legacy used 18,2); rates stay
--   NUMERIC(6,4); "householdId" UUID NOT NULL CASCADE on every tenant table.
-- * "createdByUserId" / "importedByUserId" (legacy free-text ids pointing at
--   family_manager."User") become nullable UUID FKs to "User" ON DELETE SET
--   NULL ("importedByUserId" was NOT NULL in legacy — relaxed so deleting a
--   user never breaks import history).
-- * Transaction."accountId" intentionally has NO ON DELETE action: account
--   deletion is an explicit server-layer cascade (legacy deleteAccountAction
--   semantics), and a DB-level cascade would race the balance-sync trigger.
-- * Legacy RLS policies on Transaction/Account are NOT ported — tenancy is
--   enforced by householdMiddleware + scoped WHERE clauses (house convention).
-- * Account."currentBalance" is maintained by the sync_account_balance()
--   trigger on Transaction INSERT/DELETE (ported below, public schema). The
--   server layer must NEVER update balances directly for normal transactions
--   (the ADR-0005 regression test depends on this).

CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

CREATE TYPE "AccountType" AS ENUM (
  'CHECKING','SAVINGS','CREDIT_CARD','CASH','INVESTMENT','LOAN','HSA','OTHER'
);
CREATE TYPE "TransactionType" AS ENUM ('INCOME','EXPENSE','TRANSFER');
CREATE TYPE "CategoryType" AS ENUM ('INCOME','EXPENSE','TRANSFER');
CREATE TYPE "DebtType" AS ENUM (
  'MORTGAGE','AUTO_LOAN','STUDENT_LOAN','PERSONAL_LOAN','HELOC',
  'CREDIT_CARD','MEDICAL_DEBT','OTHER'
);
CREATE TYPE "AssetType" AS ENUM (
  'REAL_ESTATE','VEHICLE','JEWELRY','ELECTRONICS','COLLECTIBLES',
  'RETIREMENT','INVESTMENT','OTHER'
);
CREATE TYPE "BudgetPlannerProjectStatus" AS ENUM ('PLANNING','ACTIVE','COMPLETED','CANCELLED');
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY','WEEKLY','BI_WEEKLY','MONTHLY','QUARTERLY','YEARLY');
CREATE TYPE "BillCategory" AS ENUM (
  'UTILITIES','INSURANCE','SUBSCRIPTIONS','PHONE','INTERNET','RENT',
  'MORTGAGE','CAR_PAYMENT','CHILD_CARE','STREAMING','OTHER'
);
CREATE TYPE "BillPaymentStatus" AS ENUM ('PENDING','PAID','OVERDUE','SCHEDULED');
CREATE TYPE "CategoryRuleMatchType" AS ENUM ('CONTAINS','STARTS_WITH','EXACT','REGEX');
CREATE TYPE "TaxDocumentType" AS ENUM (
  'W2','FORM_1099_INT','FORM_1099_DIV','FORM_1099_NEC','FORM_1098',
  'FORM_1099_B','FORM_1099_R','K1','FORM_1099_SA','FORM_5498_SA','OTHER'
);
CREATE TYPE "TaxFilingStatus" AS ENUM (
  'SINGLE','MARRIED_FILING_JOINTLY','MARRIED_FILING_SEPARATELY',
  'HEAD_OF_HOUSEHOLD','QUALIFYING_WIDOWER'
);
CREATE TYPE "ImportFileFormat" AS ENUM ('CSV','QFX','OFX');
CREATE TYPE "ImportMatchStatus" AS ENUM ('PENDING','AUTO_MATCHED','IMPORTED','SKIPPED','DUPLICATE');
-- Renamed from legacy TripStatus / TripExpenseType (travel owns "TripStatus").
CREATE TYPE "FinanceTripStatus" AS ENUM ('PLANNING','ACTIVE','COMPLETED','CANCELLED');
CREATE TYPE "FinanceTripExpenseType" AS ENUM ('GAS','FOOD','LODGING','TRANSPORT','SUPPLIES','OTHER');

-- ============================================================================
-- ACCOUNTS, CATEGORIES, TRANSACTIONS
-- ============================================================================

CREATE TABLE "Account" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"        UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"               TEXT NOT NULL,
  "type"               "AccountType" NOT NULL,
  "institution"        TEXT,
  "accountNumberLast4" TEXT,
  "initialBalance"     NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Maintained by the sync_account_balance() trigger; never updated directly
  -- for normal transactions (ADR-0005 regression test relies on this).
  "currentBalance"     NUMERIC(14,2) NOT NULL DEFAULT 0,
  "creditLimit"        NUMERIC(14,2),
  "interestRate"       NUMERIC(6,4),
  "hsaAnnualLimit"     NUMERIC(14,2),
  "hsaFamilyCoverage"  BOOLEAN NOT NULL DEFAULT false,
  "currency"           TEXT NOT NULL DEFAULT 'USD',
  "notes"              TEXT,
  "color"              TEXT,
  "icon"               TEXT,
  "isArchived"         BOOLEAN NOT NULL DEFAULT false,
  "includeInNetWorth"  BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"          INT NOT NULL DEFAULT 0,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Account_householdId_idx" ON "Account" ("householdId");

-- Hierarchical income/expense categories (one level of nesting via
-- parentCategoryId). NULLs are distinct in the unique constraint, matching
-- legacy Prisma behavior for top-level categories.
CREATE TABLE "Category" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"         UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "parentCategoryId"    UUID REFERENCES "Category"("id") ON DELETE SET NULL,
  "name"                TEXT NOT NULL,
  "type"                "CategoryType" NOT NULL,
  "icon"                TEXT,
  "color"               TEXT,
  "defaultBudgetAmount" NUMERIC(14,2),
  "sortOrder"           INT NOT NULL DEFAULT 0,
  "isArchived"          BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "name", "parentCategoryId")
);
CREATE INDEX "Category_householdId_idx" ON "Category" ("householdId");
CREATE INDEX "Category_parentCategoryId_idx" ON "Category" ("parentCategoryId");

CREATE TABLE "RecurringTransaction" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"         UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "accountId"           UUID NOT NULL REFERENCES "Account"("id"),
  "categoryId"          UUID REFERENCES "Category"("id") ON DELETE SET NULL,
  "transferToAccountId" UUID REFERENCES "Account"("id") ON DELETE SET NULL,
  "name"                TEXT NOT NULL,
  "type"                "TransactionType" NOT NULL,
  "amount"              NUMERIC(14,2) NOT NULL,
  "payee"               TEXT,
  "description"         TEXT,
  "frequency"           "RecurrenceFrequency" NOT NULL,
  "frequencyInterval"   INT NOT NULL DEFAULT 1,
  "dayOfPeriod"         INT, -- day of month/week
  "startDate"           DATE NOT NULL,
  "endDate"             DATE,
  "nextOccurrence"      DATE,
  "lastProcessed"       DATE,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "autoCreate"          BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "RecurringTransaction_householdId_isActive_nextOccurrence_idx"
  ON "RecurringTransaction" ("householdId", "isActive", "nextOccurrence");
CREATE INDEX "RecurringTransaction_accountId_idx" ON "RecurringTransaction" ("accountId");
CREATE INDEX "RecurringTransaction_categoryId_idx" ON "RecurringTransaction" ("categoryId");
CREATE INDEX "RecurringTransaction_transferToAccountId_idx" ON "RecurringTransaction" ("transferToAccountId");

CREATE TABLE "Transaction" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"            UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  -- No ON DELETE action: account deletion is an explicit server-layer cascade.
  "accountId"              UUID NOT NULL REFERENCES "Account"("id"),
  "categoryId"             UUID REFERENCES "Category"("id") ON DELETE SET NULL,
  "transferToAccountId"    UUID REFERENCES "Account"("id"),
  -- The mirrored leg of a TRANSFER pair (1:1).
  "linkedTransactionId"    UUID UNIQUE REFERENCES "Transaction"("id") ON DELETE SET NULL,
  "recurringTransactionId" UUID REFERENCES "RecurringTransaction"("id") ON DELETE SET NULL,
  "type"                   "TransactionType" NOT NULL,
  "amount"                 NUMERIC(14,2) NOT NULL,
  "date"                   DATE NOT NULL,
  "payee"                  TEXT,
  "description"            TEXT,
  "isReconciled"           BOOLEAN NOT NULL DEFAULT false,
  "isCleared"              BOOLEAN NOT NULL DEFAULT false,
  "isBalanceAdjustment"    BOOLEAN NOT NULL DEFAULT false,
  "tags"                   TEXT[] NOT NULL DEFAULT '{}',
  "externalId"             TEXT, -- bank import duplicate detection
  "createdByUserId"        UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Covering index (from legacy performance_indexes migration): reports,
-- budgets, and advisor sums hit Index Only Scans.
CREATE INDEX "Transaction_householdId_date_covering_idx"
  ON "Transaction" ("householdId", "date" DESC)
  INCLUDE ("amount", "type", "categoryId");
CREATE INDEX "Transaction_accountId_idx" ON "Transaction" ("accountId");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction" ("categoryId");
CREATE INDEX "Transaction_transferToAccountId_idx" ON "Transaction" ("transferToAccountId");
CREATE INDEX "Transaction_recurringTransactionId_idx" ON "Transaction" ("recurringTransactionId");
CREATE INDEX "Transaction_externalId_idx" ON "Transaction" ("externalId");
-- Trigram indexes so payee/description ILIKE '%x%' searches stay indexed.
CREATE INDEX "Transaction_payee_trgm_idx"
  ON "Transaction" USING gin ("payee" gin_trgm_ops) WHERE "payee" IS NOT NULL;
CREATE INDEX "Transaction_description_trgm_idx"
  ON "Transaction" USING gin ("description" gin_trgm_ops) WHERE "description" IS NOT NULL;

-- Auto-categorization rules applied during bank import / bulk categorize.
CREATE TABLE "CategoryRule" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"   UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "pattern"       TEXT NOT NULL,
  "matchType"     "CategoryRuleMatchType" NOT NULL,
  "categoryId"    UUID NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE,
  "assignPayee"   TEXT,
  "priority"      INT NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "matchCount"    INT NOT NULL DEFAULT 0,
  "lastMatchedAt" TIMESTAMPTZ,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "CategoryRule_householdId_isActive_idx" ON "CategoryRule" ("householdId", "isActive");
CREATE INDEX "CategoryRule_categoryId_idx" ON "CategoryRule" ("categoryId");

-- ============================================================================
-- BUDGETS
-- ============================================================================

-- Per-category monthly budget envelope.
CREATE TABLE "Budget" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "categoryId"  UUID NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE,
  "year"        INT NOT NULL,
  "month"       INT NOT NULL, -- 1-12
  "amount"      NUMERIC(14,2) NOT NULL,
  "notes"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "categoryId", "year", "month")
);
CREATE INDEX "Budget_categoryId_idx" ON "Budget" ("categoryId");

-- One-off purchase/project planner (line items, not tied to transactions).
CREATE TABLE "BudgetPlannerProject" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "status"      "BudgetPlannerProjectStatus" NOT NULL DEFAULT 'PLANNING',
  "targetDate"  DATE,
  "totalCost"   NUMERIC(14,2) NOT NULL DEFAULT 0,
  "icon"        TEXT,
  "color"       TEXT,
  "notes"       TEXT,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "BudgetPlannerProject_householdId_idx" ON "BudgetPlannerProject" ("householdId");

CREATE TABLE "BudgetPlannerItem" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId"    UUID NOT NULL REFERENCES "BudgetPlannerProject"("id") ON DELETE CASCADE,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "quantity"     INT NOT NULL DEFAULT 1,
  "unitCost"     NUMERIC(14,2) NOT NULL,
  "lineTotal"    NUMERIC(14,2) NOT NULL,
  "sortOrder"    INT NOT NULL DEFAULT 0,
  "isPurchased"  BOOLEAN NOT NULL DEFAULT false,
  "referenceUrl" TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "BudgetPlannerItem_projectId_idx" ON "BudgetPlannerItem" ("projectId");

-- ============================================================================
-- DEBTS & LIABILITIES
-- ============================================================================

CREATE TABLE "Debt" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"        UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "type"               "DebtType" NOT NULL,
  "name"               TEXT NOT NULL,
  "lender"             TEXT,
  "accountNumberLast4" TEXT,
  "originalPrincipal"  NUMERIC(14,2) NOT NULL,
  "currentBalance"     NUMERIC(14,2) NOT NULL,
  "interestRate"       NUMERIC(6,4) NOT NULL,
  "termMonths"         INT,
  "minimumPayment"     NUMERIC(14,2),
  "paymentDayOfMonth"  INT,
  "originationDate"    DATE,
  "expectedPayoffDate" DATE,
  "linkedAccountId"    UUID REFERENCES "Account"("id") ON DELETE SET NULL,
  "icon"               TEXT,
  "color"              TEXT,
  "includeInNetWorth"  BOOLEAN NOT NULL DEFAULT true,
  "notes"              TEXT,
  "isArchived"         BOOLEAN NOT NULL DEFAULT false,
  "refinancedFromId"   UUID REFERENCES "Debt"("id") ON DELETE SET NULL,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Debt_householdId_idx" ON "Debt" ("householdId");
CREATE INDEX "Debt_linkedAccountId_idx" ON "Debt" ("linkedAccountId");
CREATE INDEX "Debt_refinancedFromId_idx" ON "Debt" ("refinancedFromId");

CREATE TABLE "DebtPayment" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "debtId"              UUID NOT NULL REFERENCES "Debt"("id") ON DELETE CASCADE,
  "paymentDate"         DATE NOT NULL,
  "totalAmount"         NUMERIC(14,2) NOT NULL,
  "principalAmount"     NUMERIC(14,2) NOT NULL DEFAULT 0,
  "interestAmount"      NUMERIC(14,2) NOT NULL DEFAULT 0,
  "escrowAmount"        NUMERIC(14,2) NOT NULL DEFAULT 0,
  "extraPrincipal"      NUMERIC(14,2) NOT NULL DEFAULT 0,
  "remainingBalance"    NUMERIC(14,2),
  "linkedTransactionId" UUID REFERENCES "Transaction"("id") ON DELETE SET NULL,
  "notes"               TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "DebtPayment_debtId_paymentDate_idx" ON "DebtPayment" ("debtId", "paymentDate");
CREATE INDEX "DebtPayment_linkedTransactionId_idx" ON "DebtPayment" ("linkedTransactionId");

-- ============================================================================
-- ASSETS & NET WORTH
-- ============================================================================

CREATE TABLE "Asset" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"       UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "type"              "AssetType" NOT NULL,
  "name"              TEXT NOT NULL,
  "purchasePrice"     NUMERIC(14,2),
  "purchaseDate"      DATE,
  "currentValue"      NUMERIC(14,2) NOT NULL DEFAULT 0,
  "valueAsOfDate"     DATE,
  -- Real estate
  "address"           TEXT,
  "city"              TEXT,
  "state"             TEXT,
  "zipCode"           TEXT,
  "squareFootage"     INT,
  "yearBuilt"         INT,
  "propertyTaxAnnual" NUMERIC(14,2),
  -- Vehicle
  "make"              TEXT,
  "model"             TEXT,
  "vehicleYear"       INT,
  "vin"               TEXT,
  "mileage"           INT,
  "licensePlate"      TEXT,
  -- Sold workflow
  "isSold"            BOOLEAN NOT NULL DEFAULT false,
  "soldPrice"         NUMERIC(14,2),
  "soldDate"          DATE,
  -- Common
  "linkedDebtId"      UUID REFERENCES "Debt"("id") ON DELETE SET NULL,
  "icon"              TEXT,
  "color"             TEXT,
  "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
  "notes"             TEXT,
  "isArchived"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Asset_householdId_idx" ON "Asset" ("householdId");
CREATE INDEX "Asset_linkedDebtId_idx" ON "Asset" ("linkedDebtId");

CREATE TABLE "AssetValueHistory" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "assetId"   UUID NOT NULL REFERENCES "Asset"("id") ON DELETE CASCADE,
  "date"      DATE NOT NULL,
  "value"     NUMERIC(14,2) NOT NULL,
  "source"    TEXT, -- "manual", "zillow", "kbb", ...
  "notes"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "AssetValueHistory_assetId_date_idx" ON "AssetValueHistory" ("assetId", "date");

-- ============================================================================
-- MONTHLY BILLS
-- ============================================================================

CREATE TABLE "MonthlyBill" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"       UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"              TEXT NOT NULL,
  "payee"             TEXT,
  "category"          "BillCategory" NOT NULL DEFAULT 'OTHER',
  "expectedAmount"    NUMERIC(14,2) NOT NULL,
  "isVariableAmount"  BOOLEAN NOT NULL DEFAULT false,
  "dueDayOfMonth"     INT NOT NULL,
  "autoPay"           BOOLEAN NOT NULL DEFAULT false,
  "autoPayAccountId"  UUID REFERENCES "Account"("id") ON DELETE SET NULL,
  "linkedDebtId"      UUID REFERENCES "Debt"("id") ON DELETE SET NULL,
  "defaultCategoryId" UUID REFERENCES "Category"("id") ON DELETE SET NULL,
  "icon"              TEXT,
  "color"             TEXT,
  "websiteUrl"        TEXT,
  "notes"             TEXT,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "MonthlyBill_householdId_idx" ON "MonthlyBill" ("householdId");
CREATE INDEX "MonthlyBill_autoPayAccountId_idx" ON "MonthlyBill" ("autoPayAccountId");
CREATE INDEX "MonthlyBill_linkedDebtId_idx" ON "MonthlyBill" ("linkedDebtId");
CREATE INDEX "MonthlyBill_defaultCategoryId_idx" ON "MonthlyBill" ("defaultCategoryId");

CREATE TABLE "BillPayment" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "monthlyBillId"       UUID NOT NULL REFERENCES "MonthlyBill"("id") ON DELETE CASCADE,
  "dueDate"             DATE NOT NULL,
  "paidDate"            DATE,
  "amountDue"           NUMERIC(14,2) NOT NULL,
  "amountPaid"          NUMERIC(14,2),
  "status"              "BillPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "linkedTransactionId" UUID REFERENCES "Transaction"("id") ON DELETE SET NULL,
  "confirmationNumber"  TEXT,
  "notes"               TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "BillPayment_monthlyBillId_dueDate_idx" ON "BillPayment" ("monthlyBillId", "dueDate");
CREATE INDEX "BillPayment_linkedTransactionId_idx" ON "BillPayment" ("linkedTransactionId");

-- ============================================================================
-- TAX TRACKING
-- ============================================================================

CREATE TABLE "TaxYear" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"         UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "year"                INT NOT NULL,
  "federalFilingStatus" "TaxFilingStatus",
  "state"               TEXT,
  "isFederalFiled"      BOOLEAN NOT NULL DEFAULT false,
  "federalFiledDate"    DATE,
  "isStateFiled"        BOOLEAN NOT NULL DEFAULT false,
  "stateFiledDate"      DATE,
  "federalRefund"       NUMERIC(14,2),
  "stateRefund"         NUMERIC(14,2),
  "federalOwed"         NUMERIC(14,2),
  "stateOwed"           NUMERIC(14,2),
  "refundReceived"      BOOLEAN NOT NULL DEFAULT false,
  "refundReceivedDate"  DATE,
  "federalOwedPaid"     BOOLEAN NOT NULL DEFAULT false,
  "stateOwedPaid"       BOOLEAN NOT NULL DEFAULT false,
  "notes"               TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "year")
);

-- No collision: home care owns "Document" (0004); this stays "TaxDocument".
CREATE TABLE "TaxDocument" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taxYearId"              UUID NOT NULL REFERENCES "TaxYear"("id") ON DELETE CASCADE,
  "documentType"           "TaxDocumentType" NOT NULL,
  "issuer"                 TEXT NOT NULL,
  "description"            TEXT,
  "grossAmount"            NUMERIC(14,2),
  "federalWithheld"        NUMERIC(14,2),
  "stateWithheld"          NUMERIC(14,2),
  "socialSecurityWithheld" NUMERIC(14,2),
  "medicareWithheld"       NUMERIC(14,2),
  "isReceived"             BOOLEAN NOT NULL DEFAULT false,
  "receivedDate"           DATE,
  "expectedDate"           DATE,
  "notes"                  TEXT,
  -- Uploaded file (goes through src/server/file-storage.ts in the monolith)
  "uploadedFileName"       TEXT,
  "storagePath"            TEXT,
  "fileSize"               INT,
  "contentHash"            TEXT,
  "uploadedAt"             TIMESTAMPTZ,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TaxDocument_taxYearId_idx" ON "TaxDocument" ("taxYearId");

-- ============================================================================
-- BANK IMPORT
-- ============================================================================

CREATE TABLE "ImportBatch" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"      UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "accountId"        UUID NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
  "fileName"         TEXT NOT NULL,
  "format"           "ImportFileFormat" NOT NULL,
  "importedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Legacy: NOT NULL text id into family_manager."User"; relaxed to a real
  -- nullable FK so deleting a user keeps import history.
  "importedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "totalRows"        INT NOT NULL DEFAULT 0,
  "importedCount"    INT NOT NULL DEFAULT 0,
  "duplicateCount"   INT NOT NULL DEFAULT 0,
  "skippedCount"     INT NOT NULL DEFAULT 0,
  "isFinalized"      BOOLEAN NOT NULL DEFAULT false,
  "notes"            TEXT
);
CREATE INDEX "ImportBatch_householdId_idx" ON "ImportBatch" ("householdId");
CREATE INDEX "ImportBatch_accountId_idx" ON "ImportBatch" ("accountId");

CREATE TABLE "ImportedTransaction" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "importBatchId"        UUID NOT NULL REFERENCES "ImportBatch"("id") ON DELETE CASCADE,
  "date"                 DATE NOT NULL,
  "amount"               NUMERIC(14,2) NOT NULL,
  "description"          TEXT,
  "payee"                TEXT,
  "checkNumber"          TEXT,
  "referenceNumber"      TEXT,
  "rawData"              TEXT, -- original CSV/OFX line
  "matchStatus"          "ImportMatchStatus" NOT NULL DEFAULT 'PENDING',
  "matchedTransactionId" UUID REFERENCES "Transaction"("id") ON DELETE SET NULL,
  "suggestedCategoryId"  UUID REFERENCES "Category"("id") ON DELETE SET NULL,
  "createdTransactionId" UUID REFERENCES "Transaction"("id") ON DELETE SET NULL,
  "notes"                TEXT,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ImportedTransaction_importBatchId_idx" ON "ImportedTransaction" ("importBatchId");
CREATE INDEX "ImportedTransaction_matchedTransactionId_idx" ON "ImportedTransaction" ("matchedTransactionId");
CREATE INDEX "ImportedTransaction_suggestedCategoryId_idx" ON "ImportedTransaction" ("suggestedCategoryId");
CREATE INDEX "ImportedTransaction_createdTransactionId_idx" ON "ImportedTransaction" ("createdTransactionId");

-- ============================================================================
-- WISHLISTS
-- ============================================================================

CREATE TABLE "Wishlist" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Wishlist_householdId_idx" ON "Wishlist" ("householdId");

CREATE TABLE "WishlistItem" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "wishlistId"  UUID NOT NULL REFERENCES "Wishlist"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "lowPrice"    NUMERIC(14,2),
  "highPrice"   NUMERIC(14,2),
  "url"         TEXT,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "isPurchased" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "WishlistItem_wishlistId_idx" ON "WishlistItem" ("wishlistId");

-- ============================================================================
-- AI ADVISOR & SMART-LINK PATTERNS
-- ============================================================================

CREATE TABLE "AdvisorReport" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "reportData"  JSONB NOT NULL,
  "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "AdvisorReport_householdId_generatedAt_idx"
  ON "AdvisorReport" ("householdId", "generatedAt" DESC);
CREATE INDEX "AdvisorReport_reportData_gin_idx" ON "AdvisorReport" USING gin ("reportData");

-- Learned payee -> debt/bill/recurring associations used by smart-link.
-- "matchId" stays an untyped UUID-ish text because it points at one of three
-- tables depending on "matchType" ('debt' | 'bill' | 'recurring').
CREATE TABLE "TransactionLinkPattern" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"  UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "payeePattern" TEXT NOT NULL,
  "matchType"    TEXT NOT NULL, -- 'debt' | 'bill' | 'recurring'
  "matchId"      TEXT NOT NULL,
  "matchName"    TEXT NOT NULL,
  "confidence"   DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "usageCount"   INT NOT NULL DEFAULT 1,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "payeePattern", "matchType")
);

-- ============================================================================
-- TRIP EXPENSE TRACKER (renamed: travel owns "Trip"/"TripStatus" in 0006)
-- ============================================================================

CREATE TABLE "FinanceTrip" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"            UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"                   TEXT NOT NULL,
  "description"            TEXT,
  "destination"            TEXT,
  "startDate"              DATE NOT NULL,
  "endDate"                DATE NOT NULL,
  "status"                 "FinanceTripStatus" NOT NULL DEFAULT 'ACTIVE',
  "isTaxDeductible"        BOOLEAN NOT NULL DEFAULT false,
  "taxPurpose"             TEXT,
  "budgetPlannerProjectId" UUID REFERENCES "BudgetPlannerProject"("id") ON DELETE SET NULL,
  "notes"                  TEXT,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "FinanceTrip_householdId_idx" ON "FinanceTrip" ("householdId");
CREATE INDEX "FinanceTrip_budgetPlannerProjectId_idx" ON "FinanceTrip" ("budgetPlannerProjectId");

CREATE TABLE "FinanceTripExpense" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId"            UUID NOT NULL REFERENCES "FinanceTrip"("id") ON DELETE CASCADE,
  "transactionId"     UUID UNIQUE REFERENCES "Transaction"("id") ON DELETE SET NULL,
  "expenseType"       "FinanceTripExpenseType" NOT NULL,
  "date"              DATE NOT NULL,
  "amount"            NUMERIC(14,2) NOT NULL,
  "payee"             TEXT,
  "description"       TEXT,
  -- Receipt file (goes through src/server/file-storage.ts in the monolith)
  "receiptFileName"   TEXT,
  "receiptPath"       TEXT,
  "receiptFileSize"   INT,
  "receiptHash"       TEXT,
  "receiptUploadedAt" TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "FinanceTripExpense_tripId_date_idx" ON "FinanceTripExpense" ("tripId", "date");

-- ============================================================================
-- ACCOUNT BALANCE TRIGGER (ported from legacy postgres_optimizations)
--
-- Fires AFTER INSERT or DELETE on "Transaction" and adjusts
-- "Account"."currentBalance" atomically. The server layer must NOT update
-- balances itself for normal transactions — the only direct balance writes
-- allowed are the explicit "adjust balance" flow (which inserts an
-- isBalanceAdjustment transaction and therefore also goes through this
-- trigger). Transaction UPDATEs that change amount/type/account are handled
-- in the server layer as delete + recreate (legacy behavior).
-- ============================================================================

CREATE FUNCTION sync_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."type" = 'INCOME' THEN
      UPDATE "Account"
        SET "currentBalance" = "currentBalance" + NEW."amount"
        WHERE "id" = NEW."accountId";

    ELSIF NEW."type" = 'EXPENSE' THEN
      UPDATE "Account"
        SET "currentBalance" = "currentBalance" - NEW."amount"
        WHERE "id" = NEW."accountId";

    ELSIF NEW."type" = 'TRANSFER' THEN
      UPDATE "Account"
        SET "currentBalance" = "currentBalance" - NEW."amount"
        WHERE "id" = NEW."accountId";
      IF NEW."transferToAccountId" IS NOT NULL THEN
        UPDATE "Account"
          SET "currentBalance" = "currentBalance" + NEW."amount"
          WHERE "id" = NEW."transferToAccountId";
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."type" = 'INCOME' THEN
      UPDATE "Account"
        SET "currentBalance" = "currentBalance" - OLD."amount"
        WHERE "id" = OLD."accountId";

    ELSIF OLD."type" = 'EXPENSE' THEN
      UPDATE "Account"
        SET "currentBalance" = "currentBalance" + OLD."amount"
        WHERE "id" = OLD."accountId";

    ELSIF OLD."type" = 'TRANSFER' THEN
      UPDATE "Account"
        SET "currentBalance" = "currentBalance" + OLD."amount"
        WHERE "id" = OLD."accountId";
      IF OLD."transferToAccountId" IS NOT NULL THEN
        UPDATE "Account"
          SET "currentBalance" = "currentBalance" - OLD."amount"
          WHERE "id" = OLD."transferToAccountId";
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_balance_sync
  AFTER INSERT OR DELETE ON "Transaction"
  FOR EACH ROW
  EXECUTE FUNCTION sync_account_balance();

-- ============================================================================
-- PROCESS DUE RECURRING TRANSACTIONS (ported from legacy postgres_optimizations)
--
-- Generates transactions for every active autoCreate recurring rule whose
-- nextOccurrence is due, advances/deactivates the rule, and returns the count.
-- Each INSERT fires the balance trigger above. Called from the server layer
-- with the middleware-verified householdId (and optionally the acting user).
-- ============================================================================

CREATE FUNCTION process_due_recurring(
  p_household_id UUID,
  p_user_id      UUID DEFAULT NULL
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
    FROM "RecurringTransaction"
    WHERE "householdId" = p_household_id
      AND "isActive"       = true
      AND "autoCreate"     = true
      AND "nextOccurrence" IS NOT NULL
      AND "nextOccurrence" <= CURRENT_DATE
    ORDER BY "nextOccurrence"
  LOOP
    INSERT INTO "Transaction" (
      "householdId",
      "accountId",
      "categoryId",
      "transferToAccountId",
      "recurringTransactionId",
      "type",
      "amount",
      "date",
      "payee",
      "description",
      "createdByUserId"
    ) VALUES (
      rec."householdId",
      rec."accountId",
      rec."categoryId",
      rec."transferToAccountId",
      rec."id",
      rec."type",
      rec."amount",
      rec."nextOccurrence",
      rec."payee",
      'Auto: ' || rec."name",
      p_user_id
    );

    -- Advance nextOccurrence (same rules as the legacy TS helper).
    v_next_occurrence := CASE rec."frequency"
      WHEN 'DAILY'      THEN (rec."nextOccurrence" + (rec."frequencyInterval" || ' days')::INTERVAL)::DATE
      WHEN 'WEEKLY'     THEN (rec."nextOccurrence" + (rec."frequencyInterval" * 7 || ' days')::INTERVAL)::DATE
      WHEN 'BI_WEEKLY'  THEN (rec."nextOccurrence" + INTERVAL '14 days')::DATE
      WHEN 'MONTHLY'    THEN (rec."nextOccurrence" + (rec."frequencyInterval" || ' months')::INTERVAL)::DATE
      WHEN 'QUARTERLY'  THEN (rec."nextOccurrence" + INTERVAL '3 months')::DATE
      WHEN 'YEARLY'     THEN (rec."nextOccurrence" + (rec."frequencyInterval" || ' years')::INTERVAL)::DATE
      ELSE rec."nextOccurrence"
    END;

    -- Snap to dayOfPeriod for month-based frequencies (clamped to month end).
    IF rec."dayOfPeriod" IS NOT NULL AND rec."frequency" IN ('MONTHLY', 'QUARTERLY') THEN
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
      UPDATE "RecurringTransaction"
        SET "isActive"       = false,
            "nextOccurrence" = NULL,
            "lastProcessed"  = rec."nextOccurrence",
            "updatedAt"      = now()
        WHERE "id" = rec."id";
    ELSE
      UPDATE "RecurringTransaction"
        SET "nextOccurrence" = v_next_occurrence,
            "lastProcessed"  = rec."nextOccurrence",
            "updatedAt"      = now()
        WHERE "id" = rec."id";
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
