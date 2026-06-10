import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  Download,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  Image,
  Trash2,
} from "lucide-react"
import {
  deleteDocumentFn,
  getDocumentDetailFn,
  updateDocumentFn,
} from "@/server/home-care/fns.documents"
import type { DocumentRow, DocumentType } from "@/server/home-care/documents"
import { formatDate } from "@/lib/format"
import { formatFileSize } from "./documents.index"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/home-care/documents/$id")({
  loader: ({ params }) => getDocumentDetailFn({ data: { id: params.id } }),
  component: DocumentDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const DOC_TYPES: Array<DocumentType> = [
  "MANUAL",
  "WARRANTY",
  "RECEIPT",
  "INVOICE",
  "PHOTO",
  "OTHER",
]

function LargeFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    return <Image className="size-12 text-pink-400" />
  if (mimeType === "application/pdf")
    return <FileText className="size-12 text-red-400" />
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="size-12 text-green-400" />
  return <File className="size-12 text-muted-foreground" />
}

function canPreviewInline(
  mimeType: string
): "image" | "pdf" | "text" | "video" | "audio" | null {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType === "application/pdf") return "pdf"
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  )
    return "text"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  return null
}

function DocumentDetailPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Document not found</h1>
        <Link to="/home-care/documents">
          <Button variant="outline">
            <ArrowLeft className="size-4" /> Back to documents
          </Button>
        </Link>
      </div>
    )
  }

  const { document: doc, items, vehicles, repairs } = data
  const previewType = canPreviewInline(doc.mimeType)
  const serveUrl = `/api/documents/serve/${doc.id}`
  const downloadUrl = `/api/documents/download/${doc.id}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/home-care/documents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{doc.name}</h1>
            <Badge variant="secondary">{doc.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {doc.originalName} · {formatFileSize(doc.size)} · Uploaded{" "}
            {formatDate(doc.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a href={serveUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="size-3.5" />
              Open
            </Button>
          </a>
          <a href={downloadUrl}>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" />
              Download
            </Button>
          </a>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-hidden rounded-lg p-0">
          {previewType === "image" && (
            <div className="flex items-center justify-center bg-muted/30 p-4">
              <img
                src={serveUrl}
                alt={doc.name}
                className="max-h-[70vh] max-w-full rounded object-contain"
              />
            </div>
          )}
          {previewType === "pdf" && (
            <div className="bg-muted/30">
              <iframe
                src={serveUrl}
                title={doc.name}
                className="w-full border-0"
                style={{ height: "80vh" }}
              />
            </div>
          )}
          {previewType === "video" && (
            <div className="flex items-center justify-center bg-black p-4">
              <video
                src={serveUrl}
                controls
                className="max-h-[70vh] max-w-full rounded"
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}
          {previewType === "audio" && (
            <div className="flex flex-col items-center justify-center gap-4 bg-muted/30 p-8">
              <LargeFileIcon mimeType={doc.mimeType} />
              <audio src={serveUrl} controls className="w-full max-w-md">
                Your browser does not support audio playback.
              </audio>
            </div>
          )}
          {previewType === "text" && (
            <div className="bg-muted/30">
              <iframe
                src={serveUrl}
                title={doc.name}
                className="w-full border-0 font-mono text-sm"
                style={{ height: "60vh" }}
              />
            </div>
          )}
          {!previewType && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
              <LargeFileIcon mimeType={doc.mimeType} />
              <div className="text-center">
                <p className="text-sm font-medium">Preview not available</p>
                <p className="mt-1 text-xs">{doc.mimeType}</p>
              </div>
              <a href={downloadUrl}>
                <Button variant="outline" size="sm">
                  <Download className="size-3.5" />
                  Download to view
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {(doc.itemName || doc.vehicleMake || doc.repairTitle) && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Linked to:</span>
              {doc.itemId && doc.itemName && (
                <Link
                  to="/home-care/items/$id"
                  params={{ id: doc.itemId }}
                  className="font-medium hover:underline"
                >
                  {doc.itemName}
                </Link>
              )}
              {doc.vehicleId && doc.vehicleMake && (
                <Link
                  to="/home-care/vehicles/$id"
                  params={{ id: doc.vehicleId }}
                  className="font-medium hover:underline"
                >
                  {doc.vehicleYear ? `${doc.vehicleYear} ` : ""}
                  {doc.vehicleMake} {doc.vehicleModel}
                </Link>
              )}
              {doc.repairTitle && (
                <span className="font-medium">{doc.repairTitle}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <EditDocumentCard
        doc={doc}
        items={items}
        vehicles={vehicles}
        repairs={repairs}
        onSaved={() => router.invalidate()}
        onDelete={() => setDeleteOpen(true)}
      />

      {deleteOpen && (
        <DeleteDocumentDialog
          doc={doc}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => router.navigate({ to: "/home-care/documents" })}
        />
      )}
    </div>
  )
}

function EditDocumentCard({
  doc,
  items,
  vehicles,
  repairs,
  onSaved,
  onDelete,
}: {
  doc: DocumentRow
  items: Array<{ id: string; name: string }>
  vehicles: Array<{
    id: string
    year: number | null
    make: string
    model: string
  }>
  repairs: Array<{ id: string; title: string }>
  onSaved: () => void
  onDelete: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await updateDocumentFn({
        data: {
          id: doc.id,
          name: String(f.get("name") ?? ""),
          type: String(f.get("type") ?? "OTHER") as DocumentType,
          notes: String(f.get("notes") ?? ""),
          itemId: String(f.get("itemId") ?? ""),
          vehicleId: String(f.get("vehicleId") ?? ""),
          repairId: String(f.get("repairId") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      onSaved()
    } catch {
      setError("Could not save document details.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-1">
            <Label htmlFor="d-name">Name</Label>
            <Input id="d-name" name="name" defaultValue={doc.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-type">Type</Label>
            <select
              id="d-type"
              name="type"
              className={selectClass}
              defaultValue={doc.type}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-item">Link to Item</Label>
            <select
              id="d-item"
              name="itemId"
              className={selectClass}
              defaultValue={doc.itemId ?? ""}
            >
              <option value="">None</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-vehicle">Link to Vehicle</Label>
            <select
              id="d-vehicle"
              name="vehicleId"
              className={selectClass}
              defaultValue={doc.vehicleId ?? ""}
            >
              <option value="">None</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year ? `${v.year} ` : ""}
                  {v.make} {v.model}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-repair">Link to Repair</Label>
            <select
              id="d-repair"
              name="repairId"
              className={selectClass}
              defaultValue={doc.repairId ?? ""}
            >
              <option value="">None</option>
              {repairs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-notes">Notes</Label>
            <Input
              id="d-notes"
              name="notes"
              defaultValue={doc.notes ?? ""}
              placeholder="Optional notes"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save Changes"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
              {error}
            </p>
          )}
        </form>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>Original: {doc.originalName}</p>
            <p>MIME: {doc.mimeType}</p>
            <p>Hash: {doc.contentHash.substring(0, 16)}…</p>
          </div>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete Document
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DeleteDocumentDialog({
  doc,
  onClose,
  onDeleted,
}: {
  doc: DocumentRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteDocumentFn({ data: { id: doc.id } })
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
          <AlertDialogTitle>Delete “{doc.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The document is removed. The file is deleted from storage when no
            other document references it.
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
