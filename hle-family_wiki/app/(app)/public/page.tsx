import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative, estimateReadingTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { FileText, Globe, ChevronRight, Clock, BookOpen } from "lucide-react";
import type { WikiPage } from "@prisma/client";

type P = WikiPage & { children: { id: string }[] };

export default async function PublicPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const pages: P[] = await prisma.wikiPage.findMany({
    where: { visibility: "PUBLIC", archived: false, parentId: null },
    include: { children: { select: { id: true } } },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  const userMap = await getUsersByIds([...new Set(pages.map((p: P) => p.updatedBy))] as string[]);

  return (
    <div className="space-y-6 max-w-[800px]">
      <div>
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <h1 className="wiki-title text-3xl text-foreground">Public Pages</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{pages.length} pages visible to everyone</p>
      </div>

      {pages.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <BookOpen className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No public pages yet. Create a page and set visibility to Public.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((page: P) => (
            <Link key={page.id} href={`/wiki/${page.id}`}>
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{page.title}</p>
                  {page.contentText && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{page.contentText.substring(0, 100)}</p>
                  )}
                </div>
                {page.children.length > 0 && <Badge variant="outline" className="text-[10px] shrink-0">{page.children.length} sub</Badge>}
                <div className="text-[11px] text-muted-foreground text-right shrink-0">
                  <div>{userMap.get(page.updatedBy)?.name ?? "Unknown"}</div>
                  {page.wordCount > 0 && (
                    <div className="flex items-center gap-1"><Clock className="size-2.5" />{estimateReadingTime(page.wordCount)}</div>
                  )}
                  <div>{formatDateRelative(page.updatedAt)}</div>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
