-- CreateTable: CachedMealieRecipe
CREATE TABLE "CachedMealieRecipe" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summaryData" JSONB NOT NULL,
    "detailData" JSONB,
    "detailCachedAt" TIMESTAMP(3),
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedMealieRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CachedMealieMealPlan
CREATE TABLE "CachedMealieMealPlan" (
    "householdId" TEXT NOT NULL,
    "entryId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedMealieMealPlan_pkey" PRIMARY KEY ("householdId", "entryId")
);

-- CreateTable: MealieSyncState
CREATE TABLE "MealieSyncState" (
    "householdId" TEXT NOT NULL,
    "recipesSyncedAt" TIMESTAMP(3),
    "planSyncedAt" TIMESTAMP(3),
    "recipeTotalCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealieSyncState_pkey" PRIMARY KEY ("householdId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CachedMealieRecipe_householdId_slug_key" ON "CachedMealieRecipe"("householdId", "slug");
CREATE INDEX "CachedMealieRecipe_householdId_idx" ON "CachedMealieRecipe"("householdId");
CREATE INDEX "CachedMealieRecipe_householdId_name_idx" ON "CachedMealieRecipe"("householdId", "name");
CREATE INDEX "CachedMealieMealPlan_householdId_date_idx" ON "CachedMealieMealPlan"("householdId", "date");
