import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Clock,
  Package,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react"
import { getWhatCanICookFn } from "@/server/meals/fns.mealie"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export const Route = createFileRoute("/_authed/meals/recipes/what-can-i-cook")({
  loader: () => getWhatCanICookFn(),
  component: WhatCanICookPage,
})

function WhatCanICookPage() {
  const { configured, apiUrl, pantryCount, recipesScanned, matches } =
    Route.useLoaderData()

  const header = (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <UtensilsCrossed className="size-5" />
        What Can I Cook?
      </h1>
      <p className="text-sm text-muted-foreground">
        Find recipes based on what you already have
      </p>
    </div>
  )

  if (!configured) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold">Mealie Not Connected</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Connect your Mealie instance in Settings to match recipes with
              your pantry.
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

  if (pantryCount === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold">Pantry is Empty</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Add items to your pantry first, then come back to find recipes you
              can make.
            </p>
            <Link to="/meals/pantry">
              <Button>
                <Package className="size-4" />
                Go to Pantry
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <UtensilsCrossed className="size-5" />
          What Can I Cook?
        </h1>
        <p className="text-sm text-muted-foreground">
          {pantryCount} pantry items matched against {recipesScanned} recipes
        </p>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold">No Matching Recipes</h3>
            <p className="text-sm text-muted-foreground">
              None of your Mealie recipes matched your current pantry items.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {matches.map((match) => (
            <Card key={match.slug} className="overflow-hidden py-0">
              <div className="flex gap-0">
                <div className="hidden w-40 shrink-0 sm:block">
                  <img
                    src={
                      apiUrl
                        ? `${apiUrl}/api/media/recipes/${match.id}/images/min-original.webp`
                        : ""
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex-1 space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{match.name}</h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {match.totalTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {match.totalTime}
                          </span>
                        )}
                        {match.recipeServings && (
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {match.recipeServings} servings
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to="/meals/recipes/$slug"
                      params={{ slug: match.slug }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1"
                      >
                        View <ArrowRight className="size-3" />
                      </Button>
                    </Link>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {match.matchedIngredients.length} of{" "}
                        {match.matchedIngredients.length +
                          match.missingIngredients.length}{" "}
                        ingredients
                      </span>
                      <span
                        className={
                          match.matchPercent >= 80
                            ? "font-semibold text-green-600"
                            : match.matchPercent >= 50
                              ? "font-semibold text-yellow-600"
                              : "text-muted-foreground"
                        }
                      >
                        {match.matchPercent}%
                      </span>
                    </div>
                    <Progress value={match.matchPercent} />
                  </div>

                  {match.missingIngredients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        Missing:
                      </span>
                      {match.missingIngredients.slice(0, 5).map((ing) => (
                        <Badge
                          key={ing}
                          variant="outline"
                          className="py-0 text-xs"
                        >
                          {ing}
                        </Badge>
                      ))}
                      {match.missingIngredients.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{match.missingIngredients.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
