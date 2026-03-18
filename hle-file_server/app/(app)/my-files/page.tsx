import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UploadDropzone } from "@/components/upload-dropzone";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateFolderDialog } from "@/components/create-folder-dialog";
import { ViewToggleWrapper } from "@/components/view-toggle-wrapper";
import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";

export default async function MyFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { folderId, view } = await searchParams;

  // Build breadcrumb ancestors if inside a folder
  const ancestors: { id: string; name: string }[] = [];
  if (folderId) {
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

  // Fetch child folders (personal to this user)
  const folders = await prisma.folder.findMany({
    where: {
      householdId,
      parentFolderId: folderId || null,
      ownerId: user.id,
      deletedAt: null,
    },
    include: {
      _count: {
        select: { files: true, subFolders: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Fetch files in this folder (personal to this user)
  const files = await prisma.file.findMany({
    where: {
      householdId,
      folderId: folderId || null,
      ownerId: user.id,
      status: "ACTIVE",
      deletedAt: null,
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
          <h1 className="text-2xl font-bold tracking-tight">My Files</h1>
          <p className="text-muted-foreground">
            Your personal file storage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateFolderDialog
            parentFolderId={folderId}
            isPersonal={true}
            trigger={
              <Button variant="outline" size="sm">
                <FolderPlus className="size-4 mr-2" />
                New Folder
              </Button>
            }
          />
        </div>
      </div>

      {folderId && ancestors.length > 0 && (
        <BreadcrumbNav ancestors={ancestors} baseUrl="/my-files" />
      )}

      <UploadDropzone folderId={folderId} isPersonal={true} />

      <ViewToggleWrapper
        folders={serializedFolders}
        files={serializedFiles}
        baseUrl="/my-files"
        currentFolderId={folderId}
        initialView={view}
      />
    </div>
  );
}
