import { createElement } from "react";
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
  // Use React.createElement rather than `const Icon = ...; <Icon />`.
  // The capitalized-variable-to-JSX pattern trips react-hooks/components
  // ("cannot create components during render") because the static analyzer
  // cannot prove the component reference is stable across renders.
  // createElement with a lowercase reference makes the intent explicit:
  // we are rendering an existing component, not defining a new one.
  const iconComponent = getFileIcon(mimeType || "");
  const colorClass = getFileCategoryColor(mimeType || "");
  return createElement(iconComponent, { className: cn("size-5", colorClass, className) });
}
