import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createDebtAction, recordDebtPaymentAction } from "./actions";

const DEBT_TYPES = [
  { value: "MORTGAGE", label: "Mortgage" },
  { value: "AUTO_LOAN", label: "Auto Loan" },
  { value: "STUDENT_LOAN", label: "Student Loan" },
  { value: "PERSONAL_LOAN", label: "Personal Loan" },
  { value: "HELOC", label: "HELOC" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "MEDICAL_DEBT", label: "Medical Debt" },
  { value: "OTHER", label: "Other" },
];

export default async function DebtsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const debts = await prisma.debt.findMany({
    where: { householdId, isArchived: false },
    include: { payments: { orderBy: { paymentDate: "desc" }, take: 3 } },
    orderBy: { currentBalance: "desc" },
  });

  const totalDebt = debts
    .filter((d) => d.includeInNetWorth)
    .reduce((sum, d) => sum + Number(d.currentBalance), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Debts</h1>
        <p className="text-muted-foreground">Total outstanding: <span className="text-red-600 font-medium">{formatCurrency(totalDebt)}</span></p>
      </div>

      {/* Add Debt */}
      <Card>
        <CardHeader><CardTitle>Add Debt</CardTitle></CardHeader>
        <CardContent>
          <form action={createDebtAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Home Mortgage" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEBT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Original Amount</Label>
              <Input name="originalPrincipal" type="number" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label>Current Balance</Label>
              <Input name="currentBalance" type="number" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label>Rate (%)</Label>
              <Input name="interestRate" type="number" step="0.01" placeholder="6.5" />
            </div>
            <div className="space-y-1">
              <Label>Lender</Label>
              <Input name="lender" placeholder="e.g. Wells Fargo" />
            </div>
            <div className="space-y-1">
              <Label>Min Payment</Label>
              <Input name="minimumPayment" type="number" step="0.01" />
            </div>
            <Button type="submit" className="lg:col-span-3"><Plus className="size-4 mr-2" />Add Debt</Button>
          </form>
        </CardContent>
      </Card>

      {/* Debt List */}
      {debts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No debts tracked. Add your first one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => {
            const paidPercent = Number(debt.originalPrincipal) > 0
              ? ((Number(debt.originalPrincipal) - Number(debt.currentBalance)) / Number(debt.originalPrincipal)) * 100
              : 0;

            return (
              <Card key={debt.id} className="hover:bg-accent/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{debt.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {DEBT_TYPES.find((t) => t.value === debt.type)?.label}
                        {debt.lender && ` at ${debt.lender}`}
                        {Number(debt.interestRate) > 0 && ` · ${formatPercent(Number(debt.interestRate) * 100, 2)} APR`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Link href={`/debts/${debt.id}`} className="text-xl font-bold text-red-600 hover:underline">{formatCurrency(debt.currentBalance)}</Link>
                      <div className="text-xs text-muted-foreground">of {formatCurrency(debt.originalPrincipal)}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatPercent(paidPercent)} paid off</span>
                      {debt.minimumPayment && <span>Min: {formatCurrency(debt.minimumPayment)}/mo</span>}
                    </div>
                    <Progress value={paidPercent} className="h-2" />
                  </div>

                  {/* Quick Payment */}
                  <form action={recordDebtPaymentAction} className="flex gap-2 items-end">
                    <input type="hidden" name="debtId" value={debt.id} />
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Payment Amount</Label>
                      <Input name="totalAmount" type="number" step="0.01" placeholder="0.00" className="h-8 text-sm" required />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Principal</Label>
                      <Input name="principalAmount" type="number" step="0.01" placeholder="0.00" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Interest</Label>
                      <Input name="interestAmount" type="number" step="0.01" placeholder="0.00" className="h-8 text-sm" />
                    </div>
                    <Button type="submit" size="sm" className="shrink-0">Record</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
