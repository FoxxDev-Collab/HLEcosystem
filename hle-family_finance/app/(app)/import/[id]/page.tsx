import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X } from "lucide-react";
import { confirmImportAction, skipImportedTransactionAction } from "../actions";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  DUPLICATE: "bg-orange-100 text-orange-800",
  IMPORTED: "bg-green-100 text-green-800",
  SKIPPED: "bg-gray-100 text-gray-800",
};

export default async function ImportBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const batch = await prisma.importBatch.findUnique({
    where: { id, householdId },
    include: {
      account: true,
      transactions: {
        include: { suggestedCategory: true },
        orderBy: { date: "desc" },
      },
    },
  });
  if (!batch) notFound();

  const pendingCount = batch.transactions.filter((t) => t.matchStatus === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/import"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{batch.fileName}</h1>
            <p className="text-muted-foreground">
              {batch.account.name} &middot; {batch.totalRows} transactions &middot; {formatDate(batch.importedAt)}
            </p>
          </div>
        </div>
        {!batch.isFinalized && pendingCount > 0 && (
          <form action={confirmImportAction}>
            <input type="hidden" name="batchId" value={id} />
            <Button type="submit">
              <Check className="size-4 mr-2" />
              Import {pendingCount} Transactions
            </Button>
          </form>
        )}
        {batch.isFinalized && (
          <Badge className="bg-green-100 text-green-800 text-sm">Finalized</Badge>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Rows</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{batch.totalRows}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-yellow-600">{pendingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Imported</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-green-600">{batch.importedCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Duplicates</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-orange-600">{batch.duplicateCount}</div></CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {batch.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{tx.payee || tx.description}</span>
                    <Badge className={STATUS_BADGE[tx.matchStatus] || ""}>{tx.matchStatus}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(tx.date)}
                    {tx.suggestedCategory && (
                      <> &middot; <span style={{ color: tx.suggestedCategory.color || undefined }}>{tx.suggestedCategory.name}</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-medium ${Number(tx.amount) < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(tx.amount)}
                  </span>
                  {tx.matchStatus === "PENDING" && (
                    <form action={skipImportedTransactionAction}>
                      <input type="hidden" name="id" value={tx.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Skip">
                        <X className="size-3.5" />
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
