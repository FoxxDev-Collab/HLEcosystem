import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, Archive, Trash2, Calendar, Hash, Wallet } from "lucide-react";
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
    include: { _count: { select: { transactions: true } } },
  });
  if (!account) notFound();

  const recentTransactions = await prisma.transaction.findMany({
    where: { householdId, accountId: id },
    include: { category: true },
    orderBy: { date: "desc" },
    take: 25,
  });

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Back link */}
      <Link
        href="/accounts"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Accounts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="size-5 rounded-full shrink-0"
            style={{ backgroundColor: account.color || "#6366f1" }}
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
            <p className="text-sm text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]}{account.institution ? ` at ${account.institution}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/accounts/${id}/edit`}>
              <Pencil className="size-4 mr-1.5" />
              Edit
            </Link>
          </Button>
          <form action={archiveAccountAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="isArchived" value={String(account.isArchived)} />
            <Button type="submit" variant="outline" size="sm">
              <Archive className="size-4 mr-1.5" />
              {account.isArchived ? "Restore" : "Archive"}
            </Button>
          </form>
          <form action={deleteAccountAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 className="size-4 mr-1.5" />
              Delete
            </Button>
          </form>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left — transactions */}
        <div className="space-y-4 min-w-0">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Transactions ({account._count.transactions})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet</p>
              ) : (
                <div className="divide-y">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {tx.payee || tx.description || "Transaction"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(tx.date)} &middot; {tx.category?.name || "Uncategorized"}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums shrink-0 ml-3 ${
                          tx.type === "INCOME" ? "tx-income" : tx.type === "EXPENSE" ? "tx-expense" : "tx-transfer"
                        }`}
                      >
                        {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right — metadata sidebar */}
        <div className="space-y-4">
          {/* Balance card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="size-4" />
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`text-2xl font-bold tabular-nums ${Number(account.currentBalance) < 0 ? "tx-expense" : ""}`}>
                {formatCurrency(account.currentBalance)}
              </div>
              <AdjustBalanceForm accountId={account.id} currentBalance={Number(account.currentBalance)} />
            </CardContent>
          </Card>

          {/* Details card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="size-3.5 shrink-0" />
                <span>Starting balance: {formatCurrency(account.initialBalance)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hash className="size-3.5 shrink-0" />
                <span>{account._count.transactions} transactions</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-3.5 shrink-0" />
                <span>Created {formatDate(account.createdAt)}</span>
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge variant={account.isArchived ? "secondary" : "default"} className="ml-auto">
                  {account.isArchived ? "Archived" : "Active"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
