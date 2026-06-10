import { useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import {
  Apple,
  ArrowLeft,
  Check,
  ChefHat,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Plus,
  ShoppingCart,
  Star,
  Timer,
  Users,
} from "lucide-react"
import {
  getRecipeDetailFn,
  importRecipeProductsFn,
  toggleFavoriteRecipeFn,
} from "@/server/meals/fns.mealie"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/meals/recipes/$slug")({
  loader: async ({ params }) => {
    const data = await getRecipeDetailFn({ data: { slug: params.slug } })
    if (!data) throw notFound()
    return data
  },
  component: RecipeDetailPage,
})

function RecipeDetailPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const {
    apiUrl,
    recipe,
    isFavorite,
    matches,
    matchedCount,
    newCount,
    totalCost,
    unpricedCount,
  } = data

  const perServingCost =
    recipe.recipeServings && totalCost > 0
      ? totalCost / recipe.recipeServings
      : null

  async function onToggleFavorite() {
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
      // Non-fatal.
    }
  }

  async function onImportProducts() {
    setPending(true)
    setImportMessage(null)
    try {
      const result = await importRecipeProductsFn({
        data: { slug: recipe.slug },
      })
      if ("error" in result && typeof result.error === "string") {
        setImportMessage(result.error)
      } else if ("imported" in result) {
        setImportMessage(`Imported ${result.imported} products.`)
        router.invalidate()
      }
    } catch {
      setImportMessage("Import failed.")
    }
    setPending(false)
  }

  const nutrition = recipe.nutrition
  const nutrients = nutrition
    ? [
        { label: "Calories", value: nutrition.calories, unit: "kcal" },
        { label: "Protein", value: nutrition.proteinContent, unit: "g" },
        { label: "Carbs", value: nutrition.carbohydrateContent, unit: "g" },
        { label: "Fat", value: nutrition.fatContent, unit: "g" },
        { label: "Fiber", value: nutrition.fiberContent, unit: "g" },
        { label: "Sugar", value: nutrition.sugarContent, unit: "g" },
        { label: "Sodium", value: nutrition.sodiumContent, unit: "mg" },
      ]
        .map((n) => ({ ...n, amount: parseAmount(n.value) }))
        .filter((n) => n.amount !== null)
    : []

  return (
    <div className="space-y-6">
      <Link
        to="/meals/recipes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Recipes
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          <img
            src={`${apiUrl}/api/media/recipes/${recipe.id}/images/min-original.webp`}
            alt={recipe.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{recipe.name}</h1>
            {recipe.description && (
              <p className="mt-1 text-muted-foreground">{recipe.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {recipe.totalTime && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-4" />
                <span>Total: {recipe.totalTime}</span>
              </div>
            )}
            {recipe.prepTime && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="size-4" />
                <span>Prep: {recipe.prepTime}</span>
              </div>
            )}
            {recipe.performTime && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="size-4" />
                <span>Cook: {recipe.performTime}</span>
              </div>
            )}
            {recipe.recipeServings && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-4" />
                <span>{recipe.recipeServings} servings</span>
              </div>
            )}
            {totalCost > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-4" />
                <span>~{formatCurrency(totalCost)}</span>
                {perServingCost && (
                  <span className="text-xs">
                    ({formatCurrency(perServingCost)}/serving)
                  </span>
                )}
                {unpricedCount > 0 && (
                  <span className="text-xs opacity-70">
                    ({unpricedCount} unpriced)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {recipe.recipeCategory?.map((cat) => (
              <Badge key={cat.slug} variant="secondary">
                {cat.name}
              </Badge>
            ))}
            {recipe.tags?.map((tag) => (
              <Badge key={tag.slug} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={onToggleFavorite}
              title={isFavorite ? "Remove favorite" : "Add favorite"}
            >
              <Star
                className={`size-5 ${
                  isFavorite
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </Button>
            <Link
              to="/meals/mealie/sync-review"
              search={{ recipeId: recipe.id, recipeName: recipe.name }}
            >
              <Button>
                <ShoppingCart className="size-4" />
                Add to Shopping List
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={onImportProducts}
              disabled={pending}
            >
              <Download className="size-4" />
              {pending ? "Importing…" : "Import All as Products"}
            </Button>
            <a
              href={`${apiUrl}/g/home/r/${recipe.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost">
                <ExternalLink className="size-4" />
                View in Mealie
              </Button>
            </a>
          </div>
          {importMessage && (
            <p className="text-sm text-muted-foreground">{importMessage}</p>
          )}

          {recipe.orgURL && (
            <a
              href={recipe.orgURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              Original source
            </a>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ingredients ({recipe.recipeIngredient.length})</span>
            <span className="text-sm font-normal text-muted-foreground">
              {matchedCount} matched, {newCount} new
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recipe.recipeIngredient.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No ingredients listed for this recipe.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Status</TableHead>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.recipeIngredient.map((ing, idx) => {
                  const match = matches[idx]
                  return (
                    <TableRow key={ing.referenceId || idx}>
                      <TableCell>
                        {match?.skipped ? (
                          <span className="text-muted-foreground">-</span>
                        ) : match?.matched ? (
                          <Check className="size-4 text-green-600" />
                        ) : (
                          <Plus className="size-4 text-blue-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {ing.food?.name || ing.display}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ing.quantity ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ing.unit?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ing.note || "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {recipe.recipeInstructions && recipe.recipeInstructions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="size-5" />
              Instructions ({recipe.recipeInstructions.length} steps)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-6">
              {recipe.recipeInstructions.map((step, idx) => (
                <li key={step.id || idx} className="flex gap-4">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {idx + 1}
                  </div>
                  <div className="space-y-1 pt-1">
                    {step.title && (
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                    )}
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {nutrients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="size-5" />
              Nutrition Facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {nutrients.map((n) => (
                <div
                  key={n.label}
                  className="rounded-lg border p-3 text-center"
                >
                  <div className="text-2xl font-bold">
                    {n.amount}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {n.unit}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {n.label}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function parseAmount(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.match(/([\d.]+)/)
  return match ? parseFloat(match[1]) : null
}
