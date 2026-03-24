import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatDateRelative } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Lock } from "lucide-react";
import { createPageAction } from "../wiki/actions";
import type { WikiPage } from "@prisma/client";

type P = WikiPage & { children: { id: string }[] };

export default async function PersonalPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const pages: P[] = await prisma.wikiPage.findMany({
    where: { ownerId: user.id, visibility: "PRIVATE", archived: false, parentId: null },
    include: { children: { select: { id: true } } },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Lock className="size-5 text-muted-foreground" /><h1 className="text-2xl font-bold">Personal Notes</h1></div>
        <Badge variant="outline">{pages.length} pages</Badge>
      </div>
      <Card><CardContent className="pt-6">
        <form action={createPageAction} className="flex items-end gap-4">
          <input type="hidden" name="visibility" value="PRIVATE" />
          <div className="flex-1 space-y-2"><Label htmlFor="title">New Personal Page</Label><Input id="title" name="title" required placeholder="Page title..." /></div>
          <Button type="submit"><Plus className="size-4 mr-1" /> Create</Button>
        </form>
      </CardContent></Card>
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No personal notes yet. These are private to you.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page: P) => (
            <Link key={page.id} href={`/wiki/${page.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /><p className="font-medium truncate">{page.title}</p></div>
                  {page.children.length > 0 && <Badge variant="outline" className="text-xs">{page.children.length} sub-pages</Badge>}
                  <p className="text-xs text-muted-foreground">{formatDateRelative(page.updatedAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
