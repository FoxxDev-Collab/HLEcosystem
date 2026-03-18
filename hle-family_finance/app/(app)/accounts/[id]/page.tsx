import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Archive, Trash2 } from "lucide-react";
import { archiveAccountAction, deleteAccountAction } from "../actions";
import { AdjustBalanceForm } from "@/components/adjust-balance-form";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking", SAVINGS: "Savings", CREDIT_CARD: "Credit Card",
  CASH: "Cash", INVESTMENT: "Investment", LOAN: "Loan", HSA: "HSA", OTHER: "Other",
};

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const account = await prisma.account.findUnique({
    where: { id, householdId },
  });
  if (!account) notFound();

  const recentTransactions = await prisma.transaction.findMany({
    where: { householdId, accountId: id },
    include: { category: true },
    orderBy: { date: "desc" },
    take: 25,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/accounts"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: account.color || "#6366f1" }} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
              <p className="text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type]} {account.institution && `at ${account.institution}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/accounts/${id}/edit`}>
              <Pencil className="size-4 mr-2" />
              Edit
            </Link>
          </Button>
          <form action={archiveAccountAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="isArchived" value={String(account.isArchived)} />
            <Button type="submit" variant="outline" size="sm">
              <Archive className="size-4 mr-2" />
              {account.isArchived ? "Restore" : "Archive"}
            </Button>
          </form>
          <form action={deleteAccountAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 className="size-4 mr-2" />
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Current Balance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className={`text-2xl font-bold ${Number(account.currentBalance) < 0 ? "text-red-600" : ""}`}>
              {formatCurrency(account.currentBalance)}
            </div>
            <AdjustBalanceForm accountId={account.id} currentBalance={Number(account.currentBalance)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Starting Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(account.initialBalance)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Status</CardTitle></CardHeader>
          <CardContent>
            <Badge variant={account.isArchived ? "secondary" : "default"}>
              {account.isArchived ? "Archived" : "Active"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <Link key={tx.id} href={`/transactions?id=${tx.id}`} className="flex items-center justify-between py-2 px-2 rounded hover:bg-accent/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{tx.payee || tx.description || "Transaction"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(tx.date)} &middot; {tx.category?.name || "Uncategorized"}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${tx.type === "INCOME" ? "text-green-600" : tx.type === "EXPENSE" ? "text-red-600" : ""}`}>
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                    {formatCurrency(tx.amount)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
