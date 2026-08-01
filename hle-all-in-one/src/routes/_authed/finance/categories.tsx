import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Archive, ArchiveRestore, Plus, Sparkles, Trash2 } from "lucide-react"
import {
  createCategoryFn,
  createCategoryRuleFn,
  deleteCategoryRuleFn,
  getCategoriesPageFn,
  seedDefaultCategoriesFn,
  toggleCategoryArchivedFn,
} from "@/server/finance/fns.categories"
import type {
  CategoryRow,
  CategoryRuleMatchType,
  CategoryType,
} from "@/server/finance/categories"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_authed/finance/categories")({
  loader: () => getCategoriesPageFn(),
  component: CategoriesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
]

const TYPE_HEADINGS: Record<CategoryType, string> = {
  EXPENSE: "Expense Categories",
  INCOME: "Income Categories",
  TRANSFER: "Transfer Categories",
}

const MATCH_TYPES: Array<{ value: CategoryRuleMatchType; label: string }> = [
  { value: "CONTAINS", label: "Contains" },
  { value: "STARTS_WITH", label: "Starts with" },
  { value: "EXACT", label: "Exact" },
  { value: "REGEX", label: "Regex" },
]

function CategoriesPage() {
  const { categories, rules } = Route.useLoaderData()
  const router = useRouter()
  const [seedError, setSeedError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const topLevel = categories.filter((c) => c.parentCategoryId === null)
  const subsOf = (parentId: string) =>
    categories.filter((c) => c.parentCategoryId === parentId && !c.isArchived)
  const archived = categories.filter((c) => c.isArchived)

  function refresh() {
    router.invalidate()
  }

  async function onSeedDefaults() {
    setSeedError(null)
    setSeeding(true)
    try {
      const result = await seedDefaultCategoriesFn()
      if ("error" in result && typeof result.error === "string") {
        setSeedError(result.error)
        return
      }
      refresh()
    } catch {
      setSeedError("Could not seed default categories.")
    } finally {
      setSeeding(false)
    }
  }

  async function onArchiveToggle(cat: CategoryRow) {
    await toggleCategoryArchivedFn({
      data: { id: cat.id, isArchived: !cat.isArchived },
    })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Organize income, expenses, and transfers. Two levels deep.
        </p>
      </div>

      {categories.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No categories yet. Seed a sensible default set, or add your own
              below.
            </p>
            <Button onClick={onSeedDefaults} disabled={seeding}>
              <Sparkles className="size-4" />
              {seeding ? "Seeding…" : "Seed default categories"}
            </Button>
            {seedError && (
              <p className="mt-2 text-sm text-destructive">{seedError}</p>
            )}
          </CardContent>
        </Card>
      )}

      <AddCategoryCard
        parents={topLevel.filter((c) => !c.isArchived)}
        onSaved={refresh}
      />

      {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((type) => {
        const group = topLevel.filter((c) => c.type === type && !c.isArchived)
        return (
          <div key={type} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {TYPE_HEADINGS[type]}
              <Badge variant="secondary" className="ml-2">
                {group.length}
              </Badge>
            </h2>
            {group.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {type.toLowerCase()} categories yet.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {group.map((cat) => {
                  const subs = subsOf(cat.id)
                  return (
                    <div key={cat.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: cat.color ?? "#6366f1",
                            }}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {cat.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {cat.transactionCount} transactions
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          title="Archive"
                          onClick={() => onArchiveToggle(cat)}
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      </div>
                      {subs.length > 0 && (
                        <div className="mt-2 space-y-1 border-l pl-5">
                          {subs.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div
                                  className="size-2 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: sub.color ?? "#6366f1",
                                  }}
                                />
                                <span className="truncate text-xs">
                                  {sub.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {sub.transactionCount}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground"
                                title="Archive"
                                onClick={() => onArchiveToggle(sub)}
                              >
                                <Archive className="size-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Archived
          </h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {archived.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border p-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: cat.color ?? "#6366f1" }}
                  />
                  <span className="text-sm">{cat.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Restore"
                  onClick={() => onArchiveToggle(cat)}
                >
                  <ArchiveRestore className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <RulesCard
        rules={rules}
        categories={categories.filter((c) => !c.isArchived)}
        onChanged={refresh}
      />
    </div>
  )
}

function AddCategoryCard({
  parents,
  onSaved,
}: {
  parents: Array<CategoryRow>
  onSaved: () => void
}) {
  const [type, setType] = useState<CategoryType>("EXPENSE")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const parentOptions = parents.filter((p) => p.type === type)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createCategoryFn({
        data: {
          name: String(f.get("name") ?? ""),
          type,
          color: String(f.get("color") ?? "") || null,
          icon: "",
          parentCategoryId: String(f.get("parentCategoryId") ?? "") || null,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      onSaved()
    } catch {
      setError("Could not add category.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Category</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="cat-name" className="text-xs">
              Name
            </Label>
            <Input
              id="cat-name"
              name="name"
              placeholder="Category name"
              required
              className="w-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-type" className="text-xs">
              Type
            </Label>
            <select
              id="cat-type"
              name="type"
              className={`${selectClass} w-36`}
              value={type}
              onChange={(e) => setType(e.target.value as CategoryType)}
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-parent" className="text-xs">
              Parent (optional)
            </Label>
            <select
              id="cat-parent"
              name="parentCategoryId"
              className={`${selectClass} w-44`}
            >
              <option value="">Top level</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium">Color</span>
            <div className="flex gap-1">
              {COLORS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    defaultChecked={color === "#6366f1"}
                    className="peer sr-only"
                  />
                  <div
                    className="h-6 w-6 rounded-full border-2 border-transparent transition-all peer-checked:border-foreground"
                    style={{ backgroundColor: color }}
                  />
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add"}
          </Button>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

// Auto-categorization rules consumed by the bulk-categorize and bank-import
// features. Minimal management UI: list, add, delete.
function RulesCard({
  rules,
  categories,
  onChanged,
}: {
  rules: Array<{
    id: string
    pattern: string
    matchType: CategoryRuleMatchType
    categoryName: string
    assignPayee: string | null
    matchCount: number
    isActive: boolean
  }>
  categories: Array<CategoryRow>
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createCategoryRuleFn({
        data: {
          pattern: String(f.get("pattern") ?? ""),
          matchType: String(f.get("matchType") ?? "CONTAINS") as
            "CONTAINS" | "STARTS_WITH" | "EXACT" | "REGEX",
          categoryId: String(f.get("categoryId") ?? ""),
          assignPayee: String(f.get("assignPayee") ?? ""),
          priority: 0,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      onChanged()
    } catch {
      setError("Could not add rule.")
    } finally {
      setPending(false)
    }
  }

  async function onDelete(id: string) {
    await deleteCategoryRuleFn({ data: { id } })
    onChanged()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Auto-Categorization Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="rule-pattern" className="text-xs">
              Pattern
            </Label>
            <Input
              id="rule-pattern"
              name="pattern"
              placeholder="e.g. WALMART"
              required
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-matchType" className="text-xs">
              Match
            </Label>
            <select
              id="rule-matchType"
              name="matchType"
              className={`${selectClass} w-36`}
              defaultValue="CONTAINS"
            >
              {MATCH_TYPES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-category" className="text-xs">
              Category
            </Label>
            <select
              id="rule-category"
              name="categoryId"
              className={`${selectClass} w-44`}
              required
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentCategoryId ? `— ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-assignPayee" className="text-xs">
              Set payee (optional)
            </Label>
            <Input
              id="rule-assignPayee"
              name="assignPayee"
              placeholder="e.g. Walmart"
              className="w-40"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Rule"}
          </Button>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rules yet. Rules auto-assign categories during bank import and
            bulk categorization.
          </p>
        ) : (
          <div className="divide-y">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {rule.pattern}
                    </code>
                    <Badge variant="outline" className="text-[10px]">
                      {MATCH_TYPES.find((m) => m.value === rule.matchType)
                        ?.label ?? rule.matchType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      → {rule.categoryName}
                    </span>
                    {rule.assignPayee && (
                      <span className="text-xs text-muted-foreground">
                        payee: {rule.assignPayee}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Matched {rule.matchCount} time
                    {rule.matchCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Delete rule"
                  onClick={() => onDelete(rule.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
