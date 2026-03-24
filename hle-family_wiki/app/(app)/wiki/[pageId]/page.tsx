import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getAllHouseholds } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative } from "@/lib/format";
import { WikiViewer } from "@/components/wiki-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Pencil, Pin, Archive, Trash2, Share2, FileText, Lock, Users, Globe,
  ChevronRight, Plus, MessageSquare, X, Tag,
} from "lucide-react";
import {
  togglePinAction, toggleArchiveAction, deletePageAction,
  addCommentAction, deleteCommentAction, createPageAction,
  sharePageAction, removeShareAction, addTagAction, removeTagAction,
} from "../actions";
import type { JSONContent } from "@tiptap/react";

const VIS: Record<string, { icon: typeof Lock; label: string }> = {
  PRIVATE: { icon: Lock, label: "Private" },
  HOUSEHOLD: { icon: Users, label: "Household" },
  SHARED: { icon: Share2, label: "Shared" },
  PUBLIC: { icon: Globe, label: "Public" },
};

export default async function PageViewPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = (await getCurrentHouseholdId())!;

  const page = await prisma.wikiPage.findUnique({
    where: { id: pageId },
    include: {
      children: { where: { archived: false }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true } },
      parent: { select: { id: true, title: true, parent: { select: { id: true, title: true } } } },
      comments: { where: { parentId: null }, include: { replies: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } },
      shares: true,
      tags: true,
    },
  });

  if (!page) notFound();

  const hasAccess = page.visibility === "PUBLIC"
    || (page.visibility === "PRIVATE" && page.ownerId === user.id)
    || (page.visibility === "HOUSEHOLD" && page.ownerId === householdId)
    || page.shares.some((s) => s.householdId === householdId)
    || page.createdBy === user.id
    || user.role === "ADMIN";
  if (!hasAccess) notFound();

  const userCanEdit = user.role === "ADMIN" || page.createdBy === user.id;

  const allUserIds = [...new Set([
    page.createdBy, page.updatedBy,
    ...page.comments.map((c) => c.userId),
    ...page.comments.flatMap((c) => c.replies.map((r) => r.userId)),
  ])] as string[];
  const userMap = await getUsersByIds(allUserIds);

  // Load households for sharing UI (only if user can edit)
  const allHouseholds = userCanEdit ? await getAllHouseholds() : [];
  const sharedHouseholdIds = new Set(page.shares.map((s) => s.householdId));
  const householdMap = new Map(allHouseholds.map((h) => [h.id, h.name]));
  const availableHouseholds = allHouseholds.filter(
    (h) => !sharedHouseholdIds.has(h.id) && h.id !== householdId
  );

  const vis = VIS[page.visibility];
  const VisIcon = vis.icon;

  const crumbs: { id: string; title: string }[] = [];
  if (page.parent?.parent) crumbs.push(page.parent.parent);
  if (page.parent) crumbs.push(page.parent);

  let depth = 1;
  if (page.parent) depth = 2;
  if (page.parent?.parent) depth = 3;

  return (
    <div className="max-w-4xl space-y-6">
      {crumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/wiki" className="hover:text-foreground">Wiki</Link>
          {crumbs.map((bc) => (
            <span key={bc.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5" />
              <Link href={`/wiki/${bc.id}`} className="hover:text-foreground">{bc.title}</Link>
            </span>
          ))}
          <ChevronRight className="size-3.5" />
          <span className="text-foreground">{page.title}</span>
        </nav>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{page.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs"><VisIcon className="size-3 mr-1" />{vis.label}</Badge>
            <span>Last edited by {userMap.get(page.updatedBy)?.name ?? "Unknown"} &middot; {formatDateRelative(page.updatedAt)}</span>
          </div>
          {/* Tags display + management */}
          <div className="flex items-center gap-1 flex-wrap">
            {page.tags.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-0.5">
                <Badge variant="secondary" className="text-xs">{t.tag}</Badge>
                {userCanEdit && (
                  <form action={removeTagAction} className="inline">
                    <input type="hidden" name="pageId" value={page.id} />
                    <input type="hidden" name="tag" value={t.tag} />
                    <button type="submit" className="text-muted-foreground hover:text-destructive -ml-1">
                      <X className="size-3" />
                    </button>
                  </form>
                )}
              </span>
            ))}
            {userCanEdit && (
              <form action={addTagAction} className="inline-flex items-center gap-1">
                <input type="hidden" name="pageId" value={page.id} />
                <Input name="tag" placeholder="Add tag..." className="h-6 w-24 text-xs px-2" />
                <Button type="submit" variant="ghost" size="sm" className="h-6 px-1.5">
                  <Tag className="size-3" />
                </Button>
              </form>
            )}
          </div>
        </div>
        {userCanEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/wiki/${page.id}/edit`}><Button variant="outline" size="sm"><Pencil className="size-3.5 mr-1" /> Edit</Button></Link>
            <form action={togglePinAction}><input type="hidden" name="id" value={page.id} /><Button type="submit" variant="ghost" size="sm"><Pin className={`size-3.5 ${page.pinned ? "text-amber-500" : ""}`} /></Button></form>
            <form action={toggleArchiveAction}><input type="hidden" name="id" value={page.id} /><Button type="submit" variant="ghost" size="sm"><Archive className="size-3.5" /></Button></form>
            <form action={deletePageAction}><input type="hidden" name="id" value={page.id} /><Button type="submit" variant="ghost" size="sm" className="text-red-600"><Trash2 className="size-3.5" /></Button></form>
          </div>
        )}
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <WikiViewer content={page.content as JSONContent} />
      </div>

      {/* Sharing Section */}
      {userCanEdit && page.visibility !== "PRIVATE" && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Share2 className="size-5" /> Sharing</h2>
            {page.shares.length > 0 && (
              <div className="space-y-2">
                {page.shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{householdMap.get(share.householdId) ?? share.householdId}</span>
                      <Badge variant={share.permission === "EDIT" ? "default" : "outline"} className="text-[10px]">
                        {share.permission}
                      </Badge>
                    </div>
                    <form action={removeShareAction}>
                      <input type="hidden" name="pageId" value={page.id} />
                      <input type="hidden" name="householdId" value={share.householdId} />
                      <Button type="submit" variant="ghost" size="sm" className="h-7 text-muted-foreground hover:text-destructive">
                        <X className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            {availableHouseholds.length > 0 && (
              <form action={sharePageAction} className="flex items-end gap-3">
                <input type="hidden" name="pageId" value={page.id} />
                <div className="flex-1">
                  <select
                    name="householdId"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select household...</option>
                    {availableHouseholds.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <select
                  name="permission"
                  className="flex h-9 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="VIEW">View</option>
                  <option value="EDIT">Edit</option>
                </select>
                <Button type="submit" variant="outline" size="sm"><Share2 className="size-3.5 mr-1" /> Share</Button>
              </form>
            )}
            {page.shares.length === 0 && availableHouseholds.length === 0 && (
              <p className="text-sm text-muted-foreground">No other households available to share with.</p>
            )}
          </div>
        </>
      )}

      {(page.children.length > 0 || depth < 3) && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Sub-pages</h2>
            {page.children.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {page.children.map((child) => (
                  <Link key={child.id} href={`/wiki/${child.id}`}>
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="flex items-center gap-2 py-3 px-4">
                        <FileText className="size-4 text-muted-foreground" /><span className="font-medium text-sm">{child.title}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
            {depth < 3 && (
              <form action={createPageAction} className="flex items-end gap-3">
                <input type="hidden" name="parentId" value={page.id} />
                <input type="hidden" name="visibility" value={page.visibility} />
                <div className="flex-1"><Input name="title" placeholder="New sub-page title..." required /></div>
                <Button type="submit" variant="outline" size="sm"><Plus className="size-3.5 mr-1" /> Add Sub-page</Button>
              </form>
            )}
          </div>
        </>
      )}

      <Separator />
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare className="size-5" /> Discussion ({page.comments.length})</h2>
        <form action={addCommentAction} className="flex gap-2">
          <input type="hidden" name="pageId" value={page.id} />
          <Input name="message" placeholder="Add a comment..." required className="flex-1" />
          <Button type="submit" variant="outline">Comment</Button>
        </form>
        {page.comments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">{(userMap.get(comment.userId)?.name ?? "?")[0].toUpperCase()}</div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{userMap.get(comment.userId)?.name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{formatDateRelative(comment.createdAt)}</span>
                </div>
                <p className="text-sm">{comment.message}</p>
              </div>
              {(comment.userId === user.id || user.role === "ADMIN") && (
                <form action={deleteCommentAction}><input type="hidden" name="id" value={comment.id} /><input type="hidden" name="pageId" value={page.id} /><Button type="submit" variant="ghost" size="sm" className="text-red-600 h-7 px-2"><Trash2 className="size-3" /></Button></form>
              )}
            </div>
            {comment.replies.map((reply) => (
              <div key={reply.id} className="ml-10 flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">{(userMap.get(reply.userId)?.name ?? "?")[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{userMap.get(reply.userId)?.name ?? "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{formatDateRelative(reply.createdAt)}</span>
                  </div>
                  <p className="text-sm">{reply.message}</p>
                </div>
                {(reply.userId === user.id || user.role === "ADMIN") && (
                  <form action={deleteCommentAction}><input type="hidden" name="id" value={reply.id} /><input type="hidden" name="pageId" value={page.id} /><Button type="submit" variant="ghost" size="sm" className="text-red-600 h-6 px-2"><Trash2 className="size-3" /></Button></form>
                )}
              </div>
            ))}
            <form action={addCommentAction} className="ml-10 flex gap-2">
              <input type="hidden" name="pageId" value={page.id} />
              <input type="hidden" name="parentId" value={comment.id} />
              <Input name="message" placeholder="Reply..." required className="flex-1 h-8 text-sm" />
              <Button type="submit" variant="ghost" size="sm">Reply</Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
