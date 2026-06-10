import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Package,
  PackageOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import {
  addToPantryFn,
  adjustPantryFn,
  getPantryFn,
  removeFromPantryFn,
  setPantryExpirationFn,
  setPantryMinFn,
  setPantryQuantityFn,
  stockFromListFn,
} from "@/server/meals/fns.pantry"
import type { PantryFilter, PantryItemRow } from "@/server/meals/pantry"
import type { ProductUnit } from "@/server/meals/products"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PRODUCT_UNITS, formatUnit, selectClass } from "./products.index"

const pantrySearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  filter: z
    .enum(["in-stock", "low-stock", "out-of-stock", "expiring"])
    .optional()
    .catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
})

export const Route = createFileRoute("/_authed/meals/pantry")({
  validateSearch: (search) => pantrySearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    q: search.q,
    filter: search.filter,
    page: search.page,
  }),
  loader: ({ deps }) =>
    getPantryFn({
      data: {
        q: deps.q,
        filter: deps.filter ?? "all",
        page: deps.page ?? 1,
        limit: 50,
        // Legacy UX: the expiring tab sorts soonest-first, the rest by name.
        sort: deps.filter === "expiring" ? "expiration" : "name",
        dir: "asc",
      },
    }),
  component: PantryPage,
})

const FILTER_TABS: Array<{ key: PantryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "in-stock", label: "In Stock" },
  { key: "low-stock", label: "Low Stock" },
  { key: "out-of-stock", label: "Out of Stock" },
  { key: "expiring", label: "Expiring" },
]

function PantryPage() {
  const {
    items,
    totalCount,
    page,
    pageCount,
    stats,
    availableProducts,
    activeLists,
  } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const filter: PantryFilter = search.filter ?? "all"
  const [listError, setListError] = useState<string | null>(null)

  function refresh() {
    router.invalidate()
  }

  function setFilter(next: PantryFilter) {
    navigate({
      search: (prev) => ({
        ...prev,
        filter: next === "all" ? undefined : next,
        page: undefined,
      }),
    })
  }

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const q = String(f.get("q") ?? "").trim()
    navigate({
      search: (prev) => ({ ...prev, q: q || undefined, page: undefined }),
    })
  }

  function goToPage(next: number) {
    navigate({
      search: (prev) => ({ ...prev, page: next <= 1 ? undefined : next }),
    })
  }

  async function stockFrom(listId: string) {
    setListError(null)
    try {
      const result = await stockFromListFn({ data: { listId } })
      if ("error" in result && typeof result.error === "string") {
        setListError(result.error)
        return
      }
      refresh()
    } catch {
      setListError("Could not stock from that list.")
    }
  }

  const tabCounts: Record<PantryFilter, number> = {
    all: stats.total,
    "in-stock": stats.inStock,
    "low-stock": stats.lowStock,
    "out-of-stock": stats.outOfStock,
    expiring: stats.expiring,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pantry</h1>
        <p className="text-sm text-muted-foreground">
          Track what you have on hand.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Items" value={stats.total} />
        <StatCard
          label="Low Stock"
          value={stats.lowStock}
          icon={
            stats.lowStock > 0 ? (
              <AlertTriangle className="size-3 text-amber-600 dark:text-amber-500" />
            ) : null
          }
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStock}
          icon={
            stats.outOfStock > 0 ? (
              <PackageOpen className="size-3 text-destructive" />
            ) : null
          }
        />
        <StatCard
          label="Expiring Soon"
          value={stats.expiring}
          icon={
            stats.expiring > 0 ? (
              <Clock className="size-3 text-destructive" />
            ) : null
          }
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={onSearchSubmit} className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="Search pantry..."
            className="pl-9"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
            >
              <Badge
                variant={filter === tab.key ? "default" : "outline"}
                className={
                  tab.key === "expiring" &&
                  stats.expiring > 0 &&
                  filter !== tab.key
                    ? "border-destructive/50 text-destructive"
                    : ""
                }
              >
                {tab.label} ({tabCounts[tab.key]})
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {activeLists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Stock from shopping list
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Add checked items from a completed shopping trip to your pantry.
            </p>
            <div className="flex flex-wrap gap-2">
              {activeLists.map((list) => (
                <Button
                  key={list.id}
                  variant="outline"
                  size="sm"
                  onClick={() => stockFrom(list.id)}
                >
                  <Plus className="size-4" />
                  {list.name} ({list.checkedCount} checked)
                </Button>
              ))}
            </div>
            {listError && (
              <p className="mt-2 text-sm text-destructive">{listError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {availableProducts.length > 0 && (
        <AddToPantryCard products={availableProducts} onAdded={refresh} />
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 size-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">
              {stats.total === 0
                ? "Your pantry is empty"
                : "No items match your filter"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {stats.total === 0
                ? "Add products to your pantry to start tracking stock."
                : "Try adjusting your search or filter."}
            </p>
            {stats.total === 0 && availableProducts.length === 0 && (
              <Link to="/meals/products" className="mt-3">
                <Button variant="outline" size="sm">
                  Add products first
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pantry items ({totalCount}
              {totalCount !== stats.total ? ` of ${stats.total}` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-40">Quantity</TableHead>
                  <TableHead className="w-32">Min qty</TableHead>
                  <TableHead className="w-44">Expires</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Quick</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <PantryItemRowView
                    key={item.id}
                    item={item}
                    onChanged={refresh}
                  />
                ))}
              </TableBody>
            </Table>
            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between border-t px-6 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pageCount}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {icon}
        </div>
        <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

function stockStatus(
  quantity: number,
  minQuantity: number | null
): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (quantity <= 0) return { label: "Out", variant: "destructive" }
  if (minQuantity !== null && quantity <= minQuantity) {
    return { label: "Low", variant: "secondary" }
  }
  return { label: "In Stock", variant: "default" }
}

function expirationStatus(
  expiresAt: string | null
): { label: string; className: string; isExpired: boolean } | null {
  if (!expiresAt) return null
  const [yy, mm, dd] = expiresAt.split("-").map(Number)
  const exp = new Date(yy, mm - 1, dd)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((exp.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) {
    return {
      label: `Expired ${Math.abs(diffDays)}d ago`,
      className: "font-medium text-destructive",
      isExpired: true,
    }
  }
  if (diffDays === 0) {
    return {
      label: "Expires today",
      className: "font-medium text-destructive",
      isExpired: false,
    }
  }
  if (diffDays <= 7) {
    return {
      label: `Expires in ${diffDays}d`,
      className:
        diffDays <= 3
          ? "font-medium text-amber-600 dark:text-amber-500"
          : "text-amber-600 dark:text-amber-500",
      isExpired: false,
    }
  }
  return {
    label: formatDate(expiresAt),
    className: "text-muted-foreground",
    isExpired: false,
  }
}

function PantryItemRowView({
  item,
  onChanged,
}: {
  item: PantryItemRow
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const status = stockStatus(item.quantity, item.minQuantity)
  const expStatus = expirationStatus(item.expiresAt)
  const unitLabel = formatUnit(item.unit ?? item.defaultUnit)

  async function run(action: () => Promise<{ error: string } | { ok: true }>) {
    setError(null)
    try {
      const result = await action()
      if ("error" in result) {
        setError(result.error)
        return
      }
      onChanged()
    } catch {
      setError("Something went wrong.")
    }
  }

  function setQuantity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const quantity = parseFloat(
      String(new FormData(e.currentTarget).get("quantity") ?? "")
    )
    if (isNaN(quantity) || quantity < 0) {
      setError("Enter a valid quantity.")
      return
    }
    run(() => setPantryQuantityFn({ data: { id: item.id, quantity } }))
  }

  function setMin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const raw = String(
      new FormData(e.currentTarget).get("minQuantity") ?? ""
    ).trim()
    const minQuantity = raw ? parseFloat(raw) : null
    if (minQuantity !== null && (isNaN(minQuantity) || minQuantity < 0)) {
      setError("Enter a valid minimum.")
      return
    }
    run(() => setPantryMinFn({ data: { id: item.id, minQuantity } }))
  }

  function setExpiration(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const expiresAt = String(
      new FormData(e.currentTarget).get("expiresAt") ?? ""
    )
    run(() => setPantryExpirationFn({ data: { id: item.id, expiresAt } }))
  }

  return (
    <TableRow className={expStatus?.isExpired ? "bg-destructive/5" : ""}>
      <TableCell>
        <div>
          <span className="font-medium">{item.productName}</span>
          {item.productBrand && (
            <span className="text-muted-foreground">
              {" "}
              ({item.productBrand})
            </span>
          )}
        </div>
        {item.categoryName && (
          <Badge variant="secondary" className="mt-0.5 text-xs">
            {item.categoryName}
          </Badge>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
      <TableCell>
        <form onSubmit={setQuantity} className="flex items-center gap-1">
          <Input
            name="quantity"
            type="number"
            step="0.001"
            min="0"
            defaultValue={item.quantity}
            className="h-8 w-20"
          />
          <span className="text-xs text-muted-foreground">{unitLabel}</span>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
          >
            Set
          </Button>
        </form>
      </TableCell>
      <TableCell>
        <form onSubmit={setMin} className="flex items-center gap-1">
          <Input
            name="minQuantity"
            type="number"
            step="0.001"
            min="0"
            defaultValue={item.minQuantity ?? ""}
            placeholder="-"
            className="h-8 w-16"
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
          >
            Set
          </Button>
        </form>
      </TableCell>
      <TableCell>
        <form onSubmit={setExpiration} className="flex items-center gap-1">
          <Input
            name="expiresAt"
            type="date"
            defaultValue={item.expiresAt ?? ""}
            className="h-8 w-32"
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
          >
            Set
          </Button>
        </form>
        {expStatus && (
          <span className={`text-[10px] ${expStatus.className}`}>
            {expStatus.label}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Decrease by 1"
            onClick={() =>
              run(() => adjustPantryFn({ data: { id: item.id, amount: -1 } }))
            }
          >
            <Minus className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Increase by 1"
            onClick={() =>
              run(() => adjustPantryFn({ data: { id: item.id, amount: 1 } }))
            }
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          title="Remove from pantry"
          onClick={() =>
            run(() => removeFromPantryFn({ data: { id: item.id } }))
          }
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function AddToPantryCard({
  products,
  onAdded,
}: {
  products: Array<{
    id: string
    name: string
    brand: string | null
    defaultUnit: ProductUnit
  }>
  onAdded: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const f = new FormData(form)
    const quantity = parseFloat(String(f.get("quantity") ?? ""))
    if (isNaN(quantity) || quantity < 0) {
      setError("Enter a valid quantity.")
      return
    }
    const minRaw = String(f.get("minQuantity") ?? "").trim()
    const minQuantity = minRaw ? parseFloat(minRaw) : null
    if (minQuantity !== null && (isNaN(minQuantity) || minQuantity < 0)) {
      setError("Enter a valid minimum.")
      return
    }
    const unitRaw = String(f.get("unit") ?? "")
    setPending(true)
    try {
      const result = await addToPantryFn({
        data: {
          productId: String(f.get("productId") ?? ""),
          quantity,
          unit: unitRaw ? (unitRaw as ProductUnit) : null,
          minQuantity,
          expiresAt: String(f.get("expiresAt") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      onAdded()
    } catch {
      setError("Could not add to pantry.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add to pantry</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="space-y-2">
            <Label htmlFor="pa-product">Product</Label>
            <select
              id="pa-product"
              name="productId"
              className={selectClass}
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select product
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.brand ? ` (${p.brand})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-quantity">Quantity</Label>
            <Input
              id="pa-quantity"
              name="quantity"
              type="number"
              step="0.001"
              min="0"
              defaultValue="1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-unit">Unit</Label>
            <select
              id="pa-unit"
              name="unit"
              className={selectClass}
              defaultValue=""
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
            <Label htmlFor="pa-min">Min threshold</Label>
            <Input
              id="pa-min"
              name="minQuantity"
              type="number"
              step="0.001"
              min="0"
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-expires">Expires</Label>
            <Input id="pa-expires" name="expiresAt" type="date" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" /> {pending ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
