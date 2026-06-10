import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react"
import {
  convertIdeaToGiftFn,
  createGiftIdeaFn,
  deleteGiftIdeaFn,
  getGiftIdeasPageFn,
  updateGiftIdeaFn,
  updateGiftIdeaStatusFn,
} from "@/server/hub/fns.gifts"
import type {
  GiftIdeaPriority,
  GiftIdeaRow,
  GiftIdeaStatus,
  GiftRecipientRow,
} from "@/server/hub/gifts"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export const Route = createFileRoute("/_authed/hub/gift-ideas")({
  loader: () => getGiftIdeasPageFn(),
  component: GiftIdeasPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const PRIORITIES: Array<GiftIdeaPriority> = ["LOW", "MEDIUM", "HIGH"]
const IDEA_STATUSES: Array<GiftIdeaStatus> = [
  "ACTIVE",
  "PURCHASED",
  "NOT_INTERESTED",
]

const PRIORITY_BADGE: Record<GiftIdeaPriority, string> = {
  LOW: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  HIGH: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
}

const STATUS_BADGE: Record<GiftIdeaStatus, string> = {
  ACTIVE:
    "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  PURCHASED: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  NOT_INTERESTED:
    "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300",
}

function GiftIdeasPage() {
  const { ideas, members } = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GiftIdeaRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GiftIdeaRow | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [recipientFilter, setRecipientFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const filtered = ideas.filter(
    (i) =>
      (recipientFilter === "all" ||
        (recipientFilter === "general"
          ? i.familyMemberId === null
          : i.familyMemberId === recipientFilter)) &&
      (statusFilter === "all" || i.status === statusFilter)
  )

  function refresh() {
    router.invalidate()
  }

  async function markPurchased(idea: GiftIdeaRow) {
    if (busyId) return
    setActionError(null)
    setBusyId(idea.id)
    try {
      await updateGiftIdeaStatusFn({
        data: { id: idea.id, status: "PURCHASED" },
      })
      refresh()
    } catch {
      setActionError("Could not update the gift idea.")
    } finally {
      setBusyId(null)
    }
  }

  async function convertToGift(idea: GiftIdeaRow) {
    if (busyId) return
    setActionError(null)
    setBusyId(idea.id)
    try {
      const result = await convertIdeaToGiftFn({ data: { id: idea.id } })
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
        return
      }
      refresh()
    } catch {
      setActionError("Could not convert the idea to a gift.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Gift Ideas</h1>
          <p className="text-sm text-muted-foreground">
            Capture ideas as you spot them, then promote the keepers to gifts.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add idea
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by recipient"
          className={`${selectClass} w-44`}
          value={recipientFilter}
          onChange={(e) => setRecipientFilter(e.target.value)}
        >
          <option value="all">All recipients</option>
          <option value="general">General ideas</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          className={`${selectClass} w-44`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {IDEA_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="space-y-3">
        {filtered.map((idea) => (
          <Card
            key={idea.id}
            className={idea.status !== "ACTIVE" ? "opacity-60" : ""}
          >
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{idea.idea}</p>
                  <Badge className={PRIORITY_BADGE[idea.priority]}>
                    {idea.priority}
                  </Badge>
                  <Badge className={STATUS_BADGE[idea.status]}>
                    {idea.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {idea.familyMemberId
                    ? `For ${idea.recipientFirstName} ${idea.recipientLastName}`
                    : "General idea"}
                  {idea.estimatedCost !== null &&
                    ` · ${formatCurrency(idea.estimatedCost)}`}
                  {idea.source && ` · Source: ${idea.source}`}
                </p>
                {idea.url && (
                  <a
                    href={idea.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" /> View link
                  </a>
                )}
                {idea.notes && (
                  <p className="text-xs text-muted-foreground">{idea.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {idea.status === "ACTIVE" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === idea.id}
                      onClick={() => markPurchased(idea)}
                    >
                      Purchased
                    </Button>
                    {idea.familyMemberId && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === idea.id}
                        onClick={() => convertToGift(idea)}
                      >
                        Convert to gift
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit"
                  onClick={() => setEditTarget(idea)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                  onClick={() => setDeleteTarget(idea)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {ideas.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No gift ideas yet. Add one to get started.
        </p>
      )}
      {ideas.length > 0 && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No gift ideas match the current filters.
        </p>
      )}

      {createOpen && (
        <GiftIdeaDialog
          members={members}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}
      {editTarget && (
        <GiftIdeaDialog
          idea={editTarget}
          members={members}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteIdeaDialog
          idea={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function GiftIdeaDialog({
  idea,
  members,
  onClose,
  onSaved,
}: {
  idea?: GiftIdeaRow
  members: Array<GiftRecipientRow>
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const payload = {
      idea: String(f.get("idea") ?? ""),
      familyMemberId: String(f.get("familyMemberId") ?? "") || null,
      source: String(f.get("source") ?? "") || null,
      priority: String(f.get("priority") ?? "MEDIUM") as GiftIdeaPriority,
      estimatedCost: numberOrNull(f.get("estimatedCost")),
      url: String(f.get("url") ?? "") || null,
      notes: String(f.get("notes") ?? "") || null,
    }
    try {
      const result = idea
        ? await updateGiftIdeaFn({ data: { id: idea.id, ...payload } })
        : await createGiftIdeaFn({ data: payload })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError(idea ? "Could not update the idea." : "Could not add the idea.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{idea ? "Edit gift idea" : "Add gift idea"}</DialogTitle>
          <DialogDescription>
            {idea
              ? "Update the details of this idea."
              : "Capture an idea — assign it to someone or keep it general."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="i-idea">Idea *</Label>
              <Input
                id="i-idea"
                name="idea"
                required
                defaultValue={idea?.idea ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-member">Family member (optional)</Label>
              <select
                id="i-member"
                name="familyMemberId"
                className={selectClass}
                defaultValue={idea?.familyMemberId ?? ""}
              >
                <option value="">General idea</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-source">Source</Label>
              <Input
                id="i-source"
                name="source"
                placeholder="Where you saw it"
                defaultValue={idea?.source ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-priority">Priority</Label>
              <select
                id="i-priority"
                name="priority"
                className={selectClass}
                defaultValue={idea?.priority ?? "MEDIUM"}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-cost">Estimated cost</Label>
              <Input
                id="i-cost"
                name="estimatedCost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={idea?.estimatedCost ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-url">URL</Label>
              <Input
                id="i-url"
                name="url"
                type="url"
                placeholder="https://..."
                defaultValue={idea?.url ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-notes">Notes</Label>
            <Textarea
              id="i-notes"
              name="notes"
              rows={2}
              defaultValue={idea?.notes ?? ""}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : idea ? "Save changes" : "Add idea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteIdeaDialog({
  idea,
  onClose,
  onDeleted,
}: {
  idea: GiftIdeaRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteGiftIdeaFn({ data: { id: idea.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete the idea.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this gift idea?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{idea.idea}&rdquo; will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
