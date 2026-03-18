import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { uploadImportAction } from "./actions";

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
            <form action={uploadImportAction} encType="multipart/form-data" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select name="accountId" defaultValue={accounts[0]?.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select name="format" defaultValue="WELLS_FARGO">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WELLS_FARGO">Wells Fargo CSV</SelectItem>
                      <SelectItem value="GENERIC">Generic CSV</SelectItem>
                      <SelectItem value="OFX">OFX / QFX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input name="file" type="file" accept=".csv,.ofx,.qfx" required />
                </div>
              </div>
              <Button type="submit">
                <Upload className="size-4 mr-2" />
                Upload & Parse
              </Button>
            </form>
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
