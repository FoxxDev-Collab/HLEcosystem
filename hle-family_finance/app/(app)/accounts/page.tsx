import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Archive, ArchiveRestore } from "lucide-react";
import { archiveAccountAction } from "./actions";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit Card",
  CASH: "Cash",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  HSA: "HSA",
  OTHER: "Other",
};

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const accounts = await prisma.account.findMany({
    where: { householdId },
    orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { transactions: true } },
    },
  });

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);
  const totalBalance = activeAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);

  // Group by type
  const grouped = activeAccounts.reduce(
    (acc, account) => {
      const type = account.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(account);
      return acc;
    },
    {} as Record<string, typeof activeAccounts>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            {activeAccounts.length} account{activeAccounts.length !== 1 ? "s" : ""} &middot;{" "}
            {formatCurrency(totalBalance)} total
          </p>
        </div>
        <Button asChild>
          <Link href="/accounts/new">
            <Plus className="size-4 mr-2" />
            Add Account
          </Link>
        </Button>
      </div>

      {activeAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No accounts yet. Add your first account to start tracking.</p>
            <Button asChild>
              <Link href="/accounts/new">
                <Plus className="size-4 mr-2" />
                Add Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, typeAccounts]) => (
          <div key={type} className="space-y-3">
            <h2 className="text-lg font-semibold">{ACCOUNT_TYPE_LABELS[type] || type}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {typeAccounts.map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: account.color || "#6366f1" }}
                      />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{account.name}</CardTitle>
                        {account.institution && (
                          <p className="text-xs text-muted-foreground truncate">{account.institution}</p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-xl font-bold ${Number(account.currentBalance) < 0 ? "text-red-600" : ""}`}>
                        {formatCurrency(account.currentBalance)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {account._count.transactions} transaction{account._count.transactions !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}

      {archivedAccounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Archived</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {archivedAccounts.map((account) => (
              <Card key={account.id} className="opacity-60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: account.color || "#6366f1" }}
                    />
                    <CardTitle className="text-base truncate">{account.name}</CardTitle>
                  </div>
                  <form action={archiveAccountAction}>
                    <input type="hidden" name="id" value={account.id} />
                    <input type="hidden" name="isArchived" value="true" />
                    <Button type="submit" variant="ghost" size="icon" title="Restore">
                      <ArchiveRestore className="size-4" />
                    </Button>
                  </form>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-medium">{formatCurrency(account.currentBalance)}</div>
                  <Badge variant="secondary" className="mt-1">Archived</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
