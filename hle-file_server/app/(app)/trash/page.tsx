import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatFileSize, formatDateRelative } from "@/lib/format";
import { FileIcon } from "@/components/file-icon";
import {
  restoreFileAction,
  restoreFolderAction,
  permanentDeleteFileAction,
  emptyTrashAction,
} from "./actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";

export default async function TrashPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  // Lazy purge: permanently delete items trashed more than 30 days ago
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.file.deleteMany({
    where: { householdId, deletedAt: { lt: thirtyDaysAgo } },
  });
  await prisma.folder.deleteMany({
    where: { householdId, deletedAt: { lt: thirtyDaysAgo } },
  });

  // Query trashed files
  const trashedFiles = await prisma.file.findMany({
    where: {
      householdId,
      status: "DELETED",
      deletedAt: { not: null },
    },
    orderBy: { deletedAt: "desc" },
  });

  // Query trashed folders
  const trashedFolders = await prisma.folder.findMany({
    where: {
      householdId,
      deletedAt: { not: null },
    },
    orderBy: { deletedAt: "desc" },
  });

  const hasItems = trashedFiles.length > 0 || trashedFolders.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
          <p className="text-muted-foreground">
            Deleted files and folders
          </p>
        </div>
        {hasItems && (
          <form action={emptyTrashAction}>
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 className="size-4 mr-2" />
              Empty Trash
            </Button>
          </form>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Items are permanently deleted after 30 days</span>
      </div>

      {!hasItems ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-16 text-center">
          <Trash2 className="size-16 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">Trash is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Deleted files and folders will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead className="w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trashedFolders.map((folder) => (
                <TableRow key={`folder-${folder.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileIcon isFolder folderColor={folder.color ?? undefined} className="size-5 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Folder</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">--</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateRelative(folder.deletedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <form action={restoreFolderAction}>
                        <input type="hidden" name="folderId" value={folder.id} />
                        <Button type="submit" variant="ghost" size="icon" title="Restore">
                          <RotateCcw className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {trashedFiles.map((file) => (
                <TableRow key={`file-${file.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileIcon mimeType={file.mimeType} className="size-5 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">File</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(file.size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateRelative(file.deletedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <form action={restoreFileAction}>
                        <input type="hidden" name="fileId" value={file.id} />
                        <Button type="submit" variant="ghost" size="icon" title="Restore">
                          <RotateCcw className="size-4" />
                        </Button>
                      </form>
                      <form action={permanentDeleteFileAction}>
                        <input type="hidden" name="fileId" value={file.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          title="Delete permanently"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
