-- Meals module: stores, product catalog, store prices, shopping lists, pantry,
-- and the Mealie integration (per-household config + DB cache of recipes and
-- meal plans). Ported from hle-meal_prep/prisma/schema.prisma.
--
-- Differences from legacy: UUID PKs (greenfield convention), real FKs to
-- "Household" (single database makes them possible), householdId is the
-- tenancy boundary on every household-scoped table (ADR-0005).
-- Naming: legacy "Category" -> "ProductCategory" (Category is too generic;
-- a future finance port owns plain Category semantics) and legacy enum
-- "ListStatus" -> "ShoppingListStatus" (avoid collisions with concurrent
-- module migrations). "CachedMealieRecipe" legacy PK was the Mealie recipe
-- id alone; here it is composite (householdId, mealieRecipeId) so two
-- households pointing at the same Mealie instance cannot collide.

CREATE TYPE "ProductUnit" AS ENUM (
  'EACH','LB','OZ','GALLON','QUART','LITER','COUNT','PACK','BAG','BOX',
  'CAN','BOTTLE','BUNCH','DOZEN'
);
CREATE TYPE "ShoppingListStatus" AS ENUM ('DRAFT','ACTIVE','COMPLETED');

CREATE TABLE "Store" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "location"    TEXT,
  "notes"       TEXT,
  "color"       TEXT,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "name")
);
CREATE INDEX "Store_householdId_idx" ON "Store" ("householdId");

CREATE TABLE "ProductCategory" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "name")
);
CREATE INDEX "ProductCategory_householdId_idx" ON "ProductCategory" ("householdId");

CREATE TABLE "Product" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "categoryId"  UUID REFERENCES "ProductCategory"("id") ON DELETE SET NULL,
  "name"        TEXT NOT NULL,
  "brand"       TEXT,
  "defaultUnit" "ProductUnit" NOT NULL DEFAULT 'EACH',
  "notes"       TEXT,
  "isFavorite"  BOOLEAN NOT NULL DEFAULT false,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Product_householdId_idx" ON "Product" ("householdId");
CREATE INDEX "Product_categoryId_idx" ON "Product" ("categoryId");

-- Price observations per product per store (the heart of the app). No own
-- householdId — scoped through "Product" (join through the parent).
CREATE TABLE "StorePrice" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId"  UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "storeId"    UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "price"      NUMERIC(10,2) NOT NULL,
  "unitQty"    NUMERIC(10,3),
  "unit"       "ProductUnit",
  "onSale"     BOOLEAN NOT NULL DEFAULT false,
  "observedAt" DATE NOT NULL DEFAULT CURRENT_DATE,
  "notes"      TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "StorePrice_productId_storeId_idx" ON "StorePrice" ("productId", "storeId");
CREATE INDEX "StorePrice_productId_observedAt_idx" ON "StorePrice" ("productId", "observedAt");

CREATE TABLE "ShoppingList" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "status"      "ShoppingListStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ShoppingList_householdId_idx" ON "ShoppingList" ("householdId");

-- No own householdId — scoped through "ShoppingList".
CREATE TABLE "ShoppingListItem" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listId"    UUID NOT NULL REFERENCES "ShoppingList"("id") ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "storeId"   UUID REFERENCES "Store"("id") ON DELETE SET NULL,
  "quantity"  NUMERIC(10,3) NOT NULL DEFAULT 1,
  "unit"      "ProductUnit",
  "notes"     TEXT,
  "isChecked" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INT NOT NULL DEFAULT 0
);
CREATE INDEX "ShoppingListItem_listId_idx" ON "ShoppingListItem" ("listId");
CREATE INDEX "ShoppingListItem_productId_idx" ON "ShoppingListItem" ("productId");

-- What's on hand. One row per product (productId is unique).
CREATE TABLE "PantryItem" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "productId"   UUID NOT NULL UNIQUE REFERENCES "Product"("id") ON DELETE CASCADE,
  "quantity"    NUMERIC(10,3) NOT NULL,
  "unit"        "ProductUnit",
  "minQuantity" NUMERIC(10,3),
  "expiresAt"   DATE,
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PantryItem_householdId_idx" ON "PantryItem" ("householdId");
CREATE INDEX "PantryItem_expiresAt_idx" ON "PantryItem" ("expiresAt");

-- Per-household Mealie connection (URL + API token live in the DB, not env).
CREATE TABLE "MealieConfig" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL UNIQUE REFERENCES "Household"("id") ON DELETE CASCADE,
  "apiUrl"      TEXT NOT NULL,
  "apiToken"    TEXT NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "FavoriteRecipe" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "mealieRecipeId" TEXT NOT NULL,
  "mealieSlug"     TEXT NOT NULL,
  "recipeName"     TEXT NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "mealieRecipeId")
);
CREATE INDEX "FavoriteRecipe_householdId_idx" ON "FavoriteRecipe" ("householdId");

-- Mealie cache: recipe summaries + optionally full detail. Keyed by the
-- Mealie recipe id (external UUID) per household.
CREATE TABLE "CachedMealieRecipe" (
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "mealieRecipeId" UUID NOT NULL,
  "slug"           TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "summaryData"    JSONB NOT NULL,
  "detailData"     JSONB,
  "detailCachedAt" TIMESTAMPTZ,
  "cachedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("householdId", "mealieRecipeId"),
  UNIQUE ("householdId", "slug")
);
CREATE INDEX "CachedMealieRecipe_householdId_name_idx" ON "CachedMealieRecipe" ("householdId", "name");

-- Mealie cache: meal plan entries keyed by Mealie's numeric entry id.
CREATE TABLE "CachedMealieMealPlan" (
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "entryId"     INT NOT NULL,
  "date"        DATE NOT NULL,
  "data"        JSONB NOT NULL,
  "cachedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("householdId", "entryId")
);
CREATE INDEX "CachedMealieMealPlan_householdId_date_idx" ON "CachedMealieMealPlan" ("householdId", "date");

-- Mealie sync state: last successful sync timestamps per household.
CREATE TABLE "MealieSyncState" (
  "householdId"      UUID PRIMARY KEY REFERENCES "Household"("id") ON DELETE CASCADE,
  "recipesSyncedAt"  TIMESTAMPTZ,
  "planSyncedAt"     TIMESTAMPTZ,
  "recipeTotalCount" INT NOT NULL DEFAULT 0,
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
