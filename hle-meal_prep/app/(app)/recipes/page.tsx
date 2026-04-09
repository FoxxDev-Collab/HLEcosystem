import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import {
  getMealieConfig,
  getRecipes,
  getRecipeCategories,
  getRecipeTags,
  getRecipeImageUrl,
} from "@/lib/mealie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  Search,
  Clock,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Star,
  LayoutGrid,
  List,
  ArrowUpDown,
  X,
} from "lucide-react";
import { toggleFavoriteRecipeAction } from "./actions";
import prisma from "@/lib/prisma";

const PER_PAGE = 24;

type SearchParams = {
  search?: string;
  category?: string;
  tag?: string;
  page?: string;
  favorites?: string;
  view?: string;
  sort?: string;
  dir?: string;
};

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "rating", label: "Rating" },
  { value: "dateAdded", label: "Date Added" },
  { value: "totalTime", label: "Total Time" },
] as const;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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
  const tagFilter = params.tag || "";
  const favoritesFilter = params.favorites === "true";
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const viewMode = params.view === "table" ? "table" : "grid";
  const sortBy = params.sort || "";
  const sortDir = params.dir === "asc" ? "asc" as const : "desc" as const;

  const [recipesData, categories, tags, favorites] = await Promise.all([
    getRecipes(
      householdId,
      currentPage,
      PER_PAGE,
      searchQuery || undefined,
      {
        categories: categoryFilter || undefined,
        tags: tagFilter || undefined,
        orderBy: sortBy || undefined,
        orderDirection: sortBy ? sortDir : undefined,
      }
    ),
    getRecipeCategories(householdId),
    getRecipeTags(householdId),
    prisma.favoriteRecipe.findMany({
      where: { householdId },
      select: { mealieRecipeId: true, mealieSlug: true, recipeName: true },
    }),
  ]);

  const favoriteIds = new Set(favorites.map((f) => f.mealieRecipeId));

  // Favorites filtering (client-side — Mealie doesn't know about our favorites)
  const filteredItems = favoritesFilter
    ? recipesData.items.filter((r) => favoriteIds.has(r.id))
    : recipesData.items;

  const totalPages = recipesData.totalPages;
  const hasFilters = !!(searchQuery || categoryFilter || tagFilter || favoritesFilter || sortBy);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="size-6" />
            Recipes
          </h1>
          <p className="text-muted-foreground text-sm">
            {recipesData.total} recipes from Mealie
          </p>
        </div>
        {/* View toggle */}
        <div className="flex items-center border rounded-lg">
          <Link href={buildUrl({ ...params, view: undefined })}>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2.5 rounded-r-none ${viewMode === "grid" ? "bg-muted" : ""}`}
            >
              <LayoutGrid className="size-4" />
            </Button>
          </Link>
          <Link href={buildUrl({ ...params, view: "table" })}>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2.5 rounded-l-none ${viewMode === "table" ? "bg-muted" : ""}`}
            >
              <List className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search recipes..."
              defaultValue={searchQuery}
              className="pl-10"
            />
          </div>
          {/* Preserve filters through search */}
          {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
          {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}
          {params.view && <input type="hidden" name="view" value={params.view} />}
          {sortBy && <input type="hidden" name="sort" value={sortBy} />}
          {params.dir && <input type="hidden" name="dir" value={params.dir} />}
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        {/* Sort controls */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
          {SORT_OPTIONS.map((opt) => {
            const isActive = sortBy === opt.value;
            const nextDir = isActive && sortDir === "desc" ? "asc" : "desc";
            return (
              <Link
                key={opt.value}
                href={buildUrl({
                  ...params,
                  sort: opt.value,
                  dir: isActive ? nextDir : "desc",
                  page: undefined,
                })}
              >
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                >
                  {opt.label}
                  {isActive && (
                    <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
                  )}
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</span>
          <div className="flex flex-wrap gap-1.5">
            <Link href={buildUrl({ ...params, category: undefined, page: undefined })}>
              <Badge variant={!categoryFilter && !favoritesFilter ? "default" : "outline"} className="text-xs">
                All
              </Badge>
            </Link>
            <Link href={buildUrl({ ...params, favorites: "true", category: undefined, page: undefined })}>
              <Badge variant={favoritesFilter ? "default" : "outline"} className="gap-1 text-xs">
                <Star className={`size-3 ${favoritesFilter ? "fill-yellow-400 text-yellow-400" : ""}`} />
                Favorites
              </Badge>
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={buildUrl({ ...params, category: cat.slug, favorites: undefined, page: undefined })}
              >
                <Badge variant={categoryFilter === cat.slug ? "default" : "outline"} className="text-xs">
                  {cat.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tag filter */}
      {tags.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {tagFilter && (
              <Link href={buildUrl({ ...params, tag: undefined, page: undefined })}>
                <Badge variant="destructive" className="gap-1 text-xs">
                  <X className="size-3" />
                  Clear
                </Badge>
              </Link>
            )}
            {tags.map((tag) => (
              <Link
                key={tag.slug}
                href={buildUrl({ ...params, tag: tag.slug, page: undefined })}
              >
                <Badge variant={tagFilter === tag.slug ? "default" : "secondary"} className="text-xs">
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Active filter summary */}
      {hasFilters && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""}
          </span>
          <Link href={buildUrl({ view: params.view })}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <X className="size-3" />
              Clear all filters
            </Button>
          </Link>
        </div>
      )}

      {/* Empty state */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">No Recipes Found</h3>
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? "Try adjusting your search or filters."
                : "No recipes found in your Mealie instance."}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        /* ── TABLE VIEW ─────────────────────────────────── */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>
                    <SortLink params={params} field="name" label="Name" currentSort={sortBy} currentDir={sortDir} />
                  </TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-center">
                    <SortLink params={params} field="totalTime" label="Time" currentSort={sortBy} currentDir={sortDir} />
                  </TableHead>
                  <TableHead className="text-center">Servings</TableHead>
                  <TableHead className="text-center">
                    <SortLink params={params} field="rating" label="Rating" currentSort={sortBy} currentDir={sortDir} />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortLink params={params} field="dateAdded" label="Added" currentSort={sortBy} currentDir={sortDir} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((recipe) => (
                  <TableRow key={recipe.id} className="group">
                    <TableCell className="p-1">
                      <form action={toggleFavoriteRecipeAction}>
                        <input type="hidden" name="mealieRecipeId" value={recipe.id} />
                        <input type="hidden" name="mealieSlug" value={recipe.slug} />
                        <input type="hidden" name="recipeName" value={recipe.name} />
                        <button
                          type="submit"
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Star
                            className={`size-4 ${
                              favoriteIds.has(recipe.id)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/40 group-hover:text-muted-foreground"
                            }`}
                          />
                        </button>
                      </form>
                    </TableCell>
                    <TableCell className="p-1">
                      <Link href={`/recipes/${recipe.slug}`}>
                        <img
                          src={getRecipeImageUrl(mealieConfig.apiUrl, recipe.id)}
                          alt=""
                          className="size-10 rounded object-cover"
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/recipes/${recipe.slug}`}
                        className="font-medium hover:underline"
                      >
                        {recipe.name}
                      </Link>
                      {recipe.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {recipe.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {recipe.recipeCategory?.map((cat) => (
                          <Link
                            key={cat.slug}
                            href={buildUrl({ ...params, category: cat.slug, page: undefined })}
                          >
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 cursor-pointer">
                              {cat.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {recipe.tags?.map((tag) => (
                          <Link
                            key={tag.slug}
                            href={buildUrl({ ...params, tag: tag.slug, page: undefined })}
                          >
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer">
                              {tag.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground whitespace-nowrap">
                      {recipe.totalTime || "\u2014"}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {recipe.recipeServings ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-center">
                      {recipe.rating ? (
                        <span className="text-sm font-medium">
                          {recipe.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">\u2014</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                      {recipe.dateAdded || "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        /* ── GRID VIEW ──────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden hover:shadow-md transition-shadow h-full relative">
              <form action={toggleFavoriteRecipeAction} className="absolute top-2 right-2 z-10">
                <input type="hidden" name="mealieRecipeId" value={recipe.id} />
                <input type="hidden" name="mealieSlug" value={recipe.slug} />
                <input type="hidden" name="recipeName" value={recipe.name} />
                <button
                  type="submit"
                  className="rounded-full bg-background/80 backdrop-blur-sm p-1.5 hover:bg-background transition-colors"
                >
                  <Star
                    className={`size-4 ${
                      favoriteIds.has(recipe.id)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
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
                  {recipe.rating !== null && recipe.rating > 0 && (
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-xs font-medium flex items-center gap-1">
                      <Star className="size-3 fill-yellow-400 text-yellow-400" />
                      {recipe.rating.toFixed(1)}
                    </div>
                  )}
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
                        {recipe.recipeServings}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {recipe.recipeCategory?.map((cat) => (
                      <Badge
                        key={cat.slug}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {cat.name}
                      </Badge>
                    ))}
                    {recipe.tags?.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag.slug}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {recipe.tags && recipe.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{recipe.tags.length - 3}
                      </span>
                    )}
                  </div>
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
            <Link href={buildUrl({ ...params, page: String(currentPage - 1) })}>
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
            <Link href={buildUrl({ ...params, page: String(currentPage + 1) })}>
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

// ── Helpers ──────────────────────────────────────────

function buildUrl(p: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(p)) {
    if (val) params.set(key, val);
  }
  const qs = params.toString();
  return qs ? `/recipes?${qs}` : "/recipes";
}

function SortLink({
  params,
  field,
  label,
  currentSort,
  currentDir,
}: {
  params: SearchParams;
  field: string;
  label: string;
  currentSort: string;
  currentDir: "asc" | "desc";
}) {
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";

  return (
    <Link
      href={buildUrl({ ...params, sort: field, dir: isActive ? nextDir : "desc", page: undefined })}
      className={`inline-flex items-center gap-1 hover:text-foreground ${
        isActive ? "text-foreground font-semibold" : ""
      }`}
    >
      {label}
      {isActive && (
        <span className="text-xs">{currentDir === "asc" ? "\u2191" : "\u2193"}</span>
      )}
    </Link>
  );
}
