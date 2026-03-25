import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { BulkCategorizer } from "@/components/bulk-categorizer";

export default async function CategorizePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [uncategorized, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, categoryId: null },
      include: { account: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.category.findMany({
      where: { householdId, isArchived: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const totalUncategorized = await prisma.transaction.count({
    where: { householdId, categoryId: null },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/transactions"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            AI Categorize
          </h1>
          <p className="text-muted-foreground text-sm">
            {totalUncategorized} uncategorized transaction{totalUncategorized !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {uncategorized.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">All transactions are categorized!</p>
            <Link
              href="/transactions"
              className="text-primary text-sm mt-2 inline-block hover:underline"
            >
              Back to Transactions
            </Link>
          </CardContent>
        </Card>
      ) : (
        <BulkCategorizer
          transactions={uncategorized.map((tx) => ({
            id: tx.id,
            payee: tx.payee,
            description: tx.description,
            amount: Number(tx.amount),
            date: tx.date.toISOString().split("T")[0],
            accountName: tx.account.name,
            type: tx.type,
          }))}
          categories={categories}
        />
      )}
    </div>
  );
}
