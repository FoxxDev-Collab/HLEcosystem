import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  ChefHat,
  Lightbulb,
  Loader2,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react"
import {
  createListFromAiFn,
  generateShoppingListFn,
  getGeneratePageFn,
} from "@/server/meals/fns.shopping-lists"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_authed/meals/shopping-lists/generate")({
  loader: () => getGeneratePageFn(),
  component: GenerateListPage,
})

type GeneratedItem = {
  name: string
  quantity: number | string
  unit: string | null
  category: string
  notes: string | null
  selected: boolean
}

function GenerateListPage() {
  const { mealieConnected, aiConfigured } = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/meals/shopping-lists"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5 text-primary" />
            Smart Shopping List
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate an optimized list from your weekly meal plan, minus
            what&apos;s in your pantry.
          </p>
        </div>
      </div>

      {!mealieConnected ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ChefHat className="mx-auto mb-3 size-8 text-muted-foreground" />
            <h3 className="font-semibold">Mealie Not Connected</h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Connect Mealie in Settings to generate shopping lists from your
              meal plan.
            </p>
            <Link to="/meals/settings">
              <Button variant="outline">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Generator aiConfigured={aiConfigured} />
      )}
    </div>
  )
}

function Generator({ aiConfigured }: { aiConfigured: boolean }) {
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Array<GeneratedItem>>([])
  const [tips, setTips] = useState<Array<string>>([])
  const [recipesUsed, setRecipesUsed] = useState<Array<string>>([])
  const [hasResult, setHasResult] = useState(false)
  const [listName, setListName] = useState("")

  async function onGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const result = await generateShoppingListFn()
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else if ("items" in result) {
        setItems(result.items.map((i) => ({ ...i, selected: true })))
        setTips(result.tips)
        setRecipesUsed(result.recipesUsed)
        setHasResult(true)
        const today = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
        setListName(`Meal Plan — ${today}`)
      }
    } catch {
      setError("Generation failed.")
    }
    setGenerating(false)
  }

  async function onCreate() {
    setError(null)
    setCreating(true)
    try {
      const selected = items
        .filter((i) => i.selected)
        .map(({ name, quantity, unit }) => ({ name, quantity, unit }))
      const result = await createListFromAiFn({
        data: { name: listName.trim(), items: selected },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else if ("id" in result && result.id) {
        navigate({
          to: "/meals/shopping-lists/$id",
          params: { id: result.id },
        })
        return
      }
    } catch {
      setError("Could not create the list.")
    }
    setCreating(false)
  }

  const selectedCount = items.filter((i) => i.selected).length

  const groupedItems = items.reduce<
    Record<string, Array<GeneratedItem & { index: number }>>
  >((acc, item, index) => {
    const cat = item.category || "Other"
    acc[cat] = acc[cat] ?? []
    acc[cat].push({ ...item, index })
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {!hasResult && (
        <Card>
          <CardHeader>
            <CardTitle>Generate from Meal Plan</CardTitle>
            <CardDescription>
              Fetches this week&apos;s meal plan from Mealie, checks your
              pantry, and creates an optimized shopping list with only what you
              need to buy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onGenerate} disabled={generating || !aiConfigured}>
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing recipes &amp; pantry…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate Shopping List
                </>
              )}
            </Button>
            {!aiConfigured && (
              <p className="mt-3 text-sm text-muted-foreground">
                AI features not configured — set CLAUDE_API_URL and
                CLAUDE_API_SERVICE_SECRET to enable smart list generation.
              </p>
            )}
            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasResult && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ChefHat className="size-4" />
                Recipes this week ({recipesUsed.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {recipesUsed.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Shopping List
                  <Badge variant="outline">
                    {selectedCount} of {items.length} items
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setItems((prev) => {
                      const allSelected = prev.every((i) => i.selected)
                      return prev.map((i) => ({ ...i, selected: !allSelected }))
                    })
                  }
                >
                  {items.every((i) => i.selected)
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(groupedItems)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([category, categoryItems]) => (
                    <div key={category}>
                      <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {categoryItems.map((item) => (
                          <div
                            key={item.index}
                            className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50 ${
                              !item.selected ? "opacity-50" : ""
                            }`}
                          >
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() =>
                                setItems((prev) =>
                                  prev.map((it, i) =>
                                    i === item.index
                                      ? { ...it, selected: !it.selected }
                                      : it
                                  )
                                )
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium">
                                {item.name}
                              </span>
                              {item.notes && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({item.notes})
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {tips.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="size-4 text-yellow-500" />
                  Shopping Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="py-4">
              {error && (
                <p className="mb-3 text-sm text-destructive">{error}</p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1 space-y-2">
                  <Label htmlFor="ai-list-name">List Name</Label>
                  <Input
                    id="ai-list-name"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="Shopping list name"
                  />
                </div>
                <Button
                  onClick={onCreate}
                  disabled={creating || selectedCount === 0 || !listName.trim()}
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="size-4" />
                      Create List ({selectedCount} items)
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setHasResult(false)
                    setItems([])
                    setError(null)
                  }}
                >
                  <X className="size-4" />
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
