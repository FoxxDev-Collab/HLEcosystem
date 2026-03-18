import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { createCategoryAction, archiveCategoryAction } from "./actions";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#0ea5e9", "#84cc16", "#64748b", "#78716c",
];

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const categories = await prisma.category.findMany({
    where: { householdId, parentCategoryId: null },
    include: {
      subCategories: { orderBy: { sortOrder: "asc" } },
      _count: { select: { transactions: true } },
    },
    orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const grouped = {
    EXPENSE: categories.filter((c) => c.type === "EXPENSE" && !c.isArchived),
    INCOME: categories.filter((c) => c.type === "INCOME" && !c.isArchived),
    TRANSFER: categories.filter((c) => c.type === "TRANSFER" && !c.isArchived),
    archived: categories.filter((c) => c.isArchived),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Categories</h1>

      {/* Quick Add */}
      <Card>
        <CardHeader><CardTitle>Add Category</CardTitle></CardHeader>
        <CardContent>
          <form action={createCategoryAction} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">Name</label>
              <Input name="name" placeholder="Category name" required className="w-48" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <Select name="type" defaultValue="EXPENSE">
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Color</label>
              <div className="flex gap-1">
                {COLORS.slice(0, 7).map((color) => (
                  <label key={color} className="cursor-pointer">
                    <input type="radio" name="color" value={color} defaultChecked={color === "#6366f1"} className="sr-only peer" />
                    <div className="w-6 h-6 rounded-full border-2 border-transparent peer-checked:border-foreground transition-all" style={{ backgroundColor: color }} />
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" size="sm"><Plus className="size-4 mr-1" />Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Category Groups */}
      {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((type) => (
        <div key={type} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {type === "EXPENSE" ? "Expense Categories" : type === "INCOME" ? "Income Categories" : "Transfer Categories"}
            <Badge variant="secondary" className="ml-2">{grouped[type].length}</Badge>
          </h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {grouped[type].map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || "#6366f1" }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{cat.name}</div>
                    <div className="text-xs text-muted-foreground">{cat._count.transactions} transactions</div>
                  </div>
                </div>
                <form action={archiveCategoryAction}>
                  <input type="hidden" name="id" value={cat.id} />
                  <input type="hidden" name="isArchived" value="false" />
                  <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <Archive className="size-3.5" />
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Archived */}
      {grouped.archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Archived</h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {grouped.archived.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || "#6366f1" }} />
                  <span className="text-sm">{cat.name}</span>
                </div>
                <form action={archiveCategoryAction}>
                  <input type="hidden" name="id" value={cat.id} />
                  <input type="hidden" name="isArchived" value="true" />
                  <Button type="submit" variant="ghost" size="icon" className="h-7 w-7">
                    <ArchiveRestore className="size-3.5" />
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
