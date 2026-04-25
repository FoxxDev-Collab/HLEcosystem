import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatFileSize, formatStoragePercent } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Settings, HardDrive, Search } from "lucide-react";
import { ReindexButton } from "@/components/reindex-button";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const storageQuota = await prisma.storageQuota.findUnique({
    where: { householdId },
  });

  const totalSizeResult = await prisma.file.aggregate({
    where: { householdId, status: "ACTIVE" },
    _sum: { size: true },
  });

  const usedBytes = totalSizeResult._sum.size ?? BigInt(0);
  const maxBytes = storageQuota?.maxStorageBytes ?? BigInt(5368709120);
  const usagePercent = formatStoragePercent(usedBytes, maxBytes);

  const [totalIndexable, indexedCount] = await Promise.all([
    prisma.file.count({
      where: { householdId, status: "ACTIVE", deletedAt: null },
    }),
    prisma.fileContent.count({
      where: { file: { householdId, status: "ACTIVE", deletedAt: null } },
    }),
  ]);
  const unindexedCount = totalIndexable - indexedCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your file server settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5" />
            Storage
          </CardTitle>
          <CardDescription>
            Your household storage usage and quota
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{formatFileSize(usedBytes)} used</span>
              <span>{formatFileSize(maxBytes)} total</span>
            </div>
            <Progress value={usagePercent} />
            <p className="text-xs text-muted-foreground mt-2">
              {usagePercent}% of storage used
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            Search Index
          </CardTitle>
          <CardDescription>
            Full-text index for document content search (PDF, DOCX, XLSX, text files)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Indexed documents</span>
            <span className="font-medium tabular-nums">{indexedCount} / {totalIndexable}</span>
          </div>
          {unindexedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {unindexedCount} file{unindexedCount !== 1 ? "s" : ""} not yet indexed — click Re-index to process them.
              Files uploaded before indexing was enabled, or non-text formats (images, video), are skipped automatically.
            </p>
          )}
          <ReindexButton unindexedCount={unindexedCount} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Account
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              <span className="text-sm font-medium">{user.role}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
