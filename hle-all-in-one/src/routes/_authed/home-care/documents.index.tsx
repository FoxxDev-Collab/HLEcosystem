import { useRef, useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Image,
  Trash2,
  Upload,
} from "lucide-react"
import {
  deleteDocumentFn,
  getDocumentsPageFn,
} from "@/server/home-care/fns.documents"
import type { DocumentRow } from "@/server/home-care/documents"
import { formatDate } from "@/lib/format"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/home-care/documents/")({
  loader: () => getDocumentsPageFn(),
  component: DocumentsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const DOC_TYPES = [
  { value: "MANUAL", label: "Manual" },
  { value: "WARRANTY", label: "Warranty" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PHOTO", label: "Photo" },
  { value: "OTHER", label: "Other" },
]

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    return <Image className="size-4 text-pink-500" />
  if (mimeType === "application/pdf")
    return <FileText className="size-4 text-red-500" />
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="size-4 text-green-500" />
  return <File className="size-4 text-muted-foreground" />
}

function documentTarget(doc: DocumentRow): React.ReactNode {
  if (doc.itemId && doc.itemName) {
    return (
      <Link
        to="/home-care/items/$id"
        params={{ id: doc.itemId }}
        className="underline"
      >
        {doc.itemName}
      </Link>
    )
  }
  if (doc.vehicleId && doc.vehicleMake) {
    return (
      <Link
        to="/home-care/vehicles/$id"
        params={{ id: doc.vehicleId }}
        className="underline"
      >
        {doc.vehicleYear ? `${doc.vehicleYear} ` : ""}
        {doc.vehicleMake} {doc.vehicleModel}
      </Link>
    )
  }
  if (doc.repairTitle) return <span>{doc.repairTitle}</span>
  return "—"
}

function DocumentsPage() {
  const { documents, items, vehicles } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null)

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Manuals, warranties, receipts and photos for your home.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm items={items} vehicles={vehicles} onUploaded={refresh} />
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No documents uploaded yet. Upload manuals, warranties, receipts,
              and more.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Link
                        to="/home-care/documents/$id"
                        params={{ id: doc.id }}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <FileIcon mimeType={doc.mimeType} />
                        <div>
                          <div className="text-sm font-medium">{doc.name}</div>
                          {doc.notes && (
                            <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {doc.notes}
                            </p>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{doc.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {documentTarget(doc)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFileSize(doc.size)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link
                          to="/home-care/documents/$id"
                          params={{ id: doc.id }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="View"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                        </Link>
                        <a href={`/api/documents/download/${doc.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Download"
                          >
                            <Download className="size-3.5" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Delete"
                          onClick={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteDocumentDialog
          document={deleteTarget}
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

function UploadForm({
  items,
  vehicles,
  onUploaded,
}: {
  items: Array<{ id: string; name: string }>
  vehicles: Array<{
    id: string
    year: number | null
    make: string
    model: string
  }>
  onUploaded: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const file = f.get("file")
    if (!(file instanceof globalThis.File) || file.size === 0) return

    setUploading(true)
    setError(null)
    try {
      const uploadData = new FormData()
      uploadData.set("file", file)
      uploadData.set("type", String(f.get("type") ?? "OTHER"))
      uploadData.set("name", String(f.get("name") ?? "") || file.name)
      const notes = String(f.get("notes") ?? "")
      if (notes) uploadData.set("notes", notes)
      const itemId = String(f.get("itemId") ?? "")
      if (itemId) uploadData.set("itemId", itemId)
      const vehicleId = String(f.get("vehicleId") ?? "")
      if (vehicleId) uploadData.set("vehicleId", vehicleId)

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: uploadData,
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(data?.error || "Upload failed")
        return
      }
      form.reset()
      if (fileRef.current) fileRef.current.value = ""
      onUploaded()
    } catch {
      setError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && fileRef.current) {
      const dt = new DataTransfer()
      dt.items.add(file)
      fileRef.current.files = dt.files
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="mb-3 text-sm text-muted-foreground">
          Drag &amp; drop a file, or click to browse
        </p>
        <Input
          ref={fileRef}
          name="file"
          type="file"
          className="mx-auto max-w-xs"
          required
        />
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="u-name">Document Name</Label>
          <Input
            id="u-name"
            name="name"
            placeholder="Optional — uses filename"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="u-type">Type</Label>
          <select
            id="u-type"
            name="type"
            className={selectClass}
            defaultValue="OTHER"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {items.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="u-item">Link to Item</Label>
            <select id="u-item" name="itemId" className={selectClass}>
              <option value="">Optional</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {vehicles.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="u-vehicle">Link to Vehicle</Label>
            <select id="u-vehicle" name="vehicleId" className={selectClass}>
              <option value="">Optional</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year ? `${v.year} ` : ""}
                  {v.make} {v.model}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="u-notes">Notes</Label>
          <Input id="u-notes" name="notes" placeholder="Optional" />
        </div>
        <Button type="submit" disabled={uploading}>
          <Upload className="size-4" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

function DeleteDocumentDialog({
  document,
  onClose,
  onDeleted,
}: {
  document: DocumentRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteDocumentFn({ data: { id: document.id } })
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
          <AlertDialogTitle>Delete “{document.name}”?</AlertDialogTitle>
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
