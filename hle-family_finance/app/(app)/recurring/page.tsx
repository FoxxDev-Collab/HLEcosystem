import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pause, Play, SkipForward, Trash2, Zap } from "lucide-react";
import {
  createRecurringAction,
  toggleRecurringActiveAction,
  skipNextOccurrenceAction,
  deleteRecurringAction,
  processDueRecurringAction,
} from "./actions";

const FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BI_WEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

export default async function RecurringPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [recurrings, accounts, categories] = await Promise.all([
    prisma.recurringTransaction.findMany({
      where: { householdId },
      include: { account: true, category: true },
      orderBy: [{ isActive: "desc" }, { nextOccurrence: "asc" }],
    }),
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
    }),
  ]);

  const active = recurrings.filter((r) => r.isActive);
  const inactive = recurrings.filter((r) => !r.isActive);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const dueCount = active.filter(
    (r) => r.autoCreate && r.nextOccurrence && r.nextOccurrence <= today
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring Transactions</h1>
          <p className="text-muted-foreground">
            {active.length} active · {inactive.length} paused
          </p>
        </div>
        {dueCount > 0 && (
          <form action={processDueRecurringAction}>
            <Button type="submit" variant="default">
              <Zap className="size-4 mr-2" />
              Process {dueCount} Due
            </Button>
          </form>
        )}
      </div>

      {/* Create Recurring */}
      <Card>
        <CardHeader><CardTitle>Add Recurring Transaction</CardTitle></CardHeader>
        <CardContent>
          <form action={createRecurringAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Netflix, Rent" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue="EXPENSE">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Account</Label>
              <Select name="accountId" required>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select name="categoryId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input name="amount" type="number" step="0.01" placeholder="0.00" required />
            </div>
            <div className="space-y-1">
              <Label>Payee</Label>
              <Input name="payee" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select name="frequency" defaultValue="MONTHLY">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Day of Period</Label>
              <Input name="dayOfPeriod" type="number" min="1" max="31" placeholder="e.g. 15" />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input name="startDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" name="autoCreate" id="autoCreate" defaultChecked className="size-4" />
              <Label htmlFor="autoCreate" className="text-sm">Auto-create when due</Label>
            </div>
            <Button type="submit" className="lg:col-span-2"><Plus className="size-4 mr-2" />Add Recurring</Button>
          </form>
        </CardContent>
      </Card>

      {/* Active List */}
      {recurrings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No recurring transactions yet. Add one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Active</h2>
              {active.map((r) => {
                const isDue = r.autoCreate && r.nextOccurrence && r.nextOccurrence <= today;
                return (
                  <Card key={r.id} className={isDue ? "border-orange-300 bg-orange-50/50" : ""}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{r.name}</span>
                            <Badge variant={r.type === "INCOME" ? "default" : r.type === "EXPENSE" ? "destructive" : "secondary"} className="text-xs">
                              {r.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {FREQUENCIES.find((f) => f.value === r.frequency)?.label}
                            </Badge>
                            {isDue && <Badge className="bg-orange-500 text-xs">Due</Badge>}
                            {r.autoCreate && <Badge variant="outline" className="text-xs">Auto</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {r.account.name}
                            {r.category && ` · ${r.category.name}`}
                            {r.payee && ` · ${r.payee}`}
                            {r.nextOccurrence && ` · Next: ${formatDate(r.nextOccurrence)}`}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-bold ${r.type === "INCOME" ? "text-green-600" : r.type === "EXPENSE" ? "text-red-600" : ""}`}>
                            {r.type === "INCOME" ? "+" : r.type === "EXPENSE" ? "-" : ""}{formatCurrency(r.amount)}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <form action={skipNextOccurrenceAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" variant="ghost" size="icon" title="Skip next">
                              <SkipForward className="size-4" />
                            </Button>
                          </form>
                          <form action={toggleRecurringActiveAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="isActive" value="true" />
                            <Button type="submit" variant="ghost" size="icon" title="Pause">
                              <Pause className="size-4" />
                            </Button>
                          </form>
                          <form action={deleteRecurringAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" variant="ghost" size="icon" title="Delete" className="text-red-500 hover:text-red-700">
                              <Trash2 className="size-4" />
                            </Button>
                          </form>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {inactive.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-muted-foreground">Paused</h2>
              {inactive.map((r) => (
                <Card key={r.id} className="opacity-60">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{r.name}</span>
                          <Badge variant="secondary" className="text-xs">{r.type}</Badge>
                          <Badge variant="outline" className="text-xs">Paused</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {r.account.name} · {formatCurrency(r.amount)}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <form action={toggleRecurringActiveAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="isActive" value="false" />
                          <Button type="submit" variant="ghost" size="icon" title="Resume">
                            <Play className="size-4" />
                          </Button>
                        </form>
                        <form action={deleteRecurringAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <Button type="submit" variant="ghost" size="icon" title="Delete" className="text-red-500 hover:text-red-700">
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
