import { useMemo, useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  createGiftFn,
  deleteGiftFn,
  getGiftsPageFn,
  updateGiftFn,
  updateGiftStatusFn,
} from "@/server/hub/fns.gifts"
import type { GiftRecipientRow, GiftRow, GiftStatus } from "@/server/hub/gifts"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
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

export const Route = createFileRoute("/_authed/hub/gifts")({
  loader: () => getGiftsPageFn(),
  component: GiftsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const GIFT_STATUSES: Array<GiftStatus> = [
  "IDEA",
  "PURCHASED",
  "WRAPPED",
  "GIVEN",
]

const STATUS_BADGE: Record<GiftStatus, string> = {
  IDEA: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300",
  PURCHASED: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  WRAPPED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
  GIVEN: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
}

// Status pipeline: IDEA → PURCHASED → WRAPPED → GIVEN
const NEXT_STATUS: Partial<Record<GiftStatus, GiftStatus>> = {
  IDEA: "PURCHASED",
  PURCHASED: "WRAPPED",
  WRAPPED: "GIVEN",
}

const NEXT_STATUS_LABEL: Partial<Record<GiftStatus, string>> = {
  IDEA: "Mark purchased",
  PURCHASED: "Mark wrapped",
  WRAPPED: "Mark given",
}

function renderRating(rating: number | null): string {
  if (!rating) return ""
  return Array.from({ length: 5 }, (_, i) => (i < rating ? "★" : "☆")).join("")
}

function giftCost(g: GiftRow): number {
  return g.actualCost ?? g.estimatedCost ?? 0
}

function GiftsPage() {
  const { gifts, members } = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GiftRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GiftRow | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [recipientFilter, setRecipientFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [occasionFilter, setOccasionFilter] = useState("all")

  const occasions = useMemo(() => {
    const set = new Set<string>()
    for (const g of gifts) {
      if (g.occasion) set.add(g.occasion)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [gifts])

  const filtered = gifts.filter(
    (g) =>
      (recipientFilter === "all" || g.familyMemberId === recipientFilter) &&
      (statusFilter === "all" || g.status === statusFilter) &&
      (occasionFilter === "all" || g.occasion === occasionFilter)
  )

  const totalCost = filtered.reduce((sum, g) => sum + giftCost(g), 0)

  function refresh() {
    router.invalidate()
  }

  async function advanceStatus(gift: GiftRow) {
    const next = NEXT_STATUS[gift.status]
    if (!next || advancingId) return
    setAdvancingId(gift.id)
    try {
      await updateGiftStatusFn({ data: { id: gift.id, status: next } })
      refresh()
    } finally {
      setAdvancingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Gift History</h1>
          <p className="text-sm text-muted-foreground">
            Track gifts from idea to given, with costs and ratings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            Total: {formatCurrency(totalCost)}
          </Badge>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Add gift
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by recipient"
          className={`${selectClass} w-44`}
          value={recipientFilter}
          onChange={(e) => setRecipientFilter(e.target.value)}
        >
          <option value="all">All recipients</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          className={`${selectClass} w-40`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {GIFT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by occasion"
          className={`${selectClass} w-44`}
          value={occasionFilter}
          onChange={(e) => setOccasionFilter(e.target.value)}
        >
          <option value="all">All occasions</option>
          {occasions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((gift) => (
          <Card key={gift.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{gift.description}</p>
                  <Badge className={STATUS_BADGE[gift.status]}>
                    {gift.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  For {gift.recipientFirstName} {gift.recipientLastName}
                  {gift.occasion && ` · ${gift.occasion}`}
                  {gift.giftDate && ` · ${formatDate(gift.giftDate)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gift.actualCost !== null
                    ? formatCurrency(gift.actualCost)
                    : gift.estimatedCost !== null
                      ? `~${formatCurrency(gift.estimatedCost)}`
                      : ""}
                  {gift.rating ? ` ${renderRating(gift.rating)}` : ""}
                  {gift.notes ? ` · ${gift.notes}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {gift.status !== "GIVEN" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={advancingId === gift.id}
                    onClick={() => advanceStatus(gift)}
                  >
                    {NEXT_STATUS_LABEL[gift.status]}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit"
                  onClick={() => setEditTarget(gift)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                  onClick={() => setDeleteTarget(gift)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {gifts.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No gifts recorded yet. Add one to get started.
        </p>
      )}
      {gifts.length > 0 && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No gifts match the current filters.
        </p>
      )}

      {createOpen && (
        <GiftDialog
          members={members}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}
      {editTarget && (
        <GiftDialog
          gift={editTarget}
          members={members}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteGiftDialog
          gift={deleteTarget}
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

function GiftDialog({
  gift,
  members,
  onClose,
  onSaved,
}: {
  gift?: GiftRow
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
    const rating = numberOrNull(f.get("rating"))
    const payload = {
      familyMemberId: String(f.get("familyMemberId") ?? ""),
      description: String(f.get("description") ?? ""),
      giftDate: String(f.get("giftDate") ?? "") || null,
      occasion: String(f.get("occasion") ?? "") || null,
      status: String(f.get("status") ?? "IDEA") as GiftStatus,
      estimatedCost: numberOrNull(f.get("estimatedCost")),
      actualCost: numberOrNull(f.get("actualCost")),
      rating: rating === null ? null : Math.round(rating),
      notes: String(f.get("notes") ?? "") || null,
    }
    try {
      const result = gift
        ? await updateGiftFn({ data: { id: gift.id, ...payload } })
        : await createGiftFn({ data: payload })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError(gift ? "Could not update gift." : "Could not add gift.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{gift ? "Edit gift" : "Add gift"}</DialogTitle>
          <DialogDescription>
            {gift
              ? "Update the details of this gift."
              : "Record a gift for a family member."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="g-member">Family member *</Label>
              <select
                id="g-member"
                name="familyMemberId"
                required
                className={selectClass}
                defaultValue={gift?.familyMemberId ?? ""}
              >
                <option value="">Select…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-description">Description *</Label>
              <Input
                id="g-description"
                name="description"
                required
                defaultValue={gift?.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-occasion">Occasion</Label>
              <Input
                id="g-occasion"
                name="occasion"
                placeholder="e.g. Birthday, Christmas"
                defaultValue={gift?.occasion ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-date">Gift date</Label>
              <Input
                id="g-date"
                name="giftDate"
                type="date"
                defaultValue={toDateInputValue(gift?.giftDate)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-estimated">Estimated cost</Label>
              <Input
                id="g-estimated"
                name="estimatedCost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={gift?.estimatedCost ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-actual">Actual cost</Label>
              <Input
                id="g-actual"
                name="actualCost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={gift?.actualCost ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-status">Status</Label>
              <select
                id="g-status"
                name="status"
                className={selectClass}
                defaultValue={gift?.status ?? "IDEA"}
              >
                {GIFT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-rating">Rating (1–5)</Label>
              <Input
                id="g-rating"
                name="rating"
                type="number"
                min="1"
                max="5"
                defaultValue={gift?.rating ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-notes">Notes</Label>
            <Textarea
              id="g-notes"
              name="notes"
              rows={2}
              defaultValue={gift?.notes ?? ""}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : gift ? "Save changes" : "Add gift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteGiftDialog({
  gift,
  onClose,
  onDeleted,
}: {
  gift: GiftRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteGiftFn({ data: { id: gift.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete gift.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this gift?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{gift.description}&rdquo; for {gift.recipientFirstName}{" "}
            {gift.recipientLastName} will be permanently removed.
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
