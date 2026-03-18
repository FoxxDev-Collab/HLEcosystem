import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Check, ExternalLink } from "lucide-react";
import { addItemAction, toggleItemPurchasedAction, deleteItemAction, updateProjectStatusAction } from "../actions";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const project = await prisma.budgetPlannerProject.findUnique({
    where: { id, householdId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project) notFound();

  const purchasedCost = project.items
    .filter((i) => i.isPurchased)
    .reduce((sum, i) => sum + Number(i.lineTotal), 0);
  const remaining = Number(project.totalCost) - purchasedCost;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/budget-planner"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.description && <p className="text-muted-foreground">{project.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((status) => (
            <form key={status} action={updateProjectStatusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={status} />
              <Button
                type="submit"
                variant={project.status === status ? "default" : "outline"}
                size="sm"
              >
                {status}
              </Button>
            </form>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Cost</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(project.totalCost)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Purchased</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(purchasedCost)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Remaining</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(remaining)}</div></CardContent>
        </Card>
      </div>

      {/* Add Item */}
      <Card>
        <CardHeader><CardTitle>Add Item</CardTitle></CardHeader>
        <CardContent>
          <form action={addItemAction} className="grid gap-3 sm:grid-cols-5 items-end">
            <input type="hidden" name="projectId" value={id} />
            <div className="space-y-1 sm:col-span-2">
              <Label>Item Name</Label>
              <Input name="name" placeholder="e.g. Quartz Countertop" required />
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input name="quantity" type="number" min="1" defaultValue="1" />
            </div>
            <div className="space-y-1">
              <Label>Unit Cost</Label>
              <Input name="unitCost" type="number" step="0.01" min="0" placeholder="0.00" required />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader><CardTitle>Items ({project.items.length})</CardTitle></CardHeader>
        <CardContent>
          {project.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No items yet</p>
          ) : (
            <div className="divide-y">
              {project.items.map((item) => (
                <div key={item.id} className={`flex items-center justify-between py-3 gap-4 ${item.isPurchased ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <form action={toggleItemPurchasedAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="isPurchased" value={String(item.isPurchased)} />
                      <Button
                        type="submit"
                        variant={item.isPurchased ? "default" : "outline"}
                        size="icon"
                        className="h-7 w-7 shrink-0"
                      >
                        {item.isPurchased && <Check className="size-3.5" />}
                      </Button>
                    </form>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium ${item.isPurchased ? "line-through" : ""}`}>{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} x {formatCurrency(item.unitCost)}
                        {item.referenceUrl && (
                          <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-blue-500 hover:underline">
                            <ExternalLink className="size-3" />Link
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{formatCurrency(item.lineTotal)}</span>
                    <form action={deleteItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
