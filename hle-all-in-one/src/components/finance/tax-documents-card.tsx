import { useState } from "react"
import {
  Check,
  Download,
  FileText,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import type { TaxDocumentRow, TaxDocumentType } from "@/server/finance/taxes"
import {
  TAX_DOCUMENT_TYPES,
  TAX_DOCUMENT_TYPE_LABELS,
} from "@/server/finance/taxes"
import {
  addTaxDocumentFn,
  deleteTaxDocumentFn,
  removeTaxDocumentFileFn,
  toggleTaxDocumentReceivedFn,
} from "@/server/finance/fns.taxes"
import { TaxFileUpload } from "@/components/finance/tax-file-upload"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function numOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim()
  return s ? Number(s) : null
}

// Documents checklist + add-document form for a tax year (legacy
// taxes/[id]/page.tsx "Tax Documents" + "Add Document" cards).
export function TaxDocumentsCard({
  taxYearId,
  documents,
  onChanged,
}: {
  taxYearId: string
  documents: Array<TaxDocumentRow>
  onChanged: () => void
}) {
  const receivedCount = documents.filter((d) => d.isReceived).length

  async function onToggleReceived(id: string) {
    await toggleTaxDocumentReceivedFn({ data: { id } })
    onChanged()
  }

  async function onDelete(id: string) {
    await deleteTaxDocumentFn({ data: { id } })
    onChanged()
  }

  async function onRemoveFile(documentId: string) {
    await removeTaxDocumentFileFn({ data: { documentId } })
    onChanged()
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Tax Documents ({documents.length})
          </CardTitle>
          <CardDescription>
            {receivedCount} of {documents.length} received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No documents yet. Add one below.
            </p>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div key={doc.id} className="space-y-2 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {TAX_DOCUMENT_TYPE_LABELS[doc.documentType]} —{" "}
                          {doc.issuer}
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          {doc.grossAmount !== null && (
                            <span>
                              Gross: {formatCurrency(doc.grossAmount)}
                            </span>
                          )}
                          {doc.federalWithheld !== null && (
                            <span>
                              Fed: {formatCurrency(doc.federalWithheld)}
                            </span>
                          )}
                          {doc.stateWithheld !== null && (
                            <span>
                              State: {formatCurrency(doc.stateWithheld)}
                            </span>
                          )}
                          {doc.socialSecurityWithheld !== null && (
                            <span>
                              SS: {formatCurrency(doc.socialSecurityWithheld)}
                            </span>
                          )}
                          {doc.medicareWithheld !== null && (
                            <span>
                              Medicare: {formatCurrency(doc.medicareWithheld)}
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <div className="text-xs text-muted-foreground">
                            {doc.description}
                          </div>
                        )}
                        {doc.notes && (
                          <div className="text-xs text-muted-foreground italic">
                            {doc.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant={doc.isReceived ? "default" : "outline"}
                        size="sm"
                        onClick={() => onToggleReceived(doc.id)}
                      >
                        {doc.isReceived ? (
                          <>
                            <Check className="size-3.5" /> Received
                          </>
                        ) : (
                          "Mark Received"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(doc.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="ml-7">
                    {doc.uploadedFileName ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Paperclip className="size-3 text-muted-foreground" />
                        <a
                          href={`/api/finance/tax-docs/download/${doc.id}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Download className="size-3" />
                          {doc.uploadedFileName}
                        </a>
                        {doc.fileSize !== null && (
                          <span className="text-muted-foreground">
                            ({(doc.fileSize / 1024).toFixed(0)} KB)
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveFile(doc.id)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <TaxFileUpload
                        documentId={doc.id}
                        onUploaded={onChanged}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddDocumentCard taxYearId={taxYearId} onAdded={onChanged} />
    </>
  )
}

function AddDocumentCard({
  taxYearId,
  onAdded,
}: {
  taxYearId: string
  onAdded: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await addTaxDocumentFn({
        data: {
          taxYearId,
          documentType: String(f.get("documentType")) as TaxDocumentType,
          issuer: String(f.get("issuer") ?? ""),
          description: String(f.get("description") ?? ""),
          grossAmount: numOrNull(f.get("grossAmount")),
          federalWithheld: numOrNull(f.get("federalWithheld")),
          stateWithheld: numOrNull(f.get("stateWithheld")),
          socialSecurityWithheld: numOrNull(f.get("socialSecurityWithheld")),
          medicareWithheld: numOrNull(f.get("medicareWithheld")),
          expectedDate: String(f.get("expectedDate") ?? "").trim() || null,
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      form.reset()
      onAdded()
    } catch {
      setError("Could not add document.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add Document</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="tax-doc-type">Type</Label>
              <select
                id="tax-doc-type"
                name="documentType"
                defaultValue="W2"
                className={selectClass}
              >
                {TAX_DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TAX_DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax-doc-issuer">Issuer</Label>
              <Input
                id="tax-doc-issuer"
                name="issuer"
                placeholder="Employer or institution"
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="tax-doc-description">Description</Label>
              <Input
                id="tax-doc-description"
                name="description"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="tax-doc-gross">Gross Amount</Label>
              <Input
                id="tax-doc-gross"
                name="grossAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax-doc-fed">Federal Withheld</Label>
              <Input
                id="tax-doc-fed"
                name="federalWithheld"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax-doc-state">State Withheld</Label>
              <Input
                id="tax-doc-state"
                name="stateWithheld"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax-doc-ss">SS Withheld</Label>
              <Input
                id="tax-doc-ss"
                name="socialSecurityWithheld"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax-doc-medicare">Medicare Withheld</Label>
              <Input
                id="tax-doc-medicare"
                name="medicareWithheld"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="tax-doc-expected">Expected Date</Label>
              <Input id="tax-doc-expected" name="expectedDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax-doc-notes">Notes</Label>
              <Input
                id="tax-doc-notes"
                name="notes"
                placeholder="Optional notes"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" /> Add Document
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
