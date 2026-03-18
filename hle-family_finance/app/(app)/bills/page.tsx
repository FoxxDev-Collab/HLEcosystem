import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, ExternalLink, Pause, Play } from "lucide-react";
import { createBillAction, markBillPaidAction, toggleBillActiveAction } from "./actions";

const BILL_CATEGORIES = [
  "UTILITIES", "INSURANCE", "SUBSCRIPTIONS", "PHONE", "INTERNET",
  "RENT", "MORTGAGE", "CAR_PAYMENT", "CHILD_CARE", "STREAMING", "OTHER",
];

export default async function BillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const bills = await prisma.monthlyBill.findMany({
    where: { householdId },
    include: {
      payments: { orderBy: { dueDate: "desc" }, take: 1 },
    },
    orderBy: [{ isActive: "desc" }, { dueDayOfMonth: "asc" }],
  });

  const activeBills = bills.filter((b) => b.isActive);
  const totalMonthly = activeBills.reduce((sum, b) => sum + Number(b.expectedAmount), 0);

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Build calendar data (days of current month)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Map bills to their due days
  const billsByDay = new Map<number, typeof activeBills>();
  for (const bill of activeBills) {
    const day = Math.min(bill.dueDayOfMonth, daysInMonth);
    const existing = billsByDay.get(day) || [];
    existing.push(bill);
    billsByDay.set(day, existing);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monthly Bills</h1>
        <p className="text-muted-foreground">{activeBills.length} active bills &middot; {formatCurrency(totalMonthly)}/month</p>
      </div>

      {/* Add Bill */}
      <Card>
        <CardHeader><CardTitle>Add Bill</CardTitle></CardHeader>
        <CardContent>
          <form action={createBillAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-1">
              <Label>Bill Name</Label>
              <Input name="name" placeholder="e.g. Electric Bill" required />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select name="category" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BILL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input name="expectedAmount" type="number" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label>Due Day</Label>
              <Input name="dueDayOfMonth" type="number" min="1" max="31" required />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Bill</Button>
          </form>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {activeBills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {today.toLocaleString("en-US", { month: "long", year: "numeric" })} Calendar
            </CardTitle>
            <CardDescription>Bills due this month at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {/* Day headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="bg-background text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background min-h-[60px]" />
              ))}
              {/* Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayBills = billsByDay.get(day) || [];
                const isToday = day === currentDay;
                const isPast = day < currentDay;

                return (
                  <div
                    key={day}
                    className={`bg-background min-h-[60px] p-1 ${isToday ? "ring-2 ring-blue-500 ring-inset" : ""}`}
                  >
                    <div className={`text-xs font-medium mb-0.5 ${isToday ? "text-blue-600" : isPast ? "text-muted-foreground" : ""}`}>
                      {day}
                    </div>
                    {dayBills.map((bill) => {
                      const lastPayment = bill.payments[0];
                      const isPaid = lastPayment &&
                        new Date(lastPayment.paidDate!).getMonth() === currentMonth &&
                        new Date(lastPayment.paidDate!).getFullYear() === currentYear;

                      return (
                        <div
                          key={bill.id}
                          className={`text-[10px] leading-tight truncate rounded px-0.5 mb-0.5 ${
                            isPaid
                              ? "bg-green-100 text-green-700 line-through"
                              : isPast
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                          title={`${bill.name}: ${formatCurrency(bill.expectedAmount)}`}
                        >
                          {bill.name}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bill List */}
      {bills.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No bills tracked yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const lastPayment = bill.payments[0];
            const isPaidThisMonth = lastPayment &&
              new Date(lastPayment.paidDate!).getMonth() === currentMonth &&
              new Date(lastPayment.paidDate!).getFullYear() === currentYear;
            const isDueSoon = bill.isActive && !isPaidThisMonth && bill.dueDayOfMonth - currentDay <= 5 && bill.dueDayOfMonth - currentDay >= 0;
            const isOverdue = bill.isActive && !isPaidThisMonth && bill.dueDayOfMonth < currentDay;

            return (
              <Card key={bill.id} className={!bill.isActive ? "opacity-50" : ""}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{bill.name}</span>
                        {bill.autoPay && <Badge variant="outline" className="text-xs">Auto-pay</Badge>}
                        {isPaidThisMonth && <Badge className="bg-green-100 text-green-800 text-xs">Paid</Badge>}
                        {isDueSoon && <Badge className="bg-yellow-100 text-yellow-800 text-xs">Due soon</Badge>}
                        {isOverdue && <Badge className="bg-red-100 text-red-800 text-xs">Overdue</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Due: {bill.dueDayOfMonth}{getOrdinal(bill.dueDayOfMonth)} &middot; {bill.category.replace(/_/g, " ")}
                        {bill.websiteUrl && (
                          <a href={bill.websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 inline-flex items-center gap-0.5">
                            <ExternalLink className="size-3" />Pay
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium">{formatCurrency(bill.expectedAmount)}</span>
                    {bill.isActive && !isPaidThisMonth && (
                      <form action={markBillPaidAction}>
                        <input type="hidden" name="billId" value={bill.id} />
                        <input type="hidden" name="amountPaid" value={String(bill.expectedAmount)} />
                        <Button type="submit" variant="outline" size="sm">
                          <CheckCircle2 className="size-3.5 mr-1" />Paid
                        </Button>
                      </form>
                    )}
                    <form action={toggleBillActiveAction}>
                      <input type="hidden" name="id" value={bill.id} />
                      <input type="hidden" name="isActive" value={String(bill.isActive)} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title={bill.isActive ? "Pause" : "Resume"}>
                        {bill.isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
