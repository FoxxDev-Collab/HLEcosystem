import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Plus, Trash2, MapPin, Landmark, Receipt,
  Fuel, Utensils, Hotel, Car, ShoppingBag, MoreHorizontal, Paperclip,
} from "lucide-react";
import {
  addTripExpenseAction,
  deleteTripExpenseAction,
  updateTripStatusAction,
  updateTripAction,
  deleteTripAction,
} from "../actions";

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const EXPENSE_TYPE_LABELS: Record<string, { label: string; icon: typeof Fuel }> = {
  GAS: { label: "Gas", icon: Fuel },
  FOOD: { label: "Food", icon: Utensils },
  LODGING: { label: "Lodging", icon: Hotel },
  TRANSPORT: { label: "Transport", icon: Car },
  SUPPLIES: { label: "Supplies", icon: ShoppingBag },
  OTHER: { label: "Other", icon: MoreHorizontal },
};

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  GAS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  FOOD: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  LODGING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  TRANSPORT: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  SUPPLIES: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [trip, accounts, categories, projects] = await Promise.all([
    prisma.trip.findUnique({
      where: { id, householdId },
      include: {
        expenses: { orderBy: { date: "desc" } },
        budgetPlannerProject: { select: { id: true, name: true } },
      },
    }),
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      select: { id: true, name: true, type: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.findMany({
      where: { householdId, type: "EXPENSE", isArchived: false, parentCategoryId: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.budgetPlannerProject.findMany({
      where: { householdId, status: { in: ["PLANNING", "ACTIVE"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!trip) notFound();

  const totalSpent = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Category breakdown by expense type
  const byType = trip.expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.expenseType] = (acc[e.expenseType] || 0) + Number(e.amount);
    return acc;
  }, {});

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/trips"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {trip.destination && (
                <span className="flex items-center gap-1"><MapPin className="size-3" />{trip.destination}</span>
              )}
              <span>{formatDate(trip.startDate)} &ndash; {formatDate(trip.endDate)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((status) => (
            <form key={status} action={updateTripStatusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={status} />
              <Button
                type="submit"
                variant={trip.status === status ? "default" : "outline"}
                size="sm"
              >
                {status}
              </Button>
            </form>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Spent</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expenses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{trip.expenses.length}</div></CardContent>
        </Card>
        {trip.isTaxDeductible && (
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1">
                <Landmark className="size-3.5" /> Tax Deductible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">{trip.taxPurpose || "Yes"}</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalSpent)}</div>
            </CardContent>
          </Card>
        )}
        {!trip.isTaxDeductible && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">{trip.description || "No description"}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Breakdown */}
      {Object.keys(byType).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Spending by Category</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, amount]) => {
                  const info = EXPENSE_TYPE_LABELS[type];
                  const Icon = info?.icon || MoreHorizontal;
                  const pct = totalSpent > 0 ? ((amount / totalSpent) * 100).toFixed(0) : "0";
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`flex items-center justify-center size-8 rounded ${EXPENSE_TYPE_COLORS[type]}`}>
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{formatCurrency(amount)}</div>
                        <div className="text-xs text-muted-foreground">{info?.label || type} ({pct}%)</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Expense Form */}
      <Card>
        <CardHeader><CardTitle>Add Expense</CardTitle></CardHeader>
        <CardContent>
          <form action={addTripExpenseAction} className="space-y-4" encType="multipart/form-data">
            <input type="hidden" name="tripId" value={id} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Type</Label>
                <select
                  name="expenseType"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="GAS">Gas</option>
                  <option value="FOOD">Food</option>
                  <option value="LODGING">Lodging</option>
                  <option value="TRANSPORT">Transport (parking, tolls, rideshare)</option>
                  <option value="SUPPLIES">Supplies</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input name="date" type="date" defaultValue={today} required />
              </div>
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required />
              </div>
              <div className="space-y-1">
                <Label>Account</Label>
                <select
                  name="accountId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-1">
                <Label>Payee / Vendor</Label>
                <Input name="payee" placeholder="e.g. Shell, Marriott" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input name="description" placeholder="Optional notes" />
              </div>
              <div className="space-y-1">
                <Label>Category Override</Label>
                <select
                  name="categoryId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Auto (from type)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Receipt</Label>
                <Input name="receipt" type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff,.heic" />
              </div>
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Expense</Button>
          </form>
        </CardContent>
      </Card>

      {/* Expenses List */}
      <Card>
        <CardHeader><CardTitle>Expenses ({trip.expenses.length})</CardTitle></CardHeader>
        <CardContent>
          {trip.expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No expenses yet. Add your first receipt above.</p>
          ) : (
            <div className="divide-y">
              {trip.expenses.map((expense) => {
                const info = EXPENSE_TYPE_LABELS[expense.expenseType];
                const Icon = info?.icon || MoreHorizontal;
                return (
                  <div key={expense.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex items-center justify-center size-8 rounded shrink-0 ${EXPENSE_TYPE_COLORS[expense.expenseType]}`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {expense.payee || info?.label || expense.expenseType}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{formatDate(expense.date)}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${EXPENSE_TYPE_COLORS[expense.expenseType]}`}>
                            {info?.label || expense.expenseType}
                          </Badge>
                          {expense.description && <span className="truncate">{expense.description}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {expense.receiptFileName ? (
                        <span className="text-xs text-green-600 flex items-center gap-1" title={expense.receiptFileName}>
                          <Paperclip className="size-3" />
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground" title="No receipt">
                          <Receipt className="size-3.5" />
                        </span>
                      )}
                      <span className="text-sm font-medium w-24 text-right">{formatCurrency(expense.amount)}</span>
                      <form action={deleteTripExpenseAction}>
                        <input type="hidden" name="id" value={expense.id} />
                        <input type="hidden" name="tripId" value={id} />
                        <input type="hidden" name="deleteTransaction" value="true" />
                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trip Details / Edit */}
      <Card>
        <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
        <CardContent>
          <form action={updateTripAction} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Trip Name</Label>
                <Input name="name" defaultValue={trip.name} required />
              </div>
              <div className="space-y-1">
                <Label>Destination</Label>
                <Input name="destination" defaultValue={trip.destination || ""} />
              </div>
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input name="startDate" type="date" defaultValue={trip.startDate.toISOString().split("T")[0]} required />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input name="endDate" type="date" defaultValue={trip.endDate.toISOString().split("T")[0]} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-1">
                <Label>Description</Label>
                <Input name="description" defaultValue={trip.description || ""} />
              </div>
              <div className="space-y-1">
                <Label>Linked Project</Label>
                <select
                  name="budgetPlannerProjectId"
                  defaultValue={trip.budgetPlannerProjectId || ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  name="isTaxDeductible"
                  id="editTaxDeductible"
                  defaultChecked={trip.isTaxDeductible}
                  className="size-4 rounded border-input"
                />
                <Label htmlFor="editTaxDeductible" className="cursor-pointer">Tax Deductible</Label>
              </div>
              <div className="space-y-1">
                <Label>Tax Purpose</Label>
                <Input name="taxPurpose" defaultValue={trip.taxPurpose || ""} placeholder="e.g. Property repair" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                name="notes"
                defaultValue={trip.notes || ""}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Additional notes about this trip..."
              />
            </div>
            <div className="flex justify-between">
              <Button type="submit">Save Changes</Button>
              <form action={deleteTripAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="destructive" size="sm">Delete Trip</Button>
              </form>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Linked Project */}
      {trip.budgetPlannerProject && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Linked Budget Planner Project</CardTitle></CardHeader>
          <CardContent>
            <Link href={`/budget-planner/${trip.budgetPlannerProject.id}`} className="text-sm text-blue-600 hover:underline">
              {trip.budgetPlannerProject.name} &rarr;
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
