import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { getFinanceAccounts, getFinanceExpenseCategories } from "@/lib/finance-bridge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { createExpenseAction, deleteExpenseAction } from "./actions";

const EXPENSE_CATEGORIES = [
  "MEDICAL_EQUIPMENT", "VISION", "DENTAL", "SUPPLIES", "OVER_THE_COUNTER",
  "PRESCRIPTION", "COPAY", "LAB_WORK", "THERAPY", "OTHER",
];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const year = parseInt(params.year || String(new Date().getFullYear()));
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const [members, expenses, financeAccounts, financeCategories] = await Promise.all([
    prisma.familyMember.findMany({ where: { householdId, isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.medicalExpense.findMany({
      where: { familyMember: { householdId }, expenseDate: { gte: startOfYear, lte: endOfYear } },
      include: { familyMember: true },
      orderBy: { expenseDate: "desc" },
    }),
    getFinanceAccounts(householdId).catch(() => []),
    getFinanceExpenseCategories(householdId).catch(() => []),
  ]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalReimbursed = expenses.reduce((s, e) => s + Number(e.insuranceReimbursement || 0), 0);
  const totalHsa = expenses.filter((e) => e.paidFromHsa).reduce((s, e) => s + Number(e.amount), 0);
  const totalOop = totalExpenses - totalReimbursed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Medical Expenses</h1>
        <div className="flex items-center gap-2">
          <a href={`/expenses?year=${year - 1}`}><Button variant="outline" size="sm">&larr;</Button></a>
          <span className="text-sm font-medium px-2">{year}</span>
          <a href={`/expenses?year=${year + 1}`}><Button variant="outline" size="sm">&rarr;</Button></a>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Expenses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Insurance Reimbursed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalReimbursed)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Out of Pocket</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalOop)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">HSA Used</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalHsa)}</div></CardContent>
        </Card>
      </div>

      {/* Add */}
      <Card>
        <CardHeader><CardTitle>Add Expense</CardTitle></CardHeader>
        <CardContent>
          <form action={createExpenseAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Family Member</Label>
              <Select name="familyMemberId" defaultValue={members[0]?.id} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Description</Label><Input name="description" required /></div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select name="category" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Amount</Label><Input name="amount" type="number" step="0.01" required /></div>
            <div className="space-y-1"><Label>Date</Label><Input name="expenseDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required /></div>
            <div className="space-y-1"><Label>Insurance Reimbursement</Label><Input name="insuranceReimbursement" type="number" step="0.01" /></div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" name="paidFromHsa" id="paidFromHsa" className="size-4" />
              <Label htmlFor="paidFromHsa">Paid from HSA</Label>
            </div>
            {financeAccounts.length > 0 && (
              <>
                <div className="sm:col-span-2 lg:col-span-4 border-t pt-4 mt-2">
                  <p className="text-sm font-medium text-muted-foreground">Sync to Family Finance (optional)</p>
                </div>
                <div className="space-y-1">
                  <Label>Finance Account</Label>
                  <Select name="financeAccountId">
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {financeAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Finance Category</Label>
                  <Select name="financeCategoryId">
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {financeCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <input type="hidden" name="addToFinance" value="true" />
              </>
            )}
            <Button type="submit"><Plus className="size-4 mr-2" />Add Expense</Button>
          </form>
        </CardContent>
      </Card>

      {/* Expense List */}
      {expenses.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No medical expenses for {year}.</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Expenses ({expenses.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{exp.description}</span>
                      <Badge variant="outline" className="text-xs">{exp.category.replace(/_/g, " ")}</Badge>
                      <Badge variant="secondary" className="text-xs">{exp.familyMember.firstName}</Badge>
                      {exp.paidFromHsa && <Badge className="bg-blue-100 text-blue-800 text-xs">HSA</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(exp.expenseDate)}
                      {exp.insuranceReimbursement && ` · Reimbursed: ${formatCurrency(exp.insuranceReimbursement)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600">{formatCurrency(exp.amount)}</span>
                    <form action={deleteExpenseAction}>
                      <input type="hidden" name="id" value={exp.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
