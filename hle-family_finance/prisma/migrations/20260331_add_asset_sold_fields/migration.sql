-- Add sold workflow fields to Asset
ALTER TABLE "family_finance"."Asset" ADD COLUMN "isSold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "family_finance"."Asset" ADD COLUMN "soldPrice" DECIMAL(18, 2);
ALTER TABLE "family_finance"."Asset" ADD COLUMN "soldDate" DATE;
