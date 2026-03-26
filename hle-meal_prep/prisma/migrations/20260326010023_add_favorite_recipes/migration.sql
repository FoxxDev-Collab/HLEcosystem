-- CreateTable
CREATE TABLE "FavoriteRecipe" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "mealieRecipeId" TEXT NOT NULL,
    "mealieSlug" TEXT NOT NULL,
    "recipeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteRecipe_householdId_idx" ON "FavoriteRecipe"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteRecipe_householdId_mealieRecipeId_key" ON "FavoriteRecipe"("householdId", "mealieRecipeId");
