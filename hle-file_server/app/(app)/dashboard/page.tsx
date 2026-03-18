import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatFileSize, formatDateRelative, formatStoragePercent } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Files, HardDrive, FolderTree, Upload } from "lucide-react";

async function getDashboardData(householdId: string) {
  const [fileCount, folderCount, recentFiles, storageQuota] = await Promise.all([
    prisma.file.count({
      where: { householdId, status: "ACTIVE", deletedAt: null },
    }),
    prisma.folder.count({
      where: { householdId, deletedAt: null },
    }),
    prisma.file.findMany({
      where: { householdId, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { folder: true },
    }),
    prisma.storageQuota.findUnique({
      where: { householdId },
    }),
  ]);

  const totalSizeResult = await prisma.file.aggregate({
    where: { householdId, status: "ACTIVE", deletedAt: null },
    _sum: { size: true },
  });
  const totalSize = totalSizeResult._sum.size ?? BigInt(0);

  return {
    fileCount,
    folderCount,
    recentFiles,
    totalSize,
    storageQuota,
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const data = await getDashboardData(householdId);
  const maxStorage = data.storageQuota?.maxStorageBytes ?? BigInt(5368709120);
  const usagePercent = formatStoragePercent(data.totalSize, maxStorage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <Files className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.fileCount}</div>
            <p className="text-xs text-muted-foreground">
              Active file{data.fileCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Folders</CardTitle>
            <FolderTree className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.folderCount}</div>
            <p className="text-xs text-muted-foreground">
              Folder{data.folderCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(data.totalSize)}</div>
            <p className="text-xs text-muted-foreground">
              of {formatFileSize(maxStorage)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Quota</CardTitle>
            <Upload className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usagePercent}%</div>
            <Progress value={usagePercent} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Recent Files</CardTitle>
            <CardDescription>Last 10 uploaded files</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No files yet. Upload your first file to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.folder?.name ?? "Root"} &middot; {formatFileSize(file.size)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateRelative(file.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
