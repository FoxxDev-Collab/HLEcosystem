import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { AlertTriangle, FileText, Pencil, Plus, Trash2 } from "lucide-react"
import {
  createTravelDocumentFn,
  deleteTravelDocumentFn,
  getTravelDocumentsPageFn,
  updateTravelDocumentFn,
} from "@/server/travel/fns.documents"
import { TRAVEL_DOCUMENT_TYPES } from "@/lib/travel-constants"
import type {
  TravelDocumentRow,
  TravelDocumentType,
} from "@/server/travel/documents"
import { formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/travel/documents")({
  loader: () => getTravelDocumentsPageFn(),
  component: DocumentsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type TripOption = { id: string; name: string }
type MemberOption = { membershipId: string; displayName: string }

function typeLabel(type: string): string {
  return type.replace(/_/g, " ")
}

// Days from today to a DATE string ("YYYY-MM-DD"), parsed as local time.
function daysUntil(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

// Legacy expiry tiers: expired → destructive; ≤30d → destructive with icon;
// ≤90d → yellow; otherwise outline.
function expiryBadge(expiryDate: string | null) {
  if (!expiryDate) return null
  const days = daysUntil(expiryDate)
  if (days < 0) return <Badge variant="destructive">Expired</Badge>
  if (days <= 30) {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="size-3" /> {days}d left
      </Badge>
    )
  }
  if (days <= 90) {
    return (
      <Badge
        variant="secondary"
        className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      >
        {days}d left
      </Badge>
    )
  }
  return <Badge variant="outline">{days}d left</Badge>
}

function DocumentsPage() {
  const { documents, trips, members } = Route.useLoaderData()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TravelDocumentRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TravelDocumentRow | null>(
    null
  )

  function refresh() {
    router.invalidate()
  }

  // Group by type (rows arrive ordered by type, then expiryDate).
  const grouped = documents.reduce<Record<string, Array<TravelDocumentRow>>>(
    (acc, doc) => {
      const bucket = acc[doc.type] ?? []
      bucket.push(doc)
      acc[doc.type] = bucket
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Travel Documents</h1>
          <p className="text-sm text-muted-foreground">
            Passports, visas, and other documents with expiry tracking.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 size-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-medium">No travel documents</h3>
            <p className="text-sm text-muted-foreground">
              Add passports, visas, and other travel documents to keep track of
              them.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, docs]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                {typeLabel(type)}
                <Badge variant="secondary">{docs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {doc.displayName ||
                            doc.documentNumber ||
                            typeLabel(type)}
                        </span>
                        {expiryBadge(doc.expiryDate)}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {doc.documentNumber && (
                          <span>No: {doc.documentNumber}</span>
                        )}
                        {doc.issuingCountry && (
                          <span>Country: {doc.issuingCountry}</span>
                        )}
                        {doc.issueDate && (
                          <span>Issued: {formatDate(doc.issueDate)}</span>
                        )}
                        {doc.expiryDate && (
                          <span>Expires: {formatDate(doc.expiryDate)}</span>
                        )}
                        {doc.ownerName && <span>Owner: {doc.ownerName}</span>}
                        {doc.tripName && <span>Trip: {doc.tripName}</span>}
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-muted-foreground">
                          {doc.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => setEditTarget(doc)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(doc)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {addOpen && (
        <DocumentDialog
          trips={trips}
          members={members}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            refresh()
          }}
        />
      )}
      {editTarget && (
        <DocumentDialog
          doc={editTarget}
          trips={trips}
          members={members}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteDocumentDialog
          doc={deleteTarget}
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

function DocumentDialog({
  doc,
  trips,
  members,
  onClose,
  onSaved,
}: {
  doc?: TravelDocumentRow
  trips: Array<TripOption>
  members: Array<MemberOption>
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
    const data = {
      type: String(f.get("type") ?? "OTHER") as TravelDocumentType,
      householdMemberId: String(f.get("householdMemberId") ?? "") || null,
      tripId: String(f.get("tripId") ?? "") || null,
      displayName: String(f.get("displayName") ?? ""),
      documentNumber: String(f.get("documentNumber") ?? ""),
      issuingCountry: String(f.get("issuingCountry") ?? ""),
      issueDate: String(f.get("issueDate") ?? ""),
      expiryDate: String(f.get("expiryDate") ?? ""),
      notes: String(f.get("notes") ?? ""),
    }
    try {
      const result = doc
        ? await updateTravelDocumentFn({ data: { ...data, id: doc.id } })
        : await createTravelDocumentFn({ data })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError(doc ? "Could not update document." : "Could not add document.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {doc ? "Edit Travel Document" : "Add Travel Document"}
          </DialogTitle>
          <DialogDescription>
            Document details are metadata only — no files are attached.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-type">Document Type *</Label>
            <select
              id="doc-type"
              name="type"
              className={selectClass}
              defaultValue={doc?.type ?? "PASSPORT"}
              required
            >
              {TRAVEL_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-owner">Owner</Label>
            <select
              id="doc-owner"
              name="householdMemberId"
              className={selectClass}
              defaultValue={doc?.householdMemberId ?? ""}
            >
              <option value="">None (optional)</option>
              {members.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-display">Display Name</Label>
            <Input
              id="doc-display"
              name="displayName"
              placeholder="Name shown on document"
              defaultValue={doc?.displayName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-number">Document Number</Label>
            <Input
              id="doc-number"
              name="documentNumber"
              defaultValue={doc?.documentNumber ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-country">Issuing Country</Label>
            <Input
              id="doc-country"
              name="issuingCountry"
              defaultValue={doc?.issuingCountry ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc-issue">Issue Date</Label>
              <Input
                id="doc-issue"
                name="issueDate"
                type="date"
                defaultValue={toDateInputValue(doc?.issueDate)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-expiry">Expiry Date</Label>
              <Input
                id="doc-expiry"
                name="expiryDate"
                type="date"
                defaultValue={toDateInputValue(doc?.expiryDate)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-trip">Link to Trip</Label>
            <select
              id="doc-trip"
              name="tripId"
              className={selectClass}
              defaultValue={doc?.tripId ?? ""}
            >
              <option value="">None (general document)</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-notes">Notes</Label>
            <Textarea
              id="doc-notes"
              name="notes"
              rows={2}
              defaultValue={doc?.notes ?? ""}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? doc
                  ? "Saving…"
                  : "Adding…"
                : doc
                  ? "Save Changes"
                  : "Add Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDocumentDialog({
  doc,
  onClose,
  onDeleted,
}: {
  doc: TravelDocumentRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteTravelDocumentFn({ data: { id: doc.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete document.")
      setPending(false)
    }
  }

  const name = doc.displayName || doc.documentNumber || typeLabel(doc.type)

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the document record permanently.
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
