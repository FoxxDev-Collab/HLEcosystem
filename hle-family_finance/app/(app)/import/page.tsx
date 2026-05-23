import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [accounts, batches] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.importBatch.findMany({
      where: { householdId },
      include: { account: true },
      orderBy: { importedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Import Transactions</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload Statement</CardTitle>
          <CardDescription>
            Import transactions from your bank. Supports Wells Fargo CSV, generic CSV, and OFX/QFX formats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create an account first.</p>
          ) : (
            <ImportForm accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
          )}
        </CardContent>
      </Card>

      {/* Import History */}
      {batches.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Import History</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {batches.map((batch) => (
                <Link
                  key={batch.id}
                  href={`/import/${batch.id}`}
                  className="flex items-center justify-between py-3 hover:bg-accent/50 rounded px-2 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{batch.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {batch.account.name} &middot; {formatDate(batch.importedAt)} &middot; {batch.totalRows} rows
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={batch.isFinalized ? "default" : "secondary"}>
                      {batch.isFinalized ? `${batch.importedCount} imported` : "Pending review"}
                    </Badge>
                    {batch.duplicateCount > 0 && (
                      <Badge variant="outline">{batch.duplicateCount} duplicates</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
