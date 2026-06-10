import { useMemo, useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import {
  Archive,
  BookOpen,
  ChevronRight,
  Clock,
  CornerDownRight,
  FileText,
  History,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Share2,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react"
import {
  addCommentFn,
  addTagFn,
  deleteCommentFn,
  getWikiPageViewFn,
  removeShareFn,
  removeTagFn,
  sharePageFn,
} from "@/server/wiki/fns.collab"
import {
  createPageFn,
  deletePageFn,
  toggleArchiveFn,
  togglePinFn,
} from "@/server/wiki/fns.pages"
import type {
  CommentRow,
  HouseholdOption,
  ShareRow,
  ThreadedComment,
} from "@/server/wiki/collab"
import { WikiContent, TableOfContents } from "@/components/wiki/wiki-content"
import {
  VIS,
  estimateReadingTime,
  formatDateRelative,
} from "@/components/wiki/wiki-shared"
import { formatDate, formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { JSONContent } from "@tiptap/react"

export const Route = createFileRoute("/_authed/wiki/pages/$id/")({
  loader: async ({ params }) => {
    const data = await getWikiPageViewFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: PageViewPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function formatWordCount(count: number): string {
  if (count < 1000) return `${count} words`
  return `${(count / 1000).toFixed(1)}k words`
}

function Avatar({ name, size = 8 }: { name: string | null; size?: 6 | 8 }) {
  return (
    <div
      className={`flex ${size === 8 ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]"} shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary`}
    >
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  )
}

function PageViewPage() {
  const {
    page,
    crumbs,
    children,
    comments,
    tags,
    shares,
    versions,
    availableHouseholds,
    canEdit,
    viewer,
  } = Route.useLoaderData()
  const router = useRouter()
  const [tagError, setTagError] = useState<string | null>(null)

  const vis = VIS[page.visibility]
  const VisIcon = vis.icon
  const totalComments =
    comments.length + comments.reduce((acc, c) => acc + c.replies.length, 0)
  const versionCount = versions.length > 0 ? versions[0].version : 0
  // page.content arrives as JSONB text (serialization-safe); parse once.
  const content = useMemo(
    () => JSON.parse(page.content) as JSONContent,
    [page.content]
  )

  async function removeTag(tag: string) {
    setTagError(null)
    try {
      const result = await removeTagFn({ data: { pageId: page.id, tag } })
      if ("error" in result) {
        setTagError(result.error ?? "Could not remove tag.")
        return
      }
      router.invalidate()
    } catch {
      setTagError("Could not remove tag.")
    }
  }

  return (
    <div className="flex max-w-[1200px] gap-8">
      {/* ─── Main content column ─── */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Breadcrumbs */}
        {crumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link
              to="/wiki/pages"
              className="transition-colors hover:text-foreground"
            >
              Wiki
            </Link>
            {crumbs.map((bc) => (
              <span key={bc.id} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                <Link
                  to="/wiki/pages/$id"
                  params={{ id: bc.id }}
                  className="transition-colors hover:text-foreground"
                >
                  {bc.title}
                </Link>
              </span>
            ))}
            <ChevronRight className="size-3" />
            <span className="font-medium text-foreground">{page.title}</span>
          </nav>
        )}

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
              {page.icon ? `${page.icon} ` : ""}
              {page.title}
            </h1>
            {canEdit && (
              <PageActions
                pageId={page.id}
                pinned={page.pinned}
                archived={page.archived}
                title={page.title}
              />
            )}
          </div>

          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Badge className={`${vis.color} border-0 text-[11px] font-medium`}>
              <VisIcon className="mr-1 size-3" />
              {vis.label}
            </Badge>
            {page.pinned && (
              <Badge
                variant="secondary"
                className="text-[11px] font-medium text-amber-600 dark:text-amber-400"
              >
                <Pin className="mr-1 size-3" /> Pinned
              </Badge>
            )}
            {page.archived && (
              <Badge variant="outline" className="text-[11px] font-medium">
                <Archive className="mr-1 size-3" /> Archived
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <User className="size-3" />
              {page.updatedByName ?? "Unknown"}
            </span>
            <span>&middot;</span>
            <span
              className="flex items-center gap-1"
              title={formatDateTime(page.updatedAt)}
            >
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
          {(tags.length > 0 || canEdit) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span key={t.id} className="inline-flex items-center">
                  <Link to="/wiki/search" search={{ tag: t.tag }}>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-[11px] transition-colors hover:bg-secondary/80"
                    >
                      <Tag className="mr-1 size-2.5" />
                      {t.tag}
                    </Badge>
                  </Link>
                  {canEdit && (
                    <button
                      type="button"
                      title={`Remove tag ${t.tag}`}
                      className="-ml-0.5 text-muted-foreground/50 transition-colors hover:text-destructive"
                      onClick={() => removeTag(t.tag)}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))}
              {canEdit && (
                <AddTagForm
                  pageId={page.id}
                  onError={setTagError}
                  onSaved={() => {
                    setTagError(null)
                    router.invalidate()
                  }}
                />
              )}
            </div>
          )}
          {tagError && <p className="text-sm text-destructive">{tagError}</p>}
        </div>

        <Separator className="opacity-60" />

        {/* Page content (read-only TipTap render — never raw HTML) */}
        <article>
          <WikiContent content={content} />
        </article>

        {/* Sub-pages (creation only up to 3 levels deep, like legacy) */}
        {(children.length > 0 || (canEdit && crumbs.length < 2)) && (
          <>
            <Separator className="opacity-60" />
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                <FileText className="size-3.5" /> Sub-pages
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    to="/wiki/pages/$id"
                    params={{ id: child.id }}
                  >
                    <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/50">
                      <FileText className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {child.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateRelative(child.updatedAt)}
                          {child.wordCount > 0 &&
                            ` · ${formatWordCount(child.wordCount)}`}
                        </span>
                      </div>
                      <ChevronRight className="size-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
              {canEdit && crumbs.length < 2 && (
                <SubPageForm parentId={page.id} />
              )}
            </div>
          </>
        )}

        {/* Sharing */}
        {canEdit && page.visibility !== "PRIVATE" && (
          <>
            <Separator className="opacity-60" />
            <ShareManager
              pageId={page.id}
              shares={shares}
              availableHouseholds={availableHouseholds}
              onChanged={() => router.invalidate()}
            />
          </>
        )}

        {/* Discussion */}
        <Separator className="opacity-60" />
        <CommentsSection
          pageId={page.id}
          comments={comments}
          totalComments={totalComments}
          viewer={viewer}
          onChanged={() => router.invalidate()}
        />
      </div>

      {/* ─── Metadata sidebar ─── */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-6 space-y-5">
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Page Info
            </h3>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">
                Created by
              </span>
              <div className="flex items-center gap-2">
                <Avatar name={page.createdByName} size={6} />
                <div>
                  <div className="text-sm leading-tight font-medium">
                    {page.createdByName ?? "Unknown"}
                  </div>
                  <div
                    className="text-[11px] text-muted-foreground"
                    title={formatDateTime(page.createdAt)}
                  >
                    {formatDate(page.createdAt)}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">
                Last edited by
              </span>
              <div className="flex items-center gap-2">
                <Avatar name={page.updatedByName} size={6} />
                <div>
                  <div className="text-sm leading-tight font-medium">
                    {page.updatedByName ?? "Unknown"}
                  </div>
                  <div
                    className="text-[11px] text-muted-foreground"
                    title={formatDateTime(page.updatedAt)}
                  >
                    {formatDateRelative(page.updatedAt)}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="opacity-40" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <BookOpen className="size-3" /> Words
                </div>
                <div className="text-sm font-medium">
                  {page.wordCount > 0 ? page.wordCount.toLocaleString() : "—"}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" /> Read time
                </div>
                <div className="text-sm font-medium">
                  {page.wordCount > 0
                    ? estimateReadingTime(page.wordCount)
                    : "—"}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <History className="size-3" /> Versions
                </div>
                <div className="text-sm font-medium">{versionCount}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MessageSquare className="size-3" /> Comments
                </div>
                <div className="text-sm font-medium">{totalComments}</div>
              </div>
            </div>
          </div>

          {/* Table of contents */}
          <Separator className="opacity-40" />
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Contents
            </h3>
            <TableOfContents content={content} />
          </div>

          {/* Version history (list-only — legacy had no restore) */}
          {versions.length > 0 && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Recent Edits
                </h3>
                <div className="space-y-1.5">
                  {versions.slice(0, 5).map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start gap-2 text-[12px]"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
                        v{v.version}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-muted-foreground">
                          {v.editedByName ?? "Unknown"}
                        </div>
                        <div
                          className="text-muted-foreground/60"
                          title={formatDateTime(v.createdAt)}
                        >
                          {formatDateRelative(v.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Sharing info for non-editors */}
          {!canEdit && shares.length > 0 && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Shared with
                </h3>
                <div className="space-y-1">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Users className="size-3 text-muted-foreground" />
                      <span className="truncate">{share.householdName}</span>
                      <Badge
                        variant="outline"
                        className="ml-auto shrink-0 text-[9px]"
                      >
                        {share.permission}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

// ─── Tags ───────────────────────────────────────────────

function AddTagForm({
  pageId,
  onError,
  onSaved,
}: {
  pageId: string
  onError: (e: string | null) => void
  onSaved: () => void
}) {
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const tag = value.trim()
    if (!tag) return
    onError(null)
    setPending(true)
    try {
      const result = await addTagFn({ data: { pageId, tag } })
      if ("error" in result) {
        onError(result.error ?? "Could not add tag.")
        return
      }
      setValue("")
      onSaved()
    } catch {
      onError("Could not add tag.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="inline-flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add tag..."
        maxLength={50}
        className="h-6 w-24 bg-transparent px-2 text-[11px]"
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="h-6 px-1.5 text-muted-foreground"
      >
        <Plus className="size-3" />
      </Button>
    </form>
  )
}

// ─── Page actions (legacy: pin / archive / delete on the view) ──

function PageActions({
  pageId,
  pinned,
  archived,
  title,
}: {
  pageId: string
  pinned: boolean
  archived: boolean
  title: string
}) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run(fn: () => Promise<{ error?: string } | { ok: true }>) {
    setError(null)
    setPending(true)
    try {
      const result = await fn()
      if ("error" in result) {
        setError(result.error ?? "Something went wrong.")
        return
      }
      router.invalidate()
    } catch {
      setError("Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  async function onDelete() {
    setError(null)
    setPending(true)
    try {
      const result = await deletePageFn({ data: { id: pageId } })
      if ("error" in result) {
        setError(result.error ?? "Could not delete page.")
        setPending(false)
        return
      }
      router.navigate({ to: "/wiki/pages" })
    } catch {
      setError("Could not delete page.")
      setPending(false)
    }
  }

  return (
    <div className="shrink-0 space-y-1 pt-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          title={pinned ? "Unpin page" : "Pin page"}
          disabled={pending}
          onClick={() => run(() => togglePinFn({ data: { id: pageId } }))}
        >
          <Pin
            className={`size-3.5 ${pinned ? "text-amber-500" : "text-muted-foreground"}`}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={archived ? "Unarchive page" : "Archive page"}
          disabled={pending}
          onClick={() => run(() => toggleArchiveFn({ data: { id: pageId } }))}
        >
          <Archive className="size-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Delete page"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          render={<Link to="/wiki/pages/$id/edit" params={{ id: pageId }} />}
        >
          <Pencil className="size-3" /> Edit
        </Button>
      </div>
      {error && <p className="text-right text-xs text-destructive">{error}</p>}
      {confirmDelete && (
        <AlertDialog open onOpenChange={(o) => !o && setConfirmDelete(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The page, its sub-pages, comments, tags, shares and version
                history are permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDelete(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  onDelete()
                }}
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

// ─── Sub-page creation (legacy: form on the page view) ──
// Visibility is inherited from the parent server-side; the value sent here is
// a placeholder the server overrides for sub-pages.

function SubPageForm({ parentId }: { parentId: string }) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setError(null)
    setPending(true)
    try {
      const result = await createPageFn({
        data: {
          title: trimmed,
          visibility: "HOUSEHOLD",
          parentId,
          template: null,
        },
      })
      if ("error" in result) {
        setError(result.error ?? "Could not create sub-page.")
        return
      }
      if ("id" in result && result.id) {
        router.navigate({
          to: "/wiki/pages/$id/edit",
          params: { id: result.id },
        })
      }
    } catch {
      setError("Could not create sub-page.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New sub-page title..."
          required
          maxLength={300}
          className="h-9 flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
          className="h-9"
        >
          <Plus className="mr-1 size-3.5" /> Add
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// ─── Sharing ────────────────────────────────────────────

function ShareManager({
  pageId,
  shares,
  availableHouseholds,
  onChanged,
}: {
  pageId: string
  shares: Array<ShareRow>
  availableHouseholds: Array<HouseholdOption>
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onShare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await sharePageFn({
        data: {
          pageId,
          householdId: String(f.get("householdId") ?? ""),
          permission:
            String(f.get("permission") ?? "VIEW") === "EDIT" ? "EDIT" : "VIEW",
        },
      })
      if ("error" in result) {
        setError(result.error ?? "Could not share page.")
        return
      }
      onChanged()
    } catch {
      setError("Could not share page.")
    } finally {
      setPending(false)
    }
  }

  async function onRevoke(householdId: string) {
    setError(null)
    try {
      const result = await removeShareFn({ data: { pageId, householdId } })
      if ("error" in result) {
        setError(result.error ?? "Could not remove share.")
        return
      }
      onChanged()
    } catch {
      setError("Could not remove share.")
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        <Share2 className="size-3.5" /> Sharing
      </h2>
      {shares.length > 0 && (
        <div className="space-y-2">
          {shares.map((share) => (
            <div
              key={share.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="size-3.5" />
                </div>
                <span className="text-sm font-medium">
                  {share.householdName}
                </span>
                <Badge
                  variant={share.permission === "EDIT" ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {share.permission === "EDIT" ? "Can Edit" : "View Only"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                title="Remove share"
                className="h-7 text-muted-foreground hover:text-destructive"
                onClick={() => onRevoke(share.householdId)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {availableHouseholds.length > 0 && (
        <form onSubmit={onShare} className="flex items-end gap-3">
          <div className="flex-1">
            <select
              name="householdId"
              required
              defaultValue=""
              className={selectClass}
            >
              <option value="" disabled>
                Select household...
              </option>
              {availableHouseholds.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <select
            name="permission"
            defaultValue="VIEW"
            className={`${selectClass} w-28`}
          >
            <option value="VIEW">View</option>
            <option value="EDIT">Edit</option>
          </select>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending}
            className="h-9"
          >
            <Share2 className="mr-1 size-3.5" /> Share
          </Button>
        </form>
      )}
      {shares.length === 0 && availableHouseholds.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No other households to share with yet.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// ─── Comments ───────────────────────────────────────────

type Viewer = { id: string; name: string; isAdmin: boolean }

function CommentsSection({
  pageId,
  comments,
  totalComments,
  viewer,
  onChanged,
}: {
  pageId: string
  comments: Array<ThreadedComment>
  totalComments: number
  viewer: Viewer
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  async function deleteComment(id: string) {
    setError(null)
    try {
      const result = await deleteCommentFn({ data: { id } })
      if ("error" in result) {
        setError(result.error ?? "Could not delete comment.")
        return
      }
      onChanged()
    } catch {
      setError("Could not delete comment.")
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        <MessageSquare className="size-3.5" /> Discussion ({totalComments})
      </h2>

      <CommentForm
        pageId={pageId}
        parentId={null}
        viewerName={viewer.name}
        onError={setError}
        onSaved={() => {
          setError(null)
          onChanged()
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      {comments.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <CommentBody
            comment={comment}
            viewer={viewer}
            onDelete={() => deleteComment(comment.id)}
          />
          {comment.replies.map((reply) => (
            <div key={reply.id} className="ml-11">
              <CommentBody
                comment={reply}
                viewer={viewer}
                isReply
                onDelete={() => deleteComment(reply.id)}
              />
            </div>
          ))}
          <div className="ml-11 flex gap-2">
            <CornerDownRight className="mt-2 size-3.5 shrink-0 text-muted-foreground/50" />
            <CommentForm
              pageId={pageId}
              parentId={comment.id}
              viewerName={viewer.name}
              onError={setError}
              onSaved={() => {
                setError(null)
                onChanged()
              }}
            />
          </div>
        </div>
      ))}

      {comments.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No comments yet. Start the discussion.
        </p>
      )}
    </div>
  )
}

function CommentBody({
  comment,
  viewer,
  isReply = false,
  onDelete,
}: {
  comment: CommentRow
  viewer: Viewer
  isReply?: boolean
  onDelete: () => void
}) {
  const canDelete = comment.userId === viewer.id || viewer.isAdmin
  return (
    <div
      className={
        isReply
          ? "flex items-start gap-3 rounded-lg border border-border/20 bg-muted/30 p-3"
          : "flex items-start gap-3 rounded-lg border border-border/40 bg-card p-3"
      }
    >
      <Avatar name={comment.userName} size={isReply ? 6 : 8} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {comment.userName ?? "Unknown"}
          </span>
          <span
            className="text-[11px] text-muted-foreground"
            title={formatDateTime(comment.createdAt)}
          >
            {formatDateRelative(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {comment.message}
        </p>
      </div>
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          title="Delete comment"
          className="h-7 px-2 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-3" />
        </Button>
      )}
    </div>
  )
}

function CommentForm({
  pageId,
  parentId,
  viewerName,
  onError,
  onSaved,
}: {
  pageId: string
  parentId: string | null
  viewerName: string
  onError: (e: string | null) => void
  onSaved: () => void
}) {
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const isReply = parentId !== null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) return
    onError(null)
    setPending(true)
    try {
      const result = await addCommentFn({
        data: { pageId, message: trimmed, parentId },
      })
      if ("error" in result) {
        onError(result.error ?? "Could not post comment.")
        return
      }
      setMessage("")
      onSaved()
    } catch {
      onError("Could not post comment.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 gap-2">
      {!isReply && (
        <div className="mt-0.5">
          <Avatar name={viewerName} />
        </div>
      )}
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={isReply ? "Reply..." : "Add a comment..."}
        required
        maxLength={4000}
        className={isReply ? "h-8 flex-1 text-sm" : "h-9 flex-1"}
      />
      <Button
        type="submit"
        variant={isReply ? "ghost" : "outline"}
        size="sm"
        disabled={pending}
        className={isReply ? "h-8 text-xs" : "h-9"}
      >
        {isReply ? "Reply" : "Comment"}
      </Button>
    </form>
  )
}
