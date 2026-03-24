import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Globe } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Globe className="size-5 text-muted-foreground" /><h1 className="text-2xl font-bold">Public Pages</h1></div>
        <Badge variant="outline">{pages.length} pages</Badge>
      </div>
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No public pages yet. Create a page and set visibility to Public.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page: P) => (
            <Link key={page.id} href={`/wiki/${page.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /><p className="font-medium truncate">{page.title}</p></div>
                  {page.children.length > 0 && <Badge variant="outline" className="text-xs">{page.children.length} sub-pages</Badge>}
                  <p className="text-xs text-muted-foreground">{userMap.get(page.updatedBy)?.name ?? "Unknown"} &middot; {formatDateRelative(page.updatedAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
