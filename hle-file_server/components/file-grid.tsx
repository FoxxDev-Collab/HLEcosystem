import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FileIcon } from "@/components/file-icon";
import { formatFileSize, formatMimeType } from "@/lib/format";

type FolderItem = {
  id: string;
  name: string;
  color: string | null;
  _count: { files: number; subFolders: number };
  updatedAt: string;
};

type FileItem = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  updatedAt: string;
  uploadedByUserId: string;
};

type FileGridProps = {
  folders: FolderItem[];
  files: FileItem[];
  baseUrl: string;
  currentFolderId?: string | null;
};

export function FileGrid({ folders, files, baseUrl }: FileGridProps) {
  const hasContent = folders.length > 0 || files.length > 0;

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        This folder is empty. Upload files or create a subfolder to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {folders.map((folder) => (
        <Link
          key={folder.id}
          href={`${baseUrl}?folderId=${folder.id}`}
          className="group flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
        >
          <FileIcon
            isFolder
            folderColor={folder.color ?? undefined}
            className="size-10"
          />
          <span className="text-sm font-medium text-center truncate w-full">
            {folder.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {folder._count.files} files
          </span>
        </Link>
      ))}
      {files.map((file) => (
        <Link
          key={file.id}
          href={`/browse/${file.id}`}
          className="group flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
        >
          <FileIcon mimeType={file.mimeType} className="size-10" />
          <span className="text-sm font-medium text-center truncate w-full">
            {file.name}
          </span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {formatMimeType(file.mimeType)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(BigInt(file.size))}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
