import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  ExternalLink,
  ListChecks,
  ShoppingCart,
} from "lucide-react"
import { getMealieShoppingListsFn } from "@/server/meals/fns.mealie"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/meals/mealie/shopping-lists/")({
  loader: () => getMealieShoppingListsFn(),
  component: MealieShoppingListsPage,
})

function MealieShoppingListsPage() {
  const { configured, apiUrl, lists, error } = Route.useLoaderData()

  if (!configured) {
    return (
      <div className="max-w-[1200px] space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Mealie Shopping Lists</h1>
          <p className="text-sm text-muted-foreground">
            Connect Mealie to view shopping lists
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
              <ShoppingCart className="size-7 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-base font-semibold">
              Mealie not connected
            </h3>
            <p className="mx-auto mb-4 max-w-sm text-sm text-muted-foreground">
              Connect your Mealie instance in Settings to sync shopping lists.
            </p>
            <Link to="/meals/settings">
              <Button>Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Mealie Shopping Lists</h1>
          <p className="text-sm text-muted-foreground">
            {lists.length} list{lists.length !== 1 ? "s" : ""} from Mealie
          </p>
        </div>
        {apiUrl && (
          <a
            href={`${apiUrl}/g/home/shopping-lists`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="size-3.5" />
              Open in Mealie
            </Button>
          </a>
        )}
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {lists.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
              <ListChecks className="size-7 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-base font-semibold">No shopping lists</h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Create a shopping list in Mealie and it will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {lists.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              to="/meals/mealie/shopping-lists/$id"
              params={{ id: list.id }}
            >
              <Card className="h-full cursor-pointer transition-colors hover:bg-accent/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <ShoppingCart className="size-4 text-primary" />
                    {list.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">
                    Updated {formatDateTime(list.updatedAt)}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                    View items
                    <ArrowRight className="size-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
