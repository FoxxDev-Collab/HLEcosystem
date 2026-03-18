import { getFileIcon, getFileCategoryColor } from "@/lib/mime-types";
import { Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FileIconProps = {
  mimeType?: string;
  isFolder?: boolean;
  className?: string;
  folderColor?: string;
};

export function FileIcon({ mimeType, isFolder, className, folderColor }: FileIconProps) {
  if (isFolder) {
    return <FolderIcon className={cn("size-5", className)} style={folderColor ? { color: folderColor } : undefined} />;
  }
  const Icon = getFileIcon(mimeType || "");
  const colorClass = getFileCategoryColor(mimeType || "");
  return <Icon className={cn("size-5", colorClass, className)} />;
}
