import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getAllHouseholds } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDate, formatDateTime, formatDateRelative, estimateReadingTime, formatWordCount } from "@/lib/format";
import { WikiViewer } from "@/components/wiki-editor";
import { TableOfContents } from "@/components/table-of-contents";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Pencil, Pin, Archive, Trash2, Share2, FileText, Lock, Users, Globe,
  ChevronRight, Plus, MessageSquare, X, Tag, Clock, BookOpen, History,
  User, Calendar, Eye, CornerDownRight,
} from "lucide-react";
import {
  togglePinAction, toggleArchiveAction, deletePageAction,
  addCommentAction, deleteCommentAction, createPageAction,
  sharePageAction, removeShareAction, addTagAction, removeTagAction,
} from "../actions";
import type { JSONContent } from "@tiptap/react";

const VIS: Record<string, { icon: typeof Lock; label: string; color: string }> = {
  PRIVATE: { icon: Lock, label: "Private", color: "bg-muted text-muted-foreground" },
  HOUSEHOLD: { icon: Users, label: "Household", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
  SHARED: { icon: Share2, label: "Shared", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  PUBLIC: { icon: Globe, label: "Public", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
};

export default async function PageViewPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = (await getCurrentHouseholdId())!;

  const page = await prisma.wikiPage.findUnique({
    where: { id: pageId },
    include: {
      children: { where: { archived: false }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true, updatedAt: true, wordCount: true } },
      parent: { select: { id: true, title: true, parent: { select: { id: true, title: true } } } },
      comments: { where: { parentId: null }, include: { replies: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } },
      shares: true,
      tags: true,
      versions: { orderBy: { version: "desc" }, take: 10, select: { id: true, version: true, title: true, editedBy: true, wordCount: true, createdAt: true } },
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
    ...page.versions.map((v) => v.editedBy),
  ])] as string[];
  const userMap = await getUsersByIds(allUserIds);

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

  const createdByUser = userMap.get(page.createdBy);
  const updatedByUser = userMap.get(page.updatedBy);
  const totalComments = page.comments.length + page.comments.reduce((acc, c) => acc + c.replies.length, 0);
  const versionCount = page.versions.length > 0 ? page.versions[0].version : 0;

  return (
    <div className="flex gap-8 max-w-[1200px]">
      {/* ─── Main Content Column ─── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Breadcrumbs */}
        {crumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/wiki" className="hover:text-foreground transition-colors">Wiki</Link>
            {crumbs.map((bc) => (
              <span key={bc.id} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                <Link href={`/wiki/${bc.id}`} className="hover:text-foreground transition-colors">{bc.title}</Link>
              </span>
            ))}
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium">{page.title}</span>
          </nav>
        )}

        {/* Page Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="wiki-title text-3xl md:text-4xl text-foreground">{page.title}</h1>
            {userCanEdit && (
              <div className="flex items-center gap-1 shrink-0 pt-1">
                <Link href={`/wiki/${page.id}/edit`}>
                  <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs">
                    <Pencil className="size-3" /> Edit
                  </Button>
                </Link>
                <form action={togglePinAction}>
                  <input type="hidden" name="id" value={page.id} />
                  <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
                    <Pin className={`size-3.5 ${page.pinned ? "text-amber-500" : "text-muted-foreground"}`} />
                  </Button>
                </form>
                <form action={toggleArchiveAction}>
                  <input type="hidden" name="id" value={page.id} />
                  <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
                    <Archive className="size-3.5 text-muted-foreground" />
                  </Button>
                </form>
                <form action={deletePageAction}>
                  <input type="hidden" name="id" value={page.id} />
                  <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Meta line */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <Badge className={`${vis.color} text-[11px] font-medium border-0`}>
              <VisIcon className="size-3 mr-1" />{vis.label}
            </Badge>
            <span className="flex items-center gap-1">
              <User className="size-3" />
              {updatedByUser?.name ?? "Unknown"}
            </span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDateRelative(page.updatedAt)}
            </span>
            {page.wordCount > 0 && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="size-3" />
                  {estimateReadingTime(page.wordCount)}
                </span>
              </>
            )}
          </div>

          {/* Tags */}
          {(page.tags.length > 0 || userCanEdit) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {page.tags.map((t) => (
                <span key={t.id} className="inline-flex items-center">
                  <Link href={`/wiki/search?tag=${encodeURIComponent(t.tag)}`}>
                    <Badge variant="secondary" className="text-[11px] cursor-pointer hover:bg-secondary/80 transition-colors">
                      <Tag className="size-2.5 mr-1" />{t.tag}
                    </Badge>
                  </Link>
                  {userCanEdit && (
                    <form action={removeTagAction} className="inline">
                      <input type="hidden" name="pageId" value={page.id} />
                      <input type="hidden" name="tag" value={t.tag} />
                      <button type="submit" className="text-muted-foreground/50 hover:text-destructive transition-colors -ml-0.5">
                        <X className="size-3" />
                      </button>
                    </form>
                  )}
                </span>
              ))}
              {userCanEdit && (
                <form action={addTagAction} className="inline-flex items-center gap-1">
                  <input type="hidden" name="pageId" value={page.id} />
                  <Input name="tag" placeholder="Add tag..." className="h-6 w-20 text-[11px] px-2 bg-transparent" />
                  <Button type="submit" variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground">
                    <Plus className="size-3" />
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        <Separator className="opacity-60" />

        {/* Page Content */}
        <article className="wiki-viewer">
          <WikiViewer content={page.content as JSONContent} />
        </article>

        {/* Sub-pages */}
        {(page.children.length > 0 || (userCanEdit && depth < 3)) && (
          <>
            <Separator className="opacity-60" />
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <FileText className="size-3.5" /> Sub-pages
              </h2>
              {page.children.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {page.children.map((child) => (
                    <Link key={child.id} href={`/wiki/${child.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/50 transition-colors cursor-pointer group">
                        <FileText className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">{child.title}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateRelative(child.updatedAt)}
                            {child.wordCount > 0 && ` · ${formatWordCount(child.wordCount)}`}
                          </span>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {userCanEdit && depth < 3 && (
                <form action={createPageAction} className="flex items-end gap-3">
                  <input type="hidden" name="parentId" value={page.id} />
                  <input type="hidden" name="visibility" value={page.visibility} />
                  <div className="flex-1"><Input name="title" placeholder="New sub-page title..." required className="h-9" /></div>
                  <Button type="submit" variant="outline" size="sm" className="h-9"><Plus className="size-3.5 mr-1" /> Add</Button>
                </form>
              )}
            </div>
          </>
        )}

        {/* Sharing Section */}
        {userCanEdit && page.visibility !== "PRIVATE" && (
          <>
            <Separator className="opacity-60" />
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Share2 className="size-3.5" /> Sharing
              </h2>
              {page.shares.length > 0 && (
                <div className="space-y-2">
                  {page.shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Users className="size-3.5" />
                        </div>
                        <span className="text-sm font-medium">{householdMap.get(share.householdId) ?? share.householdId}</span>
                        <Badge variant={share.permission === "EDIT" ? "default" : "outline"} className="text-[10px]">
                          {share.permission === "EDIT" ? "Can Edit" : "View Only"}
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
                  <Button type="submit" variant="outline" size="sm" className="h-9"><Share2 className="size-3.5 mr-1" /> Share</Button>
                </form>
              )}
            </div>
          </>
        )}

        {/* Comments / Discussion */}
        <Separator className="opacity-60" />
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <MessageSquare className="size-3.5" /> Discussion ({totalComments})
          </h2>

          <form action={addCommentAction} className="flex gap-2">
            <input type="hidden" name="pageId" value={page.id} />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary mt-0.5">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <Input name="message" placeholder="Add a comment..." required className="flex-1 h-9" />
            <Button type="submit" variant="outline" size="sm" className="h-9">Comment</Button>
          </form>

          {page.comments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/40">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {(userMap.get(comment.userId)?.name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{userMap.get(comment.userId)?.name ?? "Unknown"}</span>
                    <span className="text-[11px] text-muted-foreground" title={formatDateTime(comment.createdAt)}>{formatDateRelative(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{comment.message}</p>
                </div>
                {(comment.userId === user.id || user.role === "ADMIN") && (
                  <form action={deleteCommentAction}>
                    <input type="hidden" name="id" value={comment.id} />
                    <input type="hidden" name="pageId" value={page.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-7 px-2">
                      <Trash2 className="size-3" />
                    </Button>
                  </form>
                )}
              </div>

              {/* Replies */}
              {comment.replies.map((reply) => (
                <div key={reply.id} className="ml-11 flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {(userMap.get(reply.userId)?.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{userMap.get(reply.userId)?.name ?? "Unknown"}</span>
                      <span className="text-[11px] text-muted-foreground" title={formatDateTime(reply.createdAt)}>{formatDateRelative(reply.createdAt)}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{reply.message}</p>
                  </div>
                  {(reply.userId === user.id || user.role === "ADMIN") && (
                    <form action={deleteCommentAction}>
                      <input type="hidden" name="id" value={reply.id} />
                      <input type="hidden" name="pageId" value={page.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-6 px-1.5">
                        <Trash2 className="size-2.5" />
                      </Button>
                    </form>
                  )}
                </div>
              ))}

              {/* Reply form */}
              <form action={addCommentAction} className="ml-11 flex gap-2">
                <input type="hidden" name="pageId" value={page.id} />
                <input type="hidden" name="parentId" value={comment.id} />
                <CornerDownRight className="size-3.5 text-muted-foreground/50 mt-2 shrink-0" />
                <Input name="message" placeholder="Reply..." required className="flex-1 h-8 text-sm" />
                <Button type="submit" variant="ghost" size="sm" className="h-8 text-xs">Reply</Button>
              </form>
            </div>
          ))}

          {page.comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Start the discussion.</p>
          )}
        </div>
      </div>

      {/* ─── Metadata Sidebar ─── */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-6 space-y-5">
          {/* Page Info */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Page Info</h3>

            {/* Created by */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Created by</span>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {(createdByUser?.name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium leading-tight">{createdByUser?.name ?? "Unknown"}</div>
                  <div className="text-[11px] text-muted-foreground" title={formatDateTime(page.createdAt)}>{formatDate(page.createdAt)}</div>
                </div>
              </div>
            </div>

            {/* Last edited by */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Last edited by</span>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {(updatedByUser?.name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium leading-tight">{updatedByUser?.name ?? "Unknown"}</div>
                  <div className="text-[11px] text-muted-foreground" title={formatDateTime(page.updatedAt)}>{formatDateRelative(page.updatedAt)}</div>
                </div>
              </div>
            </div>

            <Separator className="opacity-40" />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><BookOpen className="size-3" /> Words</div>
                <div className="text-sm font-medium">{page.wordCount > 0 ? page.wordCount.toLocaleString() : "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="size-3" /> Read time</div>
                <div className="text-sm font-medium">{page.wordCount > 0 ? estimateReadingTime(page.wordCount) : "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><History className="size-3" /> Versions</div>
                <div className="text-sm font-medium">{versionCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><MessageSquare className="size-3" /> Comments</div>
                <div className="text-sm font-medium">{totalComments}</div>
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          {page.content && typeof page.content === "object" && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contents</h3>
                <TableOfContents content={page.content as JSONContent} />
              </div>
            </>
          )}

          {/* Version History */}
          {page.versions.length > 0 && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recent Edits</h3>
                <div className="space-y-1.5">
                  {page.versions.slice(0, 5).map((v) => (
                    <div key={v.id} className="flex items-start gap-2 text-[12px]">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground mt-0.5">
                        v{v.version}
                      </div>
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">
                          {userMap.get(v.editedBy)?.name ?? "Unknown"}
                        </div>
                        <div className="text-muted-foreground/60" title={formatDateTime(v.createdAt)}>
                          {formatDateRelative(v.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Sharing info (read-only view for non-editors) */}
          {!userCanEdit && page.shares.length > 0 && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Shared with</h3>
                <div className="space-y-1">
                  {page.shares.map((share) => (
                    <div key={share.id} className="flex items-center gap-2 text-sm">
                      <Users className="size-3 text-muted-foreground" />
                      <span className="truncate">{householdMap.get(share.householdId) ?? share.householdId}</span>
                      <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{share.permission}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
