import { useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, Check, Copy, Package, Trash2 } from "lucide-react"
import {
  addListItemFn,
  duplicateListFn,
  getShoppingListPageFn,
  removeListItemFn,
  stockPantryFromListFn,
  toggleListItemFn,
  updateListStatusFn,
} from "@/server/meals/fns.shopping-lists"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/meals/shopping-lists/$id")({
  loader: async ({ params }) => {
    const data = await getShoppingListPageFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: ShoppingListDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const PRODUCT_UNITS = [
  "EACH",
  "LB",
  "OZ",
  "GALLON",
  "QUART",
  "LITER",
  "COUNT",
  "PACK",
  "BAG",
  "BOX",
  "CAN",
  "BOTTLE",
  "BUNCH",
  "DOZEN",
] as const

const UNIT_LABELS: Record<string, string> = {
  EACH: "each",
  LB: "lb",
  OZ: "oz",
  GALLON: "gal",
  QUART: "qt",
  LITER: "L",
  COUNT: "ct",
  PACK: "pack",
  BAG: "bag",
  BOX: "box",
  CAN: "can",
  BOTTLE: "bottle",
  BUNCH: "bunch",
  DOZEN: "dozen",
}

function formatUnit(unit: string | null): string {
  if (!unit) return ""
  return UNIT_LABELS[unit] ?? unit.toLowerCase()
}

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  COMPLETED: "outline",
}

// Status transitions (legacy rules).
const nextStatus: Record<string, "ACTIVE" | "COMPLETED" | null> = {
  DRAFT: "ACTIVE",
  ACTIVE: "COMPLETED",
  COMPLETED: null,
}
const prevStatus: Record<string, "DRAFT" | "ACTIVE" | null> = {
  DRAFT: null,
  ACTIVE: "DRAFT",
  COMPLETED: "ACTIVE",
}

function ShoppingListDetailPage() {
  const { list, items, products, stores, bestPrices, pantry } =
    Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Add-item form state.
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unit, setUnit] = useState("")
  const [notes, setNotes] = useState("")

  async function run(fn: () => Promise<{ error?: string } | unknown>) {
    setError(null)
    setMessage(null)
    setPending(true)
    try {
      const result = (await fn()) as { error?: string } | undefined
      if (result && "error" in result && typeof result.error === "string") {
        setError(result.error)
      }
      router.invalidate()
    } catch {
      setError("Something went wrong.")
    }
    setPending(false)
  }

  async function onAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!productId) return
    await run(() =>
      addListItemFn({
        data: {
          listId: list.id,
          productId,
          quantity: parseFloat(quantity) || 1,
          unit,
          notes,
        },
      })
    )
    setProductId("")
    setQuantity("1")
    setUnit("")
    setNotes("")
  }

  async function onStockPantry() {
    setError(null)
    setMessage(null)
    setPending(true)
    try {
      const result = await stockPantryFromListFn({
        data: { listId: list.id },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else if ("stocked" in result) {
        setMessage(
          `Stocked the pantry from ${result.stocked} checked item${result.stocked !== 1 ? "s" : ""}.`
        )
      }
      router.invalidate()
    } catch {
      setError("Could not stock the pantry.")
    }
    setPending(false)
  }

  async function onDuplicate() {
    try {
      const result = await duplicateListFn({ data: { id: list.id } })
      if ("id" in result && result.id) {
        navigate({
          to: "/meals/shopping-lists/$id",
          params: { id: result.id },
        })
      }
    } catch {
      setError("Could not duplicate the list.")
    }
  }

  // Shopping strategy: split unchecked items into pantry-covered, grouped by
  // cheapest store, and unpriced (legacy logic preserved).
  type ItemRow = (typeof items)[number]
  const storeGroups = new Map<
    string,
    {
      storeName: string
      storeColor: string | null
      items: Array<ItemRow>
      subtotal: number
    }
  >()
  const unpricedItems: Array<ItemRow> = []
  const pantryFullItems: Array<ItemRow> = []

  for (const item of items) {
    if (item.isChecked) continue
    const needed = item.quantity
    const have = pantry[item.productId] ?? 0
    const buy = Math.max(0, needed - have)
    if (buy === 0) {
      pantryFullItems.push(item)
      continue
    }
    const best = bestPrices[item.productId]
    if (!best) {
      unpricedItems.push(item)
      continue
    }
    let group = storeGroups.get(best.storeId)
    if (!group) {
      group = {
        storeName: best.storeName,
        storeColor: best.storeColor,
        items: [],
        subtotal: 0,
      }
      storeGroups.set(best.storeId, group)
    }
    group.items.push(item)
    group.subtotal += best.price * buy
  }

  const totalEstimated = [...storeGroups.values()].reduce(
    (sum, g) => sum + g.subtotal,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/meals/shopping-lists">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{list.name}</h1>
            <Badge variant={statusVariant[list.status]}>
              {statusLabels[list.status]}
            </Badge>
          </div>
          {list.notes && (
            <p className="mt-1 text-sm text-muted-foreground">{list.notes}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {prevStatus[list.status] && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateListStatusFn({
                    data: {
                      id: list.id,
                      status: prevStatus[list.status] as "DRAFT" | "ACTIVE",
                    },
                  })
                )
              }
            >
              Back to {statusLabels[prevStatus[list.status] as string]}
            </Button>
          )}
          {nextStatus[list.status] && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateListStatusFn({
                    data: {
                      id: list.id,
                      status: nextStatus[list.status] as "ACTIVE" | "COMPLETED",
                    },
                  })
                )
              }
            >
              Mark {statusLabels[nextStatus[list.status] as string]}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onDuplicate}
          >
            <Copy className="size-4" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onStockPantry}
          >
            <Package className="size-4" />
            Stock Pantry from Checked Items
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && (
        <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onAddItem}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-2">
              <Label htmlFor="item-product">Product *</Label>
              <select
                id="item-product"
                className={selectClass}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-unit">Unit</Label>
              <select
                id="item-unit"
                className={selectClass}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="">Default</option>
                {PRODUCT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {formatUnit(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Input
                id="item-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={pending || !productId}>
                Add Item
              </Button>
            </div>
          </form>
          {products.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              No products yet — add some on the Products page or import them
              from a recipe.
            </p>
          )}
        </CardContent>
      </Card>

      {items.length > 0 &&
        (storeGroups.size > 0 ||
          unpricedItems.length > 0 ||
          pantryFullItems.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Shopping Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pantryFullItems.length > 0 && (
                <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
                  <h4 className="mb-2 font-semibold text-green-700 dark:text-green-400">
                    Covered by Pantry
                  </h4>
                  <ul className="space-y-1">
                    {pantryFullItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400"
                      >
                        <Check className="size-3.5" />
                        {item.productName} x{item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {[...storeGroups.values()].map((group) => (
                <div key={group.storeName} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="size-4 rounded-full border"
                      style={{
                        backgroundColor: group.storeColor || "#94a3b8",
                      }}
                    />
                    <h4 className="font-semibold">{group.storeName}</h4>
                    <span className="ml-auto text-sm font-medium">
                      Subtotal: {formatCurrency(group.subtotal)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const best = bestPrices[item.productId]
                      const needed = item.quantity
                      const have = pantry[item.productId] ?? 0
                      const buy = Math.max(0, needed - have)
                      return (
                        <li
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {item.productName} x{buy}
                            {have > 0 && (
                              <span className="ml-1 text-muted-foreground">
                                (need {needed}, have {have})
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {best ? formatCurrency(best.price) : "—"} each
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}

              {unpricedItems.length > 0 && (
                <div className="rounded-lg border border-dashed p-4">
                  <h4 className="mb-2 font-semibold text-muted-foreground">
                    Unpriced Items
                  </h4>
                  <ul className="space-y-1">
                    {unpricedItems.map((item) => (
                      <li
                        key={item.id}
                        className="text-sm text-muted-foreground"
                      >
                        {item.productName} x{item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {totalEstimated > 0 && (
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Estimated Cost</span>
                  <span>{formatCurrency(totalEstimated)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No items yet. Use the form above to add products to this list.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Check</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Need</TableHead>
                  <TableHead>Have</TableHead>
                  <TableHead>Buy</TableHead>
                  <TableHead className="text-right">Best Price</TableHead>
                  <TableHead>Best Store</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const best = bestPrices[item.productId]
                  const needed = item.quantity
                  const have = pantry[item.productId] ?? 0
                  const buy = Math.max(0, needed - have)
                  return (
                    <TableRow
                      key={item.id}
                      className={item.isChecked ? "opacity-50" : ""}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              toggleListItemFn({ data: { id: item.id } })
                            )
                          }
                        >
                          <div
                            className={`flex size-5 items-center justify-center rounded border-2 ${
                              item.isChecked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground"
                            }`}
                          >
                            {item.isChecked && (
                              <Check className="size-3" strokeWidth={3} />
                            )}
                          </div>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-medium ${item.isChecked ? "line-through" : ""}`}
                        >
                          {item.productName}
                        </span>
                        {item.categoryName && (
                          <div className="text-xs text-muted-foreground">
                            {item.categoryName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {needed}
                        {item.unit && (
                          <span className="ml-1 text-muted-foreground">
                            {formatUnit(item.unit)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {have > 0 ? (
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {have}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {buy === 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                            <Check className="size-3.5" />
                            In pantry
                          </span>
                        ) : buy < needed ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {buy}
                          </span>
                        ) : (
                          <span>{buy}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {best ? formatCurrency(best.price) : "—"}
                      </TableCell>
                      <TableCell>
                        {best ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="size-3 rounded-full border"
                              style={{
                                backgroundColor: best.storeColor || "#94a3b8",
                              }}
                            />
                            <span className="text-sm">{best.storeName}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              removeListItemFn({ data: { id: item.id } })
                            )
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          {stores.length === 0 && items.length > 0 && (
            <p className="px-6 pt-3 text-xs text-muted-foreground">
              Add stores and log prices to see best-store suggestions here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
