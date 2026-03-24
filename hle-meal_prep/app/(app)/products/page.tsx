import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { formatUnit } from "@/lib/format";
import { Tag, Star, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createProductAction,
  deleteProductAction,
  toggleFavoriteAction,
  createCategoryAction,
} from "./actions";

const PRODUCT_UNITS = [
  "EACH", "LB", "OZ", "GALLON", "QUART", "LITER",
  "COUNT", "PACK", "BAG", "BOX", "CAN", "BOTTLE", "BUNCH", "DOZEN",
] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const params = await searchParams;
  const filterCategoryId = params.categoryId;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        householdId,
        isActive: true,
        ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
      },
      orderBy: [{ name: "asc" }],
      include: {
        category: true,
        prices: { orderBy: { observedAt: "desc" }, take: 1 },
      },
    }),
    prisma.category.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Track products and their prices across stores</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/products">
          <Badge variant={!filterCategoryId ? "default" : "outline"}>All</Badge>
        </Link>
        {categories.map((cat) => (
          <Link key={cat.id} href={`/products?categoryId=${cat.id}`}>
            <Badge variant={filterCategoryId === cat.id ? "default" : "outline"}>
              {cat.name}
            </Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCategoryAction} className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Category Name</Label>
              <Input id="cat-name" name="name" placeholder="e.g. Produce" required />
            </div>
            <Button type="submit" variant="outline" size="sm">
              <Plus className="size-4 mr-1" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createProductAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" placeholder="e.g. Bananas" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select name="categoryId">
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultUnit">Unit</Label>
              <Select name="defaultUnit" defaultValue="EACH">
                <SelectTrigger id="defaultUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {formatUnit(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Optional" />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button type="submit">Add Product</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No products yet</h3>
            <p className="text-sm text-muted-foreground">Add your first product to start tracking prices.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Products ({products.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Latest Price</TableHead>
                  <TableHead className="w-10">Fav</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge variant="secondary">{product.category.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.brand || "\u2014"}
                    </TableCell>
                    <TableCell>{formatUnit(product.defaultUnit)}</TableCell>
                    <TableCell className="text-right">
                      {product.prices[0]
                        ? formatCurrency(product.prices[0].price)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <form action={toggleFavoriteAction}>
                        <input type="hidden" name="id" value={product.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Star
                            className={`size-4 ${
                              product.isFavorite
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                      </form>
                    </TableCell>
                    <TableCell>
                      <form action={deleteProductAction}>
                        <input type="hidden" name="id" value={product.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
