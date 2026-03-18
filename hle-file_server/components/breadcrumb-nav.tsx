import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type BreadcrumbItem = {
  id: string;
  name: string;
};

type BreadcrumbNavProps = {
  ancestors: BreadcrumbItem[];
  baseUrl: string;
};

export function BreadcrumbNav({ ancestors, baseUrl }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        href={baseUrl}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="size-4" />
        <span>Root</span>
      </Link>
      {ancestors.map((item) => (
        <span key={item.id} className="flex items-center gap-1">
          <ChevronRight className="size-3.5" />
          <Link
            href={`${baseUrl}?folderId=${item.id}`}
            className="hover:text-foreground transition-colors"
          >
            {item.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}
