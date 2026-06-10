import { useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { Upload } from "lucide-react"
import { getImportPageFn, uploadImportFn } from "@/server/finance/fns.import"
import { formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
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

export const Route = createFileRoute("/_authed/finance/import/")({
  loader: () => getImportPageFn(),
  component: ImportPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

// Matches the server-side zod cap (5 MB of statement text).
const MAX_FILE_SIZE = 5 * 1024 * 1024

const FORMATS = [
  { value: "WELLS_FARGO", label: "Wells Fargo CSV" },
  { value: "GENERIC", label: "Generic CSV" },
  { value: "OFX", label: "OFX / QFX" },
]

function ImportPage() {
  const { accounts, batches } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const f = new FormData(e.currentTarget)
    const file = f.get("file")
    const accountId = String(f.get("accountId") ?? "")
    const format = String(f.get("format") ?? "WELLS_FARGO")

    if (!accountId) {
      setError("Please choose an account.")
      return
    }
    if (!(file instanceof File) || file.size === 0) {
      setError("Please choose a file to import.")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (max 5 MB).")
      return
    }

    setPending(true)
    try {
      const content = await file.text()
      const result = await uploadImportFn({
        data: {
          accountId,
          fileName: file.name,
          format: format as "WELLS_FARGO" | "GENERIC" | "OFX",
          content,
        },
      })
      if ("error" in result) {
        setError(result.error)
        setPending(false)
        return
      }
      router.invalidate()
      navigate({ to: "/finance/import/$id", params: { id: result.batchId } })
    } catch {
      setError("Upload failed.")
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Import bank statements and review them before they hit your ledger.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Statement</CardTitle>
          <CardDescription>
            Supports Wells Fargo CSV, generic CSV, and OFX/QFX formats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create an account first.{" "}
              <Link to="/finance/accounts" className="underline">
                Go to accounts
              </Link>
            </p>
          ) : (
            <form onSubmit={onUpload} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="import-account">Account</Label>
                  <select
                    id="import-account"
                    name="accountId"
                    className={selectClass}
                    defaultValue={accounts[0]?.id}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-format">Format</Label>
                  <select
                    id="import-format"
                    name="format"
                    className={selectClass}
                    defaultValue="WELLS_FARGO"
                  >
                    {FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-file">File</Label>
                  <Input
                    id="import-file"
                    name="file"
                    type="file"
                    accept=".csv,.ofx,.qfx"
                    required
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={pending}>
                <Upload className="size-4" />
                {pending ? "Uploading…" : "Upload & Parse"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {batches.map((batch) => (
                <Link
                  key={batch.id}
                  to="/finance/import/$id"
                  params={{ id: batch.id }}
                  className="flex items-center justify-between rounded px-2 py-3 transition-colors hover:bg-accent/50"
                >
                  <div>
                    <div className="text-sm font-medium">{batch.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {batch.accountName} · {formatDateTime(batch.importedAt)} ·{" "}
                      {batch.totalRows} rows
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={batch.isFinalized ? "default" : "secondary"}
                    >
                      {batch.isFinalized
                        ? `${batch.importedCount} imported`
                        : "Pending review"}
                    </Badge>
                    {batch.duplicateCount > 0 && (
                      <Badge variant="outline">
                        {batch.duplicateCount} duplicates
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
