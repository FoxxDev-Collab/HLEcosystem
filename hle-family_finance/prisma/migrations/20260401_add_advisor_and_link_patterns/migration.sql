-- AdvisorReport cache
CREATE TABLE "family_finance"."AdvisorReport" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "reportData" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvisorReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdvisorReport_householdId_generatedAt_idx" ON "family_finance"."AdvisorReport"("householdId", "generatedAt");

-- TransactionLinkPattern for auto-mapping
CREATE TABLE "family_finance"."TransactionLinkPattern" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "payeePattern" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchName" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransactionLinkPattern_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransactionLinkPattern_householdId_payeePattern_matchType_key" ON "family_finance"."TransactionLinkPattern"("householdId", "payeePattern", "matchType");
CREATE INDEX "TransactionLinkPattern_householdId_idx" ON "family_finance"."TransactionLinkPattern"("householdId");
