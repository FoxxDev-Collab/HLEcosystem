-- Simplify media request workflow: PENDING/APPROVED/FULFILLED/DENIED → REQUESTED/COMPLETED

-- Drop the adminNote and fulfilledAt columns
ALTER TABLE familyhub."MediaRequest" DROP COLUMN IF EXISTS "adminNote";
ALTER TABLE familyhub."MediaRequest" DROP COLUMN IF EXISTS "fulfilledAt";

-- Convert status column to text temporarily
ALTER TABLE familyhub."MediaRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE familyhub."MediaRequest" ALTER COLUMN "status" TYPE TEXT;

-- Map old statuses to new ones
UPDATE familyhub."MediaRequest" SET "status" = 'REQUESTED' WHERE "status" IN ('PENDING', 'APPROVED');
UPDATE familyhub."MediaRequest" SET "status" = 'COMPLETED' WHERE "status" IN ('FULFILLED', 'DENIED');

-- Replace the enum type
DROP TYPE familyhub."RequestStatus";
CREATE TYPE familyhub."RequestStatus" AS ENUM ('REQUESTED', 'COMPLETED');

-- Convert back to enum
ALTER TABLE familyhub."MediaRequest"
  ALTER COLUMN "status" TYPE familyhub."RequestStatus"
  USING "status"::familyhub."RequestStatus";

ALTER TABLE familyhub."MediaRequest" ALTER COLUMN "status" SET DEFAULT 'REQUESTED'::"RequestStatus";
