-- Add refinance tracking to Debt
ALTER TABLE "family_finance"."Debt" ADD COLUMN IF NOT EXISTS "refinancedFromId" TEXT;
ALTER TABLE "family_finance"."Debt" ADD CONSTRAINT "Debt_refinancedFromId_fkey" FOREIGN KEY ("refinancedFromId") REFERENCES "family_finance"."Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
