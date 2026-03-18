import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileIcon } from "@/components/file-icon";
import { formatFileSize, formatDateRelative, formatMimeType } from "@/lib/format";

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

type FileListProps = {
  folders: FolderItem[];
  files: FileItem[];
  baseUrl: string;
  currentFolderId?: string | null;
};

export function FileList({ folders, files, baseUrl }: FileListProps) {
  const hasContent = folders.length > 0 || files.length > 0;

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        This folder is empty. Upload files or create a subfolder to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Modified</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {folders.map((folder) => (
          <TableRow key={folder.id}>
            <TableCell>
              <Link
                href={`${baseUrl}?folderId=${folder.id}`}
                className="flex items-center gap-2 hover:underline font-medium"
              >
                <FileIcon isFolder folderColor={folder.color ?? undefined} />
                {folder.name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">Folder</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {folder._count.files} files, {folder._count.subFolders} folders
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateRelative(folder.updatedAt)}
            </TableCell>
          </TableRow>
        ))}
        {files.map((file) => (
          <TableRow key={file.id}>
            <TableCell>
              <Link
                href={`/browse/${file.id}`}
                className="flex items-center gap-2 hover:underline font-medium"
              >
                <FileIcon mimeType={file.mimeType} />
                {file.name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{formatMimeType(file.mimeType)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatFileSize(BigInt(file.size))}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateRelative(file.updatedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
