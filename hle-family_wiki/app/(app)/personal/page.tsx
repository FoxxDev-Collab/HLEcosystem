import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatDateRelative, estimateReadingTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Lock, ChevronRight, Clock, BookOpen } from "lucide-react";
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
    <div className="space-y-6 max-w-[800px]">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <h1 className="wiki-title text-3xl text-foreground">Personal Notes</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{pages.length} private pages</p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-5">
        <form action={createPageAction} className="flex items-end gap-4">
          <input type="hidden" name="visibility" value="PRIVATE" />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium text-muted-foreground">New Personal Page</Label>
            <Input id="title" name="title" required placeholder="What&apos;s on your mind?" className="h-10" />
          </div>
          <Button type="submit" className="h-10"><Plus className="size-4 mr-1.5" /> Create</Button>
        </form>
      </div>

      {pages.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <BookOpen className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No personal notes yet. These are private to you.</p>
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
