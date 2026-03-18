import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UploadDropzone } from "@/components/upload-dropzone";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateFolderDialog } from "@/components/create-folder-dialog";
import { ViewToggleWrapper } from "@/components/view-toggle-wrapper";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string; view?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { folderId, view, q } = await searchParams;
  const searchQuery = q?.trim() || null;

  // Build breadcrumb ancestors if inside a folder
  const ancestors: { id: string; name: string }[] = [];
  if (folderId && !searchQuery) {
    let currentId: string | null = folderId;
    while (currentId) {
      const result: { id: string; name: string; parentFolderId: string | null } | null =
        await prisma.folder.findFirst({
          where: { id: currentId, householdId, deletedAt: null },
          select: { id: true, name: true, parentFolderId: true },
        });
      if (!result) break;
      ancestors.unshift({ id: result.id, name: result.name });
      currentId = result.parentFolderId;
    }
  }

  // Fetch child folders (hidden during search)
  const folders = searchQuery
    ? []
    : await prisma.folder.findMany({
        where: {
          householdId,
          parentFolderId: folderId || null,
          ownerId: null,
          deletedAt: null,
        },
        include: {
          _count: {
            select: { files: true, subFolders: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

  // Fetch files — with optional search filter
  const files = await prisma.file.findMany({
    where: {
      householdId,
      ownerId: null,
      status: "ACTIVE",
      deletedAt: null,
      ...(searchQuery
        ? {
            OR: [
              { name: { contains: searchQuery, mode: "insensitive" as const } },
              { description: { contains: searchQuery, mode: "insensitive" as const } },
              { originalName: { contains: searchQuery, mode: "insensitive" as const } },
            ],
          }
        : { folderId: folderId || null }),
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize BigInt and Date for client components
  const serializedFolders = folders.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    _count: f._count,
    updatedAt: f.updatedAt.toISOString(),
  }));

  const serializedFiles = files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size.toString(),
    updatedAt: f.updatedAt.toISOString(),
    uploadedByUserId: f.uploadedByUserId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {searchQuery ? `Search: "${searchQuery}"` : "Files"}
          </h1>
          <p className="text-muted-foreground">
            {searchQuery
              ? `${files.length} result${files.length !== 1 ? "s" : ""} found`
              : "Browse and manage your household files"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput baseUrl="/browse" />
          <CreateFolderDialog
            parentFolderId={folderId}
            trigger={
              <Button variant="outline" size="sm">
                <FolderPlus className="size-4 mr-2" />
                New Folder
              </Button>
            }
          />
        </div>
      </div>

      {folderId && !searchQuery && ancestors.length > 0 && (
        <BreadcrumbNav ancestors={ancestors} baseUrl="/browse" />
      )}

      {!searchQuery && (
        <UploadDropzone folderId={folderId} isPersonal={false} />
      )}

      <ViewToggleWrapper
        folders={serializedFolders}
        files={serializedFiles}
        baseUrl="/browse"
        currentFolderId={folderId}
        initialView={view}
      />
    </div>
  );
}
