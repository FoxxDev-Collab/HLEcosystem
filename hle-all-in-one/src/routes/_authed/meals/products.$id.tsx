import { useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, Package, Trash2 } from "lucide-react"
import {
  deletePriceFn,
  deleteProductFn,
  getProductDetailFn,
  logPriceFn,
  updateProductFn,
} from "@/server/meals/fns.products"
import type { PriceRow, ProductUnit } from "@/server/meals/products"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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

export const Route = createFileRoute("/_authed/meals/products/$id")({
  loader: async ({ params }) => {
    const data = await getProductDetailFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { product, prices, categories, stores, pantryItem } =
    Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  function refresh() {
    router.invalidate()
  }

  async function confirmDelete() {
    setDeleteError(null)
    setDeletePending(true)
    try {
      const result = await deleteProductFn({ data: { id: product.id } })
      if ("error" in result && typeof result.error === "string") {
        setDeleteError(result.error)
        setDeletePending(false)
        return
      }
      navigate({ to: "/meals/products" })
    } catch {
      setDeleteError("Could not delete product.")
      setDeletePending(false)
    }
  }

  async function deletePrice(id: string) {
    try {
      await deletePriceFn({ data: { id } })
      refresh()
    } catch {
      // keep the row on failure
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/meals/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {product.categoryName && (
              <Badge variant="secondary">{product.categoryName}</Badge>
            )}
            {product.brand && (
              <span className="text-sm text-muted-foreground">
                {product.brand}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {formatUnit(product.defaultUnit)}
            </span>
            {pantryItem && (
              <Badge variant="outline" className="gap-1">
                <Package className="size-3" />
                In pantry: {pantryItem.quantity}{" "}
                {formatUnit(pantryItem.unit ?? product.defaultUnit)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EditProductCard
          product={product}
          categories={categories}
          onSaved={refresh}
          onDelete={() => setDeleteOpen(true)}
        />
        <LogPriceCard
          productId={product.id}
          stores={stores}
          onLogged={refresh}
        />
      </div>

      <PriceTrendCard prices={prices} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Price history ({prices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {prices.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No prices logged yet. Use the form above to log your first price.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Sale</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-14 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((price) => (
                  <TableRow key={price.id}>
                    <TableCell>{formatDate(price.observedAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full border"
                          style={{
                            backgroundColor: price.storeColor || "#94a3b8",
                          }}
                        />
                        {price.storeName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(price.price)}
                    </TableCell>
                    <TableCell>
                      {price.onSale && (
                        <Badge variant="destructive" className="text-xs">
                          SALE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {price.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete price"
                        onClick={() => deletePrice(price.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Its price history and pantry entry are deleted too. This cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  confirmDelete()
                }}
                disabled={deletePending}
              >
                {deletePending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function EditProductCard({
  product,
  categories,
  onSaved,
  onDelete,
}: {
  product: {
    id: string
    name: string
    brand: string | null
    defaultUnit: ProductUnit
    notes: string | null
    categoryId: string | null
  }
  categories: Array<{ id: string; name: string }>
  onSaved: () => void
  onDelete: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await updateProductFn({
        data: {
          id: product.id,
          name: String(f.get("name") ?? ""),
          categoryId: String(f.get("categoryId") ?? ""),
          brand: String(f.get("brand") ?? ""),
          defaultUnit: String(f.get("defaultUnit") ?? "EACH") as ProductUnit,
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      setSaved(true)
      setPending(false)
      onSaved()
    } catch {
      setError("Could not save product.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit product</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={product.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <select
              id="edit-category"
              name="categoryId"
              className={selectClass}
              defaultValue={product.categoryId ?? ""}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-brand">Brand</Label>
            <Input
              id="edit-brand"
              name="brand"
              defaultValue={product.brand ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-unit">Unit</Label>
            <select
              id="edit-unit"
              name="defaultUnit"
              className={selectClass}
              defaultValue={product.defaultUnit}
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {formatUnit(u)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Input
              id="edit-notes"
              name="notes"
              defaultValue={product.notes ?? ""}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-muted-foreground">Saved.</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete}>
              Delete product
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function LogPriceCard({
  productId,
  stores,
  onLogged,
}: {
  productId: string
  stores: Array<{ id: string; name: string }>
  onLogged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [onSale, setOnSale] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const f = new FormData(form)
    const price = parseFloat(String(f.get("price") ?? ""))
    if (isNaN(price) || price < 0) {
      setError("Enter a valid price.")
      return
    }
    setPending(true)
    try {
      const result = await logPriceFn({
        data: {
          productId,
          storeId: String(f.get("storeId") ?? ""),
          price,
          observedAt: String(f.get("observedAt") ?? ""),
          onSale,
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setOnSale(false)
      setPending(false)
      onLogged()
    } catch {
      setError("Could not log price.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log price</CardTitle>
      </CardHeader>
      <CardContent>
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a store first to start logging prices.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="log-store">Store</Label>
              <select
                id="log-store"
                name="storeId"
                className={selectClass}
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select store
                </option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-price">Price</Label>
              <Input
                id="log-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-date">Date</Label>
              <Input
                id="log-date"
                name="observedAt"
                type="date"
                defaultValue={toDateInputValue(new Date())}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="log-sale"
                checked={onSale}
                onCheckedChange={(checked) => setOnSale(checked === true)}
              />
              <Label htmlFor="log-sale">On sale</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-notes">Notes</Label>
              <Input id="log-notes" name="notes" placeholder="Optional" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Logging…" : "Log price"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// Lightweight SVG line chart — the legacy app rendered this with recharts,
// which isn't a dependency here. One line per store across observation dates.
function PriceTrendCard({ prices }: { prices: Array<PriceRow> }) {
  const dates = Array.from(new Set(prices.map((p) => p.observedAt))).sort()
  if (dates.length < 2) return null

  // Oldest → newest so the latest observation per (store, date) wins,
  // matching the legacy chart's data build.
  const byStore = new Map<
    string,
    { name: string; color: string; points: Map<string, number> }
  >()
  for (const p of [...prices].reverse()) {
    let entry = byStore.get(p.storeId)
    if (!entry) {
      entry = {
        name: p.storeName,
        color: p.storeColor || "#94a3b8",
        points: new Map(),
      }
      byStore.set(p.storeId, entry)
    }
    entry.points.set(p.observedAt, p.price)
  }

  const allValues = prices.map((p) => p.price)
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = max - min || 1

  const W = 640
  const H = 240
  const PAD_L = 56
  const PAD_R = 16
  const PAD_T = 16
  const PAD_B = 28

  const x = (i: number) =>
    PAD_L + (i / (dates.length - 1)) * (W - PAD_L - PAD_R)
  const y = (v: number) => PAD_T + (1 - (v - min) / range) * (H - PAD_T - PAD_B)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Price trend</CardTitle>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Price trend by store"
        >
          <line
            x1={PAD_L}
            y1={y(max)}
            x2={W - PAD_R}
            y2={y(max)}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          <line
            x1={PAD_L}
            y1={y(min)}
            x2={W - PAD_R}
            y2={y(min)}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          <text
            x={PAD_L - 6}
            y={y(max) + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatCurrency(max)}
          </text>
          <text
            x={PAD_L - 6}
            y={y(min) + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatCurrency(min)}
          </text>
          <text
            x={PAD_L}
            y={H - 8}
            textAnchor="start"
            className="fill-muted-foreground text-[10px]"
          >
            {formatDate(dates[0])}
          </text>
          <text
            x={W - PAD_R}
            y={H - 8}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatDate(dates[dates.length - 1])}
          </text>
          {Array.from(byStore.values()).map((store) => {
            const pts = dates
              .map((d, i) =>
                store.points.has(d)
                  ? ([x(i), y(store.points.get(d) as number)] as const)
                  : null
              )
              .filter((p) => p !== null)
            if (pts.length === 0) return null
            return (
              <g key={store.name}>
                {pts.length > 1 && (
                  <polyline
                    points={pts.map(([px, py]) => `${px},${py}`).join(" ")}
                    fill="none"
                    stroke={store.color}
                    strokeWidth={2}
                  />
                )}
                {pts.map(([px, py], i) => (
                  <circle key={i} cx={px} cy={py} r={3} fill={store.color} />
                ))}
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-4">
          {Array.from(byStore.values()).map((store) => (
            <span
              key={store.name}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: store.color }}
              />
              {store.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
