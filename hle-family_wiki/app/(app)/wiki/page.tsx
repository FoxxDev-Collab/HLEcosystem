import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pin, FileText, Lock, Users, Globe, Share2 } from "lucide-react";
import { createPageAction } from "./actions";
import type { WikiPage as WikiPageModel } from "@prisma/client";

type PageWithChildren = WikiPageModel & { children: { id: string }[] };

const VIS: Record<string, { icon: typeof Lock; label: string; color: string }> = {
  PRIVATE: { icon: Lock, label: "Private", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  HOUSEHOLD: { icon: Users, label: "Household", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  SHARED: { icon: Share2, label: "Shared", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  PUBLIC: { icon: Globe, label: "Public", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
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
      include: { children: { select: { id: true } } },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.pageShare.findMany({ where: { householdId }, select: { pageId: true } }),
  ]);

  const sharedPages = sharedIds.length > 0
    ? await prisma.wikiPage.findMany({
        where: { id: { in: sharedIds.map((s) => s.pageId) }, archived: false, parentId: null },
        include: { children: { select: { id: true } } },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      })
    : [];

  const seen = new Set(ownedPages.map((p: PageWithChildren) => p.id));
  const allPages: PageWithChildren[] = [...ownedPages, ...sharedPages.filter((p: PageWithChildren) => !seen.has(p.id))];

  const userMap = await getUsersByIds([...new Set(allPages.map((p: PageWithChildren) => p.updatedBy))] as string[]);
  const pinned = allPages.filter((p) => p.pinned);
  const recent = allPages.filter((p) => !p.pinned);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wiki</h1>
        <Badge variant="outline">{allPages.length} pages</Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={createPageAction} className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="title">New Page</Label>
              <Input id="title" name="title" required placeholder="Page title..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select id="visibility" name="visibility" defaultValue="HOUSEHOLD" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="PRIVATE">Private</option>
                <option value="HOUSEHOLD">Household</option>
                <option value="PUBLIC">Public</option>
              </select>
            </div>
            <Button type="submit"><Plus className="size-4 mr-1" />Create</Button>
          </form>
        </CardContent>
      </Card>

      {pinned.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Pin className="size-3.5" /> Pinned</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((p: PageWithChildren) => <PageCard key={p.id} page={p} userMap={userMap} />)}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent Pages</h2>
        {recent.length === 0 && pinned.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No pages yet. Create one above.</p>
        ) : recent.length === 0 ? null : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p: PageWithChildren) => <PageCard key={p.id} page={p} userMap={userMap} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function PageCard({ page, userMap }: { page: PageWithChildren; userMap: Map<string, { name: string }> }) {
  const v = VIS[page.visibility];
  const Icon = v.icon;
  return (
    <Link href={`/wiki/${page.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <p className="font-medium truncate">{page.title}</p>
            </div>
            {page.pinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${v.color} text-xs`}><Icon className="size-3 mr-1" />{v.label}</Badge>
            {page.children.length > 0 && <Badge variant="outline" className="text-xs">{page.children.length} sub-pages</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{userMap.get(page.updatedBy)?.name ?? "Unknown"} &middot; {formatDateRelative(page.updatedAt)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
