-- AlterTable
ALTER TABLE "TaxYear" ADD COLUMN     "federalOwed" DECIMAL(18,2),
ADD COLUMN     "federalOwedPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stateOwed" DECIMAL(18,2),
ADD COLUMN     "stateOwedPaid" BOOLEAN NOT NULL DEFAULT false;
