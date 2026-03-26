import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import {
  getMealieConfig,
  getRecipes,
  getRecipeCategories,
  getRecipeImageUrl,
} from "@/lib/mealie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Search,
  Clock,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { toggleFavoriteRecipeAction } from "./actions";
import prisma from "@/lib/prisma";

const PER_PAGE = 20;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; page?: string; favorites?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const mealieConfig = await getMealieConfig(householdId);

  if (!mealieConfig) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="size-6" />
            Recipes
          </h1>
          <p className="text-muted-foreground">
            Browse and import recipes from your Mealie instance
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">Mealie Not Connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure your Mealie API connection in Settings to browse
              your recipes and import ingredients.
            </p>
            <Link href="/settings">
              <Button className="gap-2">
                <Settings className="size-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const searchQuery = params.search || "";
  const categoryFilter = params.category || "";
  const favoritesFilter = params.favorites === "true";
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));

  const [recipesData, categories, favorites] = await Promise.all([
    getRecipes(
      householdId,
      currentPage,
      PER_PAGE,
      searchQuery || undefined
    ),
    getRecipeCategories(householdId),
    prisma.favoriteRecipe.findMany({
      where: { householdId },
      select: { mealieRecipeId: true, mealieSlug: true, recipeName: true },
    }),
  ]);

  const favoriteIds = new Set(favorites.map((f) => f.mealieRecipeId));

  // Client-side category filtering (Mealie search endpoint handles text search)
  let filteredItems = categoryFilter
    ? recipesData.items.filter((r) =>
        r.recipeCategory?.some((c) => c.slug === categoryFilter)
      )
    : recipesData.items;

  // Favorites filtering
  if (favoritesFilter) {
    filteredItems = filteredItems.filter((r) => favoriteIds.has(r.id));
  }

  const totalPages = recipesData.totalPages;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="size-6" />
          Recipes
        </h1>
        <p className="text-muted-foreground">
          Browse and import recipes from your Mealie instance
        </p>
      </div>

      {/* Search */}
      <form className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Search recipes..."
            defaultValue={searchQuery}
            className="pl-10"
          />
        </div>
        {categoryFilter && (
          <input type="hidden" name="category" value={categoryFilter} />
        )}
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {(searchQuery || categoryFilter || favoritesFilter) && (
          <Link href="/recipes">
            <Button variant="ghost" type="button">
              Clear
            </Button>
          </Link>
        )}
      </form>

      {/* Category filter badges */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={searchQuery ? `/recipes?search=${encodeURIComponent(searchQuery)}` : "/recipes"}>
            <Badge variant={!categoryFilter && !favoritesFilter ? "default" : "outline"}>All</Badge>
          </Link>
          <Link href={searchQuery ? `/recipes?search=${encodeURIComponent(searchQuery)}&favorites=true` : "/recipes?favorites=true"}>
            <Badge variant={favoritesFilter ? "default" : "outline"} className="gap-1">
              <Star className={`size-3 ${favoritesFilter ? "fill-yellow-400 text-yellow-400" : ""}`} />
              Favorites
            </Badge>
          </Link>
          {categories.map((cat) => {
            const href = searchQuery
              ? `/recipes?search=${encodeURIComponent(searchQuery)}&category=${cat.slug}`
              : `/recipes?category=${cat.slug}`;
            return (
              <Link key={cat.slug} href={href}>
                <Badge variant={categoryFilter === cat.slug ? "default" : "outline"}>
                  {cat.name}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}

      {/* Recipe grid */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">No Recipes Found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || categoryFilter || favoritesFilter
                ? "Try adjusting your search or filters."
                : "No recipes found in your Mealie instance."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden hover:shadow-md transition-shadow h-full relative">
              <form action={toggleFavoriteRecipeAction} className="absolute top-2 right-2 z-10">
                <input type="hidden" name="mealieRecipeId" value={recipe.id} />
                <input type="hidden" name="mealieSlug" value={recipe.slug} />
                <input type="hidden" name="recipeName" value={recipe.name} />
                <button type="submit" className="rounded-full bg-background/80 backdrop-blur-sm p-1.5 hover:bg-background transition-colors">
                  <Star className={`size-4 ${favoriteIds.has(recipe.id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </button>
              </form>
              <Link href={`/recipes/${recipe.slug}`}>
                <div className="relative aspect-video bg-muted">
                  <Image
                    src={getRecipeImageUrl(mealieConfig.apiUrl, recipe.id)}
                    alt={recipe.name}
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-tight line-clamp-2">
                    {recipe.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {recipe.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {recipe.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {recipe.totalTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {recipe.totalTime}
                      </span>
                    )}
                    {recipe.recipeServings && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {recipe.recipeServings} servings
                      </span>
                    )}
                  </div>
                  {recipe.recipeCategory && recipe.recipeCategory.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.recipeCategory.map((cat) => (
                        <Badge
                          key={cat.slug}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 ? (
            <Link
              href={buildPageUrl(currentPage - 1, searchQuery, categoryFilter, favoritesFilter)}
            >
              <Button variant="outline" size="icon">
                <ChevronLeft className="size-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="icon" disabled>
              <ChevronLeft className="size-4" />
            </Button>
          )}
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildPageUrl(currentPage + 1, searchQuery, categoryFilter, favoritesFilter)}
            >
              <Button variant="outline" size="icon">
                <ChevronRight className="size-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="icon" disabled>
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function buildPageUrl(page: number, search: string, category: string, favorites?: boolean): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (favorites) params.set("favorites", "true");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/recipes?${qs}` : "/recipes";
}
