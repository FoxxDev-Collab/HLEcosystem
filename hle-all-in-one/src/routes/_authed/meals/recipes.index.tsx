import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import {
  ArrowUpDown,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Search,
  Settings,
  Star,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react"
import {
  getRecipesPageFn,
  toggleFavoriteRecipeFn,
} from "@/server/meals/fns.mealie"
import { syncMealieFn } from "@/server/meals/fns.settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const searchSchema = z.object({
  search: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  tag: z.string().max(200).optional(),
  page: z.number().int().min(1).optional(),
  favorites: z.boolean().optional(),
  view: z.enum(["grid", "table"]).optional(),
  sort: z.enum(["name", "rating", "dateAdded", "totalTime"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
})

type RecipesSearch = z.infer<typeof searchSchema>

export const Route = createFileRoute("/_authed/meals/recipes/")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getRecipesPageFn({
      data: {
        page: deps.page,
        search: deps.search,
        category: deps.category,
        tag: deps.tag,
        sort: deps.sort,
        dir: deps.dir,
      },
    }),
  component: RecipesPage,
})

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "rating", label: "Rating" },
  { value: "dateAdded", label: "Date Added" },
  { value: "totalTime", label: "Total Time" },
] as const

function recipeImageUrl(apiUrl: string, recipeId: string): string {
  return `${apiUrl}/api/media/recipes/${recipeId}/images/min-original.webp`
}

function RecipesPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [searchInput, setSearchInput] = useState(search.search ?? "")

  // Background sync on mount — free when the cache is fresh.
  const fired = useRef(false)
  useEffect(() => {
    if (!data.configured || fired.current) return
    fired.current = true
    syncMealieFn()
      .then((result) => {
        if (result && "synced" in result) router.invalidate()
      })
      .catch(() => {})
  }, [data.configured, router])

  if (!data.configured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="size-5" />
            Recipes
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse and import recipes from your Mealie instance
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold">Mealie Not Connected</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Configure your Mealie API connection in Settings to browse your
              recipes and import ingredients.
            </p>
            <Link to="/meals/settings">
              <Button>
                <Settings className="size-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { apiUrl, items, total, totalPages, categories, tags, favorites } = data
  const favoriteIds = new Set(favorites.map((f) => f.mealieRecipeId))
  const viewMode = search.view === "table" ? "table" : "grid"
  const currentPage = search.page ?? 1
  const sortBy = search.sort ?? ""
  const sortDir = search.dir === "asc" ? ("asc" as const) : ("desc" as const)

  // Favorites filtering happens client-side — Mealie doesn't know about them.
  const filteredItems = search.favorites
    ? items.filter((r) => favoriteIds.has(r.id))
    : items
  const hasFilters = !!(
    search.search ||
    search.category ||
    search.tag ||
    search.favorites ||
    search.sort
  )

  async function onToggleFavorite(recipe: {
    id: string
    slug: string
    name: string
  }) {
    try {
      await toggleFavoriteRecipeFn({
        data: {
          mealieRecipeId: recipe.id,
          mealieSlug: recipe.slug,
          recipeName: recipe.name,
        },
      })
      router.invalidate()
    } catch {
      // Favorite toggle failures are non-fatal.
    }
  }

  function navSearch(patch: Partial<RecipesSearch>): RecipesSearch {
    const next: RecipesSearch = { ...search, ...patch }
    for (const key of Object.keys(next) as Array<keyof RecipesSearch>) {
      if (next[key] === undefined) delete next[key]
    }
    return next
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="size-5" />
            Recipes
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} recipes from Mealie
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/meals/recipes/what-can-i-cook">
            <Button variant="outline" size="sm">
              <UtensilsCrossed className="size-3.5" />
              What can I cook?
            </Button>
          </Link>
          <div className="flex items-center rounded-lg border">
            <Link to="/meals/recipes" search={navSearch({ view: undefined })}>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 rounded-r-none px-2.5 ${viewMode === "grid" ? "bg-muted" : ""}`}
              >
                <LayoutGrid className="size-4" />
              </Button>
            </Link>
            <Link to="/meals/recipes" search={navSearch({ view: "table" })}>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 rounded-l-none px-2.5 ${viewMode === "table" ? "bg-muted" : ""}`}
              >
                <List className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="flex max-w-md min-w-[200px] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            router.navigate({
              to: "/meals/recipes",
              search: navSearch({
                search: searchInput.trim() || undefined,
                page: undefined,
              }),
            })
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search recipes…"
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
          {SORT_OPTIONS.map((opt) => {
            const isActive = sortBy === opt.value
            const nextDir = isActive && sortDir === "desc" ? "asc" : "desc"
            return (
              <Link
                key={opt.value}
                to="/meals/recipes"
                search={navSearch({
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
                    <span className="ml-1">
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </Badge>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Categories
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Link
              to="/meals/recipes"
              search={navSearch({
                category: undefined,
                favorites: undefined,
                page: undefined,
              })}
            >
              <Badge
                variant={
                  !search.category && !search.favorites ? "default" : "outline"
                }
                className="text-xs"
              >
                All
              </Badge>
            </Link>
            <Link
              to="/meals/recipes"
              search={navSearch({
                favorites: true,
                category: undefined,
                page: undefined,
              })}
            >
              <Badge
                variant={search.favorites ? "default" : "outline"}
                className="gap-1 text-xs"
              >
                <Star
                  className={`size-3 ${search.favorites ? "fill-yellow-400 text-yellow-400" : ""}`}
                />
                Favorites
              </Badge>
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                to="/meals/recipes"
                search={navSearch({
                  category: cat.slug,
                  favorites: undefined,
                  page: undefined,
                })}
              >
                <Badge
                  variant={search.category === cat.slug ? "default" : "outline"}
                  className="text-xs"
                >
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
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Tags
          </span>
          <div className="flex flex-wrap gap-1.5">
            {search.tag && (
              <Link
                to="/meals/recipes"
                search={navSearch({ tag: undefined, page: undefined })}
              >
                <Badge variant="destructive" className="gap-1 text-xs">
                  <X className="size-3" />
                  Clear
                </Badge>
              </Link>
            )}
            {tags.map((tag) => (
              <Link
                key={tag.slug}
                to="/meals/recipes"
                search={navSearch({ tag: tag.slug, page: undefined })}
              >
                <Badge
                  variant={search.tag === tag.slug ? "default" : "secondary"}
                  className="text-xs"
                >
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {hasFilters && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filteredItems.length} result
            {filteredItems.length !== 1 ? "s" : ""}
          </span>
          <Link to="/meals/recipes" search={{ view: search.view }}>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <X className="size-3" />
              Clear all filters
            </Button>
          </Link>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold">No Recipes Found</h3>
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? "Try adjusting your search or filters."
                : "No recipes found in your Mealie instance."}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-center">Time</TableHead>
                  <TableHead className="text-center">Servings</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead className="text-center">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((recipe) => (
                  <TableRow key={recipe.id} className="group">
                    <TableCell className="p-1">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(recipe)}
                        className="rounded p-1.5 transition-colors hover:bg-muted"
                      >
                        <Star
                          className={`size-4 ${
                            favoriteIds.has(recipe.id)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/40 group-hover:text-muted-foreground"
                          }`}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="p-1">
                      <Link
                        to="/meals/recipes/$slug"
                        params={{ slug: recipe.slug }}
                      >
                        <img
                          src={apiUrl ? recipeImageUrl(apiUrl, recipe.id) : ""}
                          alt=""
                          className="size-10 rounded object-cover"
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/meals/recipes/$slug"
                        params={{ slug: recipe.slug }}
                        className="font-medium hover:underline"
                      >
                        {recipe.name}
                      </Link>
                      {recipe.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {recipe.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {recipe.recipeCategory?.map((cat) => (
                          <Link
                            key={cat.slug}
                            to="/meals/recipes"
                            search={navSearch({
                              category: cat.slug,
                              page: undefined,
                            })}
                          >
                            <Badge
                              variant="secondary"
                              className="cursor-pointer px-1.5 py-0 text-[10px]"
                            >
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
                            to="/meals/recipes"
                            search={navSearch({
                              tag: tag.slug,
                              page: undefined,
                            })}
                          >
                            <Badge
                              variant="outline"
                              className="cursor-pointer px-1.5 py-0 text-[10px]"
                            >
                              {tag.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm whitespace-nowrap text-muted-foreground">
                      {recipe.totalTime || "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {recipe.recipeServings ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {recipe.rating ? (
                        <span className="text-sm font-medium">
                          {recipe.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs whitespace-nowrap text-muted-foreground">
                      {recipe.dateAdded || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((recipe) => (
            <Card
              key={recipe.id}
              className="relative h-full overflow-hidden py-0 transition-shadow hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => onToggleFavorite(recipe)}
                className="absolute top-2 right-2 z-10 rounded-full bg-background/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-background"
              >
                <Star
                  className={`size-4 ${
                    favoriteIds.has(recipe.id)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
              <Link
                to="/meals/recipes/$slug"
                params={{ slug: recipe.slug }}
                className="block"
              >
                <div className="relative aspect-video bg-muted">
                  <img
                    src={apiUrl ? recipeImageUrl(apiUrl, recipe.id) : ""}
                    alt={recipe.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {recipe.rating !== null && recipe.rating > 0 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                      <Star className="size-3 fill-yellow-400 text-yellow-400" />
                      {recipe.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                <CardHeader className="px-4 pt-3 pb-2">
                  <CardTitle className="line-clamp-2 text-base leading-tight">
                    {recipe.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pt-0 pb-4">
                  {recipe.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
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
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {cat.name}
                      </Badge>
                    ))}
                    {recipe.tags?.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag.slug}
                        variant="outline"
                        className="px-1.5 py-0 text-[10px]"
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 ? (
            <Link
              to="/meals/recipes"
              search={navSearch({ page: currentPage - 1 })}
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
          <span className="px-4 text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              to="/meals/recipes"
              search={navSearch({ page: currentPage + 1 })}
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
  )
}
