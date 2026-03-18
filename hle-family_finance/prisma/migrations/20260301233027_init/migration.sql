-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'INVESTMENT', 'LOAN', 'HSA', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN', 'PERSONAL_LOAN', 'HELOC', 'CREDIT_CARD', 'MEDICAL_DEBT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('REAL_ESTATE', 'VEHICLE', 'JEWELRY', 'ELECTRONICS', 'COLLECTIBLES', 'RETIREMENT', 'INVESTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetPlannerProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "BillCategory" AS ENUM ('UTILITIES', 'INSURANCE', 'SUBSCRIPTIONS', 'PHONE', 'INTERNET', 'RENT', 'MORTGAGE', 'CAR_PAYMENT', 'CHILD_CARE', 'STREAMING', 'OTHER');

-- CreateEnum
CREATE TYPE "BillPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "CategoryRuleMatchType" AS ENUM ('CONTAINS', 'STARTS_WITH', 'EXACT', 'REGEX');

-- CreateEnum
CREATE TYPE "TaxDocumentType" AS ENUM ('W2', 'FORM_1099_INT', 'FORM_1099_DIV', 'FORM_1099_NEC', 'FORM_1098', 'FORM_1099_B', 'FORM_1099_R', 'K1', 'FORM_1099_SA', 'FORM_5498_SA', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxFilingStatus" AS ENUM ('SINGLE', 'MARRIED_FILING_JOINTLY', 'MARRIED_FILING_SEPARATELY', 'HEAD_OF_HOUSEHOLD', 'QUALIFYING_WIDOWER');

-- CreateEnum
CREATE TYPE "ImportFileFormat" AS ENUM ('CSV', 'QFX', 'OFX');

-- CreateEnum
CREATE TYPE "ImportMatchStatus" AS ENUM ('PENDING', 'AUTO_MATCHED', 'IMPORTED', 'SKIPPED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "institution" TEXT,
    "accountNumberLast4" TEXT,
    "initialBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(18,2),
    "interestRate" DECIMAL(6,4),
    "hsaAnnualLimit" DECIMAL(18,2),
    "hsaFamilyCoverage" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "transferToAccountId" TEXT,
    "linkedTransactionId" TEXT,
    "recurringTransactionId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" DATE NOT NULL,
    "payee" TEXT,
    "description" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "isCleared" BOOLEAN NOT NULL DEFAULT false,
    "isBalanceAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTransaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "transferToAccountId" TEXT,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "payee" TEXT,
    "description" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "frequencyInterval" INTEGER NOT NULL DEFAULT 1,
    "dayOfPeriod" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextOccurrence" DATE,
    "lastProcessed" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoCreate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "defaultBudgetAmount" DECIMAL(18,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "matchType" "CategoryRuleMatchType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "assignPayee" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlannerProject" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "BudgetPlannerProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "targetDate" DATE,
    "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "icon" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPlannerProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlannerItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPurchased" BOOLEAN NOT NULL DEFAULT false,
    "referenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPlannerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "purchasePrice" DECIMAL(18,2),
    "purchaseDate" DATE,
    "currentValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valueAsOfDate" DATE,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "squareFootage" INTEGER,
    "yearBuilt" INTEGER,
    "propertyTaxAnnual" DECIMAL(18,2),
    "make" TEXT,
    "model" TEXT,
    "vehicleYear" INTEGER,
    "vin" TEXT,
    "mileage" INTEGER,
    "licensePlate" TEXT,
    "linkedDebtId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetValueHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "DebtType" NOT NULL,
    "name" TEXT NOT NULL,
    "lender" TEXT,
    "accountNumberLast4" TEXT,
    "originalPrincipal" DECIMAL(18,2) NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL,
    "interestRate" DECIMAL(6,4) NOT NULL,
    "termMonths" INTEGER,
    "minimumPayment" DECIMAL(18,2),
    "paymentDayOfMonth" INTEGER,
    "originationDate" DATE,
    "expectedPayoffDate" DATE,
    "linkedAccountId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "escrowAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "extraPrincipal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(18,2),
    "linkedTransactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBill" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payee" TEXT,
    "category" "BillCategory" NOT NULL DEFAULT 'OTHER',
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "isVariableAmount" BOOLEAN NOT NULL DEFAULT false,
    "dueDayOfMonth" INTEGER NOT NULL,
    "autoPay" BOOLEAN NOT NULL DEFAULT false,
    "autoPayAccountId" TEXT,
    "linkedDebtId" TEXT,
    "defaultCategoryId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "websiteUrl" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillPayment" (
    "id" TEXT NOT NULL,
    "monthlyBillId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "paidDate" DATE,
    "amountDue" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2),
    "status" "BillPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "linkedTransactionId" TEXT,
    "confirmationNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxYear" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "federalFilingStatus" "TaxFilingStatus",
    "state" TEXT,
    "isFederalFiled" BOOLEAN NOT NULL DEFAULT false,
    "federalFiledDate" DATE,
    "isStateFiled" BOOLEAN NOT NULL DEFAULT false,
    "stateFiledDate" DATE,
    "federalRefund" DECIMAL(18,2),
    "stateRefund" DECIMAL(18,2),
    "refundReceived" BOOLEAN NOT NULL DEFAULT false,
    "refundReceivedDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxDocument" (
    "id" TEXT NOT NULL,
    "taxYearId" TEXT NOT NULL,
    "documentType" "TaxDocumentType" NOT NULL,
    "issuer" TEXT NOT NULL,
    "description" TEXT,
    "grossAmount" DECIMAL(18,2),
    "federalWithheld" DECIMAL(18,2),
    "stateWithheld" DECIMAL(18,2),
    "socialSecurityWithheld" DECIMAL(18,2),
    "medicareWithheld" DECIMAL(18,2),
    "isReceived" BOOLEAN NOT NULL DEFAULT false,
    "receivedDate" DATE,
    "expectedDate" DATE,
    "notes" TEXT,
    "uploadedFileName" TEXT,
    "storagePath" TEXT,
    "fileSize" INTEGER,
    "contentHash" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" "ImportFileFormat" NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByUserId" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedTransaction" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "payee" TEXT,
    "checkNumber" TEXT,
    "referenceNumber" TEXT,
    "rawData" TEXT,
    "matchStatus" "ImportMatchStatus" NOT NULL DEFAULT 'PENDING',
    "matchedTransactionId" TEXT,
    "suggestedCategoryId" TEXT,
    "createdTransactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_linkedTransactionId_key" ON "Transaction"("linkedTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_householdId_date_idx" ON "Transaction"("householdId", "date");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_externalId_idx" ON "Transaction"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_householdId_name_parentCategoryId_key" ON "Category"("householdId", "name", "parentCategoryId");

-- CreateIndex
CREATE INDEX "CategoryRule_householdId_isActive_idx" ON "CategoryRule"("householdId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_householdId_categoryId_year_month_key" ON "Budget"("householdId", "categoryId", "year", "month");

-- CreateIndex
CREATE INDEX "AssetValueHistory_assetId_date_idx" ON "AssetValueHistory"("assetId", "date");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_paymentDate_idx" ON "DebtPayment"("debtId", "paymentDate");

-- CreateIndex
CREATE INDEX "BillPayment_monthlyBillId_dueDate_idx" ON "BillPayment"("monthlyBillId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaxYear_householdId_year_key" ON "TaxYear"("householdId", "year");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferToAccountId_fkey" FOREIGN KEY ("transferToAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringTransactionId_fkey" FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_transferToAccountId_fkey" FOREIGN KEY ("transferToAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlannerItem" ADD CONSTRAINT "BudgetPlannerItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BudgetPlannerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_linkedDebtId_fkey" FOREIGN KEY ("linkedDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetValueHistory" ADD CONSTRAINT "AssetValueHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBill" ADD CONSTRAINT "MonthlyBill_autoPayAccountId_fkey" FOREIGN KEY ("autoPayAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBill" ADD CONSTRAINT "MonthlyBill_linkedDebtId_fkey" FOREIGN KEY ("linkedDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBill" ADD CONSTRAINT "MonthlyBill_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_monthlyBillId_fkey" FOREIGN KEY ("monthlyBillId") REFERENCES "MonthlyBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_taxYearId_fkey" FOREIGN KEY ("taxYearId") REFERENCES "TaxYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_createdTransactionId_fkey" FOREIGN KEY ("createdTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
