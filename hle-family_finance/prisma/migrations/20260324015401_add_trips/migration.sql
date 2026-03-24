-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripExpenseType" AS ENUM ('GAS', 'FOOD', 'LODGING', 'TRANSPORT', 'SUPPLIES', 'OTHER');

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "destination" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'ACTIVE',
    "isTaxDeductible" BOOLEAN NOT NULL DEFAULT false,
    "taxPurpose" TEXT,
    "budgetPlannerProjectId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripExpense" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "transactionId" TEXT,
    "expenseType" "TripExpenseType" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "payee" TEXT,
    "description" TEXT,
    "receiptFileName" TEXT,
    "receiptPath" TEXT,
    "receiptFileSize" INTEGER,
    "receiptHash" TEXT,
    "receiptUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trip_householdId_idx" ON "Trip"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "TripExpense_transactionId_key" ON "TripExpense"("transactionId");

-- CreateIndex
CREATE INDEX "TripExpense_tripId_date_idx" ON "TripExpense"("tripId", "date");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_budgetPlannerProjectId_fkey" FOREIGN KEY ("budgetPlannerProjectId") REFERENCES "BudgetPlannerProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripExpense" ADD CONSTRAINT "TripExpense_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
