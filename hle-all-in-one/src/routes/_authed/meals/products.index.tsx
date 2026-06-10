import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Plus, Star, Tag, Trash2 } from "lucide-react"
import {
  createCategoryFn,
  createProductFn,
  deleteProductFn,
  getProductsPageFn,
  toggleFavoriteFn,
} from "@/server/meals/fns.products"
import type { CategoryRow, ProductListRow } from "@/server/meals/products"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export const Route = createFileRoute("/_authed/meals/products/")({
  loader: () => getProductsPageFn(),
  component: ProductsPage,
})

// Shared by the sibling catalog routes (product detail, pantry).
export const PRODUCT_UNITS = [
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
  BOTTLE: "btl",
  BUNCH: "bunch",
  DOZEN: "dz",
}

export function formatUnit(unit: string): string {
  return UNIT_LABELS[unit] || unit.toLowerCase()
}

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function ProductsPage() {
  const { products, categories } = Route.useLoaderData()
  const router = useRouter()
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductListRow | null>(null)

  function refresh() {
    router.invalidate()
  }

  async function toggleFavorite(id: string) {
    try {
      await toggleFavoriteFn({ data: { id } })
      refresh()
    } catch {
      // leave the star as-is on failure
    }
  }

  const visible = categoryId
    ? products.filter((p) => p.categoryId === categoryId)
    : products

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Track products and their prices across stores.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddCategoryOpen(true)}>
            <Plus className="size-4" /> New category
          </Button>
          <Button onClick={() => setAddProductOpen(true)}>
            <Plus className="size-4" /> New product
          </Button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategoryId(null)}>
            <Badge variant={!categoryId ? "default" : "outline"}>All</Badge>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
            >
              <Badge variant={categoryId === cat.id ? "default" : "outline"}>
                {cat.name}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="mb-4 size-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">
              {products.length === 0
                ? "No products yet"
                : "No products in this category"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {products.length === 0
                ? "Add your first product to start tracking prices."
                : "Pick another category or add a product."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Products ({visible.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Latest price</TableHead>
                  <TableHead className="w-10">Fav</TableHead>
                  <TableHead className="w-14 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link
                        to="/meals/products/$id"
                        params={{ id: product.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {product.categoryName ? (
                        <Badge variant="secondary">
                          {product.categoryName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.brand || "—"}
                    </TableCell>
                    <TableCell>{formatUnit(product.defaultUnit)}</TableCell>
                    <TableCell className="text-right">
                      {product.latestPrice !== null
                        ? formatCurrency(product.latestPrice)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={product.isFavorite ? "Unfavorite" : "Favorite"}
                        onClick={() => toggleFavorite(product.id)}
                      >
                        <Star
                          className={
                            product.isFavorite
                              ? "size-4 fill-yellow-400 text-yellow-400"
                              : "size-4 text-muted-foreground"
                          }
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(product)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {addProductOpen && (
        <AddProductDialog
          categories={categories}
          onClose={() => setAddProductOpen(false)}
          onSaved={() => {
            setAddProductOpen(false)
            refresh()
          }}
        />
      )}
      {addCategoryOpen && (
        <AddCategoryDialog
          onClose={() => setAddCategoryOpen(false)}
          onSaved={() => {
            setAddCategoryOpen(false)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteProductDialog
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function AddProductDialog({
  categories,
  onClose,
  onSaved,
}: {
  categories: Array<CategoryRow>
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createProductFn({
        data: {
          name: String(f.get("name") ?? ""),
          categoryId: String(f.get("categoryId") ?? ""),
          brand: String(f.get("brand") ?? ""),
          defaultUnit: String(
            f.get("defaultUnit") ?? "EACH"
          ) as (typeof PRODUCT_UNITS)[number],
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not create product.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            Something you buy — log its price per store as you shop.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              name="name"
              placeholder="e.g. Bananas"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-category">Category</Label>
              <select
                id="p-category"
                name="categoryId"
                className={selectClass}
                defaultValue=""
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
              <Label htmlFor="p-unit">Unit</Label>
              <select
                id="p-unit"
                name="defaultUnit"
                className={selectClass}
                defaultValue="EACH"
              >
                {PRODUCT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {formatUnit(u)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-brand">Brand</Label>
            <Input id="p-brand" name="brand" placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-notes">Notes</Label>
            <Input id="p-notes" name="notes" placeholder="Optional" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddCategoryDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createCategoryFn({
        data: { name: String(f.get("name") ?? "") },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not create category.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            Group products for filtering and comparison.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              name="name"
              placeholder="e.g. Produce"
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteProductDialog({
  product,
  onClose,
  onDeleted,
}: {
  product: ProductListRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteProductFn({ data: { id: product.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete product.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its price history and pantry entry are deleted too. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
