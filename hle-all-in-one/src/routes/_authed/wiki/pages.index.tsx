import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  ChefHat,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderInput,
  LayoutTemplate,
  Lock,
  Phone,
  Pin,
  Plus,
  Share2,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  createPageFn,
  getPagesIndexFn,
  movePageFn,
} from "@/server/wiki/fns.pages"
import type { PageListItem, PageTreeNode } from "@/server/wiki/pages"
import {
  PageRow,
  VisibilityBadge,
  formatDateRelative,
} from "@/components/wiki/wiki-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export const Route = createFileRoute("/_authed/wiki/pages/")({
  loader: () => getPagesIndexFn(),
  component: WikiPagesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const TEMPLATE_CARDS: Array<{
  key: string
  label: string
  defaultTitle: string
  icon: LucideIcon
}> = [
  {
    key: "meeting-notes",
    label: "Meeting Notes",
    defaultTitle: "Meeting Notes",
    icon: ClipboardList,
  },
  {
    key: "how-to",
    label: "How-To Guide",
    defaultTitle: "How-To Guide",
    icon: BookMarked,
  },
  {
    key: "emergency",
    label: "Emergency Procedures",
    defaultTitle: "Emergency Procedures",
    icon: AlertTriangle,
  },
  {
    key: "contacts",
    label: "Contact Sheet",
    defaultTitle: "Contact Sheet",
    icon: Phone,
  },
  { key: "recipe", label: "Recipe", defaultTitle: "New Recipe", icon: ChefHat },
]

function WikiPagesPage() {
  const { pages, tree } = Route.useLoaderData()
  const router = useRouter()
  const [moveTarget, setMoveTarget] = useState<PageListItem | null>(null)

  const pinned = pages.filter((p) => p.pinned)
  const recent = pages.filter((p) => !p.pinned)
  const hasTree =
    tree.household.length > 0 ||
    tree.personal.length > 0 ||
    tree.shared.length > 0

  function rowActions(page: PageListItem) {
    if (!page.canEdit) return undefined
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        title="Move page"
        onClick={() => setMoveTarget(page)}
      >
        <FolderInput className="size-3.5 text-muted-foreground" />
      </Button>
    )
  }

  return (
    <div className="flex max-w-[1200px] gap-8">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h1 className="text-xl font-semibold">Wiki</h1>
          <p className="text-sm text-muted-foreground">
            {pages.length} page{pages.length === 1 ? "" : "s"} in your knowledge
            base
          </p>
        </div>

        <CreatePageCard />

        {pinned.length > 0 && (
          <div className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              <Pin className="size-3" /> Pinned
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pinned.map((p) => (
                <PinnedCard key={p.id} page={p} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Recent Pages
          </h2>
          {pages.length === 0 ? (
            <div className="space-y-2 py-12 text-center">
              <BookOpen className="mx-auto size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No pages yet. Create one above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((p) => (
                <PageRow key={p.id} page={p} actions={rowActions(p)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {hasTree && (
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 space-y-5">
            <TreeSection
              title="Household"
              icon={Users}
              nodes={tree.household}
            />
            <TreeSection title="Personal" icon={Lock} nodes={tree.personal} />
            <TreeSection title="Shared" icon={Share2} nodes={tree.shared} />
          </div>
        </aside>
      )}

      {moveTarget && (
        <MovePageDialog
          page={moveTarget}
          householdTree={tree.household}
          personalTree={tree.personal}
          onClose={() => setMoveTarget(null)}
          onMoved={() => {
            setMoveTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

// ─── Create form + template quick-start ─────────────────

function CreatePageCard() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function create(
    title: string,
    visibility: "PRIVATE" | "HOUSEHOLD" | "PUBLIC",
    template: string | null
  ) {
    setError(null)
    setPending(true)
    try {
      const result = await createPageFn({
        data: { title, visibility, parentId: null, template },
      })
      if ("error" in result) {
        setError(result.error ?? "Could not create page.")
        return
      }
      if ("id" in result && result.id) {
        router.navigate({
          to: "/wiki/pages/$id/edit",
          params: { id: result.id },
        })
      }
    } catch {
      setError("Could not create page.")
    } finally {
      setPending(false)
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get("title") ?? "").trim()
    if (!title) return
    const vis = String(f.get("visibility") ?? "HOUSEHOLD")
    await create(
      title,
      vis === "PRIVATE" ? "PRIVATE" : vis === "PUBLIC" ? "PUBLIC" : "HOUSEHOLD",
      null
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-card p-5">
      <form onSubmit={onSubmit} className="flex items-end gap-4">
        <div className="flex-1 space-y-1.5">
          <Label
            htmlFor="new-page-title"
            className="text-xs font-medium text-muted-foreground"
          >
            New Page
          </Label>
          <Input
            id="new-page-title"
            name="title"
            required
            maxLength={300}
            placeholder="What do you want to write about?"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="new-page-visibility"
            className="text-xs font-medium text-muted-foreground"
          >
            Visibility
          </Label>
          <select
            id="new-page-visibility"
            name="visibility"
            defaultValue="HOUSEHOLD"
            className={`${selectClass} h-10 w-36`}
          >
            <option value="PRIVATE">Private</option>
            <option value="HOUSEHOLD">Household</option>
            <option value="PUBLIC">Public</option>
          </select>
        </div>
        <Button type="submit" disabled={pending} className="h-10">
          <Plus className="mr-1.5 size-4" /> Create
        </Button>
      </form>

      <div className="space-y-2 border-t pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <LayoutTemplate className="size-3" /> Start from a template
        </p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_CARDS.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              disabled={pending}
              onClick={() => create(tpl.defaultTitle, "HOUSEHOLD", tpl.key)}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <tpl.icon className="size-3.5 shrink-0" />
              {tpl.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// ─── Pinned card (legacy PageCard) ──────────────────────

function PinnedCard({ page }: { page: PageListItem }) {
  return (
    <Link to="/wiki/pages/$id" params={{ id: page.id }}>
      <div className="group h-full cursor-pointer space-y-3 rounded-lg border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <p className="truncate text-sm font-medium">{page.title}</p>
          </div>
          <Pin className="size-3 shrink-0 text-amber-500" />
        </div>
        {page.contentText && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {page.contentText.substring(0, 120)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <VisibilityBadge visibility={page.visibility} />
          {page.childCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {page.childCount} sub
            </Badge>
          )}
          {page.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {page.updatedByName ?? "Unknown"} &middot;{" "}
          {formatDateRelative(page.updatedAt)}
        </div>
      </div>
    </Link>
  )
}

// ─── Workspace tree sidebar (3 levels, like the legacy sidebar) ──

function TreeSection({
  title,
  icon: Icon,
  nodes,
}: {
  title: string
  icon: LucideIcon
  nodes: Array<PageTreeNode>
}) {
  if (nodes.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        <Icon className="size-3" /> {title}
      </h3>
      <div className="space-y-0.5">
        {nodes.map((node) => (
          <div key={node.id}>
            <TreeLink id={node.id} title={node.title} depth={0}>
              {node.pinned && (
                <Pin className="size-2.5 shrink-0 text-amber-500" />
              )}
            </TreeLink>
            {node.children.map((child) => (
              <div key={child.id}>
                <TreeLink id={child.id} title={child.title} depth={1} />
                {child.children.map((gc) => (
                  <TreeLink key={gc.id} id={gc.id} title={gc.title} depth={2} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function TreeLink({
  id,
  title,
  depth,
  children,
}: {
  id: string
  title: string
  depth: number
  children?: React.ReactNode
}) {
  return (
    <Link
      to="/wiki/pages/$id"
      params={{ id }}
      className="flex items-center gap-1.5 rounded-sm py-1 pr-1 text-[13px] leading-snug text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
    >
      {depth > 0 && (
        <ChevronRight className="size-2.5 shrink-0 text-muted-foreground/40" />
      )}
      <span className="truncate">{title}</span>
      {children}
    </Link>
  )
}

// ─── Move dialog ────────────────────────────────────────

type MoveOption = { id: string; title: string; depth: number }

// Flatten a workspace tree into target options, skipping the page itself
// (the server re-validates workspace, depth and cycles).
function moveOptions(
  nodes: Array<PageTreeNode>,
  excludeId: string
): Array<MoveOption> {
  const options: Array<MoveOption> = []
  for (const node of nodes) {
    if (node.id === excludeId) continue
    options.push({ id: node.id, title: node.title, depth: 0 })
    for (const child of node.children) {
      if (child.id === excludeId) continue
      options.push({ id: child.id, title: child.title, depth: 1 })
    }
  }
  return options
}

function MovePageDialog({
  page,
  householdTree,
  personalTree,
  onClose,
  onMoved,
}: {
  page: PageListItem
  householdTree: Array<PageTreeNode>
  personalTree: Array<PageTreeNode>
  onClose: () => void
  onMoved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const tree = page.visibility === "PRIVATE" ? personalTree : householdTree
  const options = moveOptions(tree, page.id)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const target = String(f.get("parentId") ?? "")
    try {
      const result = await movePageFn({
        data: { id: page.id, parentId: target === "" ? null : target },
      })
      if ("error" in result) {
        setError(result.error ?? "Could not move page.")
        setPending(false)
        return
      }
      onMoved()
    } catch {
      setError("Could not move page.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &ldquo;{page.title}&rdquo;</DialogTitle>
          <DialogDescription>
            Nest this page under another page in the same workspace, or move it
            to the top level. Pages nest up to 3 levels deep.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="move-parent">New parent</Label>
            <select
              id="move-parent"
              name="parentId"
              defaultValue=""
              className={selectClass}
            >
              <option value="">Top level (no parent)</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.depth > 0 ? `— ${o.title}` : o.title}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
