import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { calculateAmortization } from "@/lib/amortization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Home, Car, Link2 } from "lucide-react";
import { recordDebtPaymentAction } from "../actions";
import { ExtraPaymentCalculator } from "./extra-payment-calc";
import { DebtEditDialog, DebtDeleteDialog } from "./debt-actions";
import { PaymentTransactionLink } from "./payment-transaction-link";

const DEBT_TYPE_LABELS: Record<string, string> = {
  MORTGAGE: "Mortgage", AUTO_LOAN: "Auto Loan", STUDENT_LOAN: "Student Loan",
  PERSONAL_LOAN: "Personal Loan", HELOC: "HELOC", CREDIT_CARD: "Credit Card",
  MEDICAL_DEBT: "Medical Debt", OTHER: "Other",
};

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const debt = await prisma.debt.findUnique({
    where: { id, householdId },
    include: {
      payments: {
        orderBy: { paymentDate: "desc" },
        include: { linkedTransaction: { select: { id: true, payee: true, description: true, amount: true, date: true } } },
      },
      linkedAssets: {
        where: { isArchived: false },
        select: { id: true, name: true, type: true, currentValue: true },
      },
    },
  });
  if (!debt) notFound();

  // Recent expense transactions for linking (unlinked, last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentTransactions = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      date: { gte: ninetyDaysAgo },
      linkedDebtPayments: { none: {} },
    },
    select: { id: true, payee: true, description: true, amount: true, date: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  const balance = Number(debt.currentBalance);
  const rate = Number(debt.interestRate);
  const minPayment = Number(debt.minimumPayment || 0);
  const originalPrincipal = Number(debt.originalPrincipal);
  const paidPercent = originalPrincipal > 0
    ? ((originalPrincipal - balance) / originalPrincipal) * 100
    : 0;

  const projection = rate > 0 && minPayment > 0
    ? calculateAmortization(balance, rate, minPayment)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/debts"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{debt.name}</h1>
          <p className="text-muted-foreground">
            {DEBT_TYPE_LABELS[debt.type]}
            {debt.lender && ` at ${debt.lender}`}
          </p>
        </div>
        <div className="flex gap-2">
          <DebtEditDialog debt={{
            id: debt.id,
            name: debt.name,
            type: debt.type,
            lender: debt.lender,
            originalPrincipal: Number(debt.originalPrincipal),
            currentBalance: Number(debt.currentBalance),
            interestRate: Number(debt.interestRate),
            minimumPayment: debt.minimumPayment ? Number(debt.minimumPayment) : null,
          }} />
          <DebtDeleteDialog debtId={debt.id} debtName={debt.name} />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Current Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(balance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Original Amount</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(originalPrincipal)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Interest Rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatPercent(rate * 100, 2)} APR</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Min Payment</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{minPayment > 0 ? formatCurrency(minPayment) : "—"}/mo</div></CardContent>
        </Card>
      </div>

      {/* Linked Assets */}
      {debt.linkedAssets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5">
              <Link2 className="size-4" />Linked Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {debt.linkedAssets.map((asset) => (
                <Link
                  key={asset.id}
                  href={`/assets/${asset.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="size-8 rounded bg-primary/10 flex items-center justify-center">
                    {asset.type === "REAL_ESTATE" ? <Home className="size-4 text-primary" /> :
                     asset.type === "VEHICLE" ? <Car className="size-4 text-primary" /> :
                     <Link2 className="size-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{asset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Value: {formatCurrency(asset.currentValue)}
                      {" · Equity: "}
                      <span className={Number(asset.currentValue) - balance >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(Number(asset.currentValue) - balance)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>Payoff Progress</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{formatPercent(paidPercent)} paid off</span>
            <span>{formatCurrency(originalPrincipal - balance)} of {formatCurrency(originalPrincipal)}</span>
          </div>
          <Progress value={paidPercent} className="h-3" />
        </CardContent>
      </Card>

      {/* Payoff Projection */}
      {projection && (
        <Card>
          <CardHeader>
            <CardTitle>Payoff Projection</CardTitle>
            <CardDescription>At current minimum payment of {formatCurrency(minPayment)}/mo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="text-center p-3 rounded-lg border">
                <div className="text-2xl font-bold">{projection.monthsRemaining}</div>
                <div className="text-xs text-muted-foreground">Months remaining</div>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <div className="text-2xl font-bold">
                  {Math.floor(projection.monthsRemaining / 12)}y {projection.monthsRemaining % 12}m
                </div>
                <div className="text-xs text-muted-foreground">Time to payoff</div>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(projection.totalInterest)}</div>
                <div className="text-xs text-muted-foreground">Total interest</div>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <div className="text-2xl font-bold">{formatCurrency(projection.totalPayments)}</div>
                <div className="text-xs text-muted-foreground">Total payments</div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Estimated payoff: <strong>{projection.payoffDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extra Payment Calculator */}
      {rate > 0 && minPayment > 0 && (
        <ExtraPaymentCalculator
          balance={balance}
          annualRate={rate}
          monthlyPayment={minPayment}
        />
      )}

      {/* Amortization Schedule (first 24 months) */}
      {projection && projection.schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Amortization Schedule</CardTitle>
            <CardDescription>Showing first {Math.min(24, projection.schedule.length)} of {projection.schedule.length} months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Month</th>
                    <th className="text-right py-2 px-4">Payment</th>
                    <th className="text-right py-2 px-4">Principal</th>
                    <th className="text-right py-2 px-4">Interest</th>
                    <th className="text-right py-2 pl-4">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.schedule.slice(0, 24).map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.month}</td>
                      <td className="text-right py-2 px-4">{formatCurrency(row.payment)}</td>
                      <td className="text-right py-2 px-4 text-green-600">{formatCurrency(row.principal)}</td>
                      <td className="text-right py-2 px-4 text-red-600">{formatCurrency(row.interest)}</td>
                      <td className="text-right py-2 pl-4 font-medium">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record Payment */}
      <Card>
        <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
        <CardContent>
          <form action={recordDebtPaymentAction} className="grid gap-4 sm:grid-cols-4 items-end">
            <input type="hidden" name="debtId" value={id} />
            <div className="space-y-1">
              <Label>Total Amount</Label>
              <Input name="totalAmount" type="number" step="0.01" defaultValue={minPayment || ""} required />
            </div>
            <div className="space-y-1">
              <Label>Principal</Label>
              <Input name="principalAmount" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Interest</Label>
              <Input name="interestAmount" type="number" step="0.01" placeholder="0.00" />
            </div>
            <Button type="submit">Record Payment</Button>
          </form>
        </CardContent>
      </Card>

      {/* Payment History */}
      {debt.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>{debt.payments.length} payments recorded</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {debt.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatDate(p.paymentDate)}</span>
                      {p.linkedTransaction ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          <Link2 className="size-3 mr-1" />
                          {p.linkedTransaction.payee || p.linkedTransaction.description || "Linked"}
                        </Badge>
                      ) : (
                        <PaymentTransactionLink
                          paymentId={p.id}
                          paymentAmount={Number(p.totalAmount)}
                          transactions={recentTransactions.map((t) => ({
                            id: t.id,
                            payee: t.payee,
                            description: t.description,
                            amount: Number(t.amount),
                            date: t.date.toISOString(),
                          }))}
                        />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Principal: {formatCurrency(p.principalAmount)} &middot; Interest: {formatCurrency(p.interestAmount)}
                      {Number(p.extraPrincipal) > 0 && <> &middot; Extra: {formatCurrency(p.extraPrincipal)}</>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">{formatCurrency(p.totalAmount)}</div>
                    {p.remainingBalance !== null && (
                      <div className="text-xs text-muted-foreground">Bal: {formatCurrency(p.remainingBalance)}</div>
                    )}
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
