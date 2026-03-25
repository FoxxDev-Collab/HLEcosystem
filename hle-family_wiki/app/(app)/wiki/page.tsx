import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative, estimateReadingTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Pin, FileText, Lock, Users, Globe, Share2, ChevronRight,
  BookOpen, Clock, MessageSquare,
} from "lucide-react";
import { createPageAction } from "./actions";
import type { WikiPage as WikiPageModel } from "@prisma/client";

type PageWithMeta = WikiPageModel & {
  children: { id: string }[];
  tags: { tag: string }[];
  _count: { comments: number };
};

const VIS: Record<string, { icon: typeof Lock; label: string; color: string }> = {
  PRIVATE: { icon: Lock, label: "Private", color: "bg-muted text-muted-foreground" },
  HOUSEHOLD: { icon: Users, label: "Household", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
  SHARED: { icon: Share2, label: "Shared", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  PUBLIC: { icon: Globe, label: "Public", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
};

export default async function WikiPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = (await getCurrentHouseholdId())!;

  const [ownedPages, sharedIds] = await Promise.all([
    prisma.wikiPage.findMany({
      where: { archived: false, parentId: null, OR: [
        { ownerId: user.id, visibility: "PRIVATE" },
        { ownerId: householdId, visibility: "HOUSEHOLD" },
        { visibility: "PUBLIC" },
      ]},
      include: {
        children: { select: { id: true } },
        tags: { select: { tag: true }, take: 3 },
        _count: { select: { comments: true } },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.pageShare.findMany({ where: { householdId }, select: { pageId: true } }),
  ]);

  const sharedPages = sharedIds.length > 0
    ? await prisma.wikiPage.findMany({
        where: { id: { in: sharedIds.map((s) => s.pageId) }, archived: false, parentId: null },
        include: {
          children: { select: { id: true } },
          tags: { select: { tag: true }, take: 3 },
          _count: { select: { comments: true } },
        },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: 100,
      })
    : [];

  const seen = new Set(ownedPages.map((p: PageWithMeta) => p.id));
  const allPages: PageWithMeta[] = [...ownedPages, ...sharedPages.filter((p: PageWithMeta) => !seen.has(p.id))];

  const userMap = await getUsersByIds([...new Set(allPages.map((p: PageWithMeta) => p.updatedBy))] as string[]);
  const pinned = allPages.filter((p) => p.pinned);
  const recent = allPages.filter((p) => !p.pinned);

  return (
    <div className="space-y-8 max-w-[1000px]">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="wiki-title text-3xl text-foreground">Wiki</h1>
          <p className="text-sm text-muted-foreground mt-1">{allPages.length} pages in your knowledge base</p>
        </div>
      </div>

      {/* Create new page */}
      <div className="rounded-lg border border-border/60 bg-card p-5">
        <form action={createPageAction} className="flex items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium text-muted-foreground">New Page</Label>
            <Input id="title" name="title" required placeholder="What do you want to write about?" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visibility" className="text-xs font-medium text-muted-foreground">Visibility</Label>
            <select id="visibility" name="visibility" defaultValue="HOUSEHOLD" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="PRIVATE">Private</option>
              <option value="HOUSEHOLD">Household</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>
          <Button type="submit" className="h-10"><Plus className="size-4 mr-1.5" />Create</Button>
        </form>
      </div>

      {/* Pinned pages */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Pin className="size-3" /> Pinned
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((p: PageWithMeta) => <PageCard key={p.id} page={p} userMap={userMap} />)}
          </div>
        </div>
      )}

      {/* Recent pages */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Pages</h2>
        {recent.length === 0 && pinned.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <BookOpen className="size-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No pages yet. Create one above to get started.</p>
          </div>
        ) : recent.length === 0 ? null : (
          <div className="space-y-2">
            {recent.map((p: PageWithMeta) => <PageRow key={p.id} page={p} userMap={userMap} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function PageCard({ page, userMap }: { page: PageWithMeta; userMap: Map<string, { name: string }> }) {
  const v = VIS[page.visibility];
  const Icon = v.icon;
  return (
    <Link href={`/wiki/${page.id}`}>
      <div className="rounded-lg border border-border/60 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full space-y-3 group">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            <p className="font-medium text-sm truncate">{page.title}</p>
          </div>
          <Pin className="size-3 shrink-0 text-amber-500" />
        </div>
        {page.contentText && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{page.contentText.substring(0, 120)}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${v.color} text-[10px] font-medium border-0`}><Icon className="size-2.5 mr-1" />{v.label}</Badge>
          {page.children.length > 0 && <Badge variant="outline" className="text-[10px]">{page.children.length} sub</Badge>}
          {page.tags.slice(0, 2).map((t) => (
            <Badge key={t.tag} variant="secondary" className="text-[10px]">{t.tag}</Badge>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {userMap.get(page.updatedBy)?.name ?? "Unknown"} &middot; {formatDateRelative(page.updatedAt)}
        </div>
      </div>
    </Link>
  );
}

function PageRow({ page, userMap }: { page: PageWithMeta; userMap: Map<string, { name: string }> }) {
  const v = VIS[page.visibility];
  const Icon = v.icon;
  return (
    <Link href={`/wiki/${page.id}`}>
      <div className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
        <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{page.title}</p>
            {page.pinned && <Pin className="size-3 text-amber-500 shrink-0" />}
          </div>
          {page.contentText && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{page.contentText.substring(0, 100)}</p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {page.tags.slice(0, 2).map((t) => (
            <Badge key={t.tag} variant="secondary" className="text-[10px]">{t.tag}</Badge>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
          <Badge className={`${v.color} text-[10px] font-medium border-0`}><Icon className="size-2.5 mr-1" />{v.label}</Badge>
          {page.wordCount > 0 && (
            <span className="flex items-center gap-0.5"><Clock className="size-2.5" />{estimateReadingTime(page.wordCount)}</span>
          )}
          {page._count.comments > 0 && (
            <span className="flex items-center gap-0.5"><MessageSquare className="size-2.5" />{page._count.comments}</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground text-right shrink-0 w-20">
          <div className="truncate">{userMap.get(page.updatedBy)?.name ?? "Unknown"}</div>
          <div>{formatDateRelative(page.updatedAt)}</div>
        </div>
        <ChevronRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
      </div>
    </Link>
  );
}
