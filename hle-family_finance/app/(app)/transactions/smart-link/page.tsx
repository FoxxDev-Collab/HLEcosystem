import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Link2 } from "lucide-react";
import { SmartLinker } from "./smart-linker";

export default async function SmartLinkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [transactions, patternCount] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId,
        type: "EXPENSE",
        date: { gte: ninetyDaysAgo },
        linkedDebtPayments: { none: {} },
        linkedBillPayments: { none: {} },
        recurringTransactionId: null,
      },
      include: {
        account: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.transactionLinkPattern.count({ where: { householdId } }),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Transactions
      </Link>

      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Link2 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Smart Link</h1>
          <p className="text-muted-foreground">
            Automatically connect transactions to your debts, bills, and recurring payments
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">All recent transactions are already linked. Nice work!</p>
          </CardContent>
        </Card>
      ) : (
        <SmartLinker
          transactions={transactions.map((t) => ({
            id: t.id,
            payee: t.payee,
            description: t.description,
            amount: Number(t.amount),
            date: t.date.toISOString(),
            accountName: t.account.name,
            accountId: t.accountId,
            type: t.type,
          }))}
          patternCount={patternCount}
        />
      )}
    </div>
  );
}
