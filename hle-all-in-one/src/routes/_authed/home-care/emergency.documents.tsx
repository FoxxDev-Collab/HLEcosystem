import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { FileKey, Plus, Trash2 } from "lucide-react"
import {
  createDocumentLocationFn,
  deleteDocumentLocationFn,
  getEmergencyDocumentsFn,
} from "@/server/home-care/fns.emergency"
import type { DocumentLocationRow } from "@/server/home-care/emergency"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export const Route = createFileRoute("/_authed/home-care/emergency/documents")({
  loader: () => getEmergencyDocumentsFn(),
  component: EmergencyDocumentsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const DOCUMENT_CATEGORIES = [
  "Identification",
  "Insurance",
  "Financial",
  "Medical",
  "Legal",
  "Property",
  "Vehicle",
  "Education",
  "Employment",
  "Other",
]

function todayStr(): string {
  const t = new Date()
  const mm = String(t.getMonth() + 1).padStart(2, "0")
  const dd = String(t.getDate()).padStart(2, "0")
  return `${t.getFullYear()}-${mm}-${dd}`
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d + days)
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${dt.getFullYear()}-${mm}-${dd}`
}

function EmergencyDocumentsPage() {
  const documents = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<DocumentLocationRow | null>(
    null
  )

  const today = todayStr()
  const thirtyDaysOut = addDays(today, 30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Important Document Locations</h1>
        <p className="text-sm text-muted-foreground">
          Track where critical documents are stored — physically and digitally.
        </p>
      </div>

      <AddDocumentCard onSaved={() => router.invalidate()} />

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileKey className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No document locations recorded. Track where your important
              documents are stored.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              All Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Physical Location</TableHead>
                  <TableHead>Digital Location</TableHead>
                  <TableHead>Account / Policy #</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const isExpired =
                    doc.expirationDate !== null && doc.expirationDate <= today
                  const isExpiring =
                    doc.expirationDate !== null &&
                    doc.expirationDate <= thirtyDaysOut
                  return (
                    <TableRow
                      key={doc.id}
                      className={
                        isExpired
                          ? "bg-red-50 dark:bg-red-950/20"
                          : isExpiring
                            ? "bg-yellow-50 dark:bg-yellow-950/20"
                            : ""
                      }
                    >
                      <TableCell className="font-medium">
                        {doc.documentName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.category || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.physicalLocation || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.digitalLocation || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.accountNumber && (
                          <div>Acct: {doc.accountNumber}</div>
                        )}
                        {doc.policyNumber && (
                          <div>Policy: {doc.policyNumber}</div>
                        )}
                        {!doc.accountNumber && !doc.policyNumber && "—"}
                      </TableCell>
                      <TableCell>
                        {doc.expirationDate ? (
                          <span
                            className={
                              isExpired
                                ? "font-medium text-red-600"
                                : isExpiring
                                  ? "font-medium text-yellow-600"
                                  : ""
                            }
                          >
                            {formatDate(doc.expirationDate)}
                            {isExpired && (
                              <span className="block text-xs text-red-600">
                                EXPIRED
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {doc.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Delete"
                          onClick={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteDocumentDialog
          doc={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function AddDocumentCard({ onSaved }: { onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createDocumentLocationFn({
        data: {
          documentName: String(f.get("documentName") ?? ""),
          category: String(f.get("category") ?? ""),
          physicalLocation: String(f.get("physicalLocation") ?? ""),
          digitalLocation: String(f.get("digitalLocation") ?? ""),
          accountNumber: String(f.get("accountNumber") ?? ""),
          policyNumber: String(f.get("policyNumber") ?? ""),
          expirationDate: String(f.get("expirationDate") ?? ""),
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      onSaved()
    } catch {
      setError("Could not add document.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Document</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="ed-name">Document Name</Label>
            <Input
              id="ed-name"
              name="documentName"
              placeholder="e.g. Passport, Deed"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-category">Category</Label>
            <select id="ed-category" name="category" className={selectClass}>
              <option value="">Select category</option>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-physical">Physical Location</Label>
            <Input
              id="ed-physical"
              name="physicalLocation"
              placeholder="e.g. Filing cabinet, safe"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-digital">Digital Location</Label>
            <Input
              id="ed-digital"
              name="digitalLocation"
              placeholder="e.g. Google Drive, iCloud"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-account">Account Number</Label>
            <Input
              id="ed-account"
              name="accountNumber"
              placeholder="Account #"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-policy">Policy Number</Label>
            <Input id="ed-policy" name="policyNumber" placeholder="Policy #" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-expiration">Expiration Date</Label>
            <Input id="ed-expiration" name="expirationDate" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-notes">Notes</Label>
            <Input
              id="ed-notes"
              name="notes"
              placeholder="Additional details"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Document"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteDocumentDialog({
  doc,
  onClose,
  onDeleted,
}: {
  doc: DocumentLocationRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteDocumentLocationFn({ data: { id: doc.id } })
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

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{doc.documentName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Only the location record is removed — no files are stored here.
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
