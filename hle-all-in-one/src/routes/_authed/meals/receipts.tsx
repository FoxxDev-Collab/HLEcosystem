import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Camera, Check, Loader2, Package, RotateCcw } from "lucide-react"
import {
  getReceiptsPageFn,
  processReceiptFn,
  scanReceiptFn,
} from "@/server/meals/fns.receipts"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/meals/receipts")({
  loader: () => getReceiptsPageFn(),
  component: ReceiptsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

type ReceiptData = {
  store: string
  date: string
  items: Array<{ name: string; price: number; category: string }>
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(",") + 1))
    }
    reader.onerror = () => reject(new Error("Could not read the file"))
    reader.readAsDataURL(file)
  })
}

function ReceiptsPage() {
  const { stores, aiConfigured, financeAccounts, financeCategories } =
    Route.useLoaderData()
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<ReceiptData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [success, setSuccess] = useState<number | null>(null)
  const [storeId, setStoreId] = useState("")
  const [financeWarning, setFinanceWarning] = useState<string | null>(null)
  const [addToFinance, setAddToFinance] = useState(false)
  const [financeAccountId, setFinanceAccountId] = useState("")
  const [financeCategoryId, setFinanceCategoryId] = useState("")

  // Auto-match the parsed store name against configured stores.
  function autoMatchStore(parsed: ReceiptData) {
    const match = stores.find(
      (s) =>
        s.name.toLowerCase().includes(parsed.store.toLowerCase()) ||
        parsed.store.toLowerCase().includes(s.name.toLowerCase())
    )
    setStoreId(match?.id ?? stores[0]?.id ?? "")
  }

  async function onScan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setSuccess(null)
    if (!file) {
      setError("Choose a receipt image first.")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (max 25 MB)")
      return
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Unsupported file type. Use JPEG, PNG, WebP, or GIF.")
      return
    }
    setScanning(true)
    try {
      const image = await fileToBase64(file)
      const res = await scanReceiptFn({
        data: { image, mimeType: file.type },
      })
      if ("error" in res && typeof res.error === "string") {
        setError(res.error)
      } else if ("data" in res && res.data) {
        setResult(res.data)
        autoMatchStore(res.data)
      }
    } catch {
      setError("Scan failed.")
    }
    setScanning(false)
  }

  async function onProcess() {
    if (!result || !storeId) return
    setError(null)
    setFinanceWarning(null)
    setProcessing(true)
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(result.date)
        ? result.date
        : new Date().toISOString().split("T")[0]
      const res = await processReceiptFn({
        data: {
          storeId,
          date,
          items: result.items,
          finance:
            addToFinance && financeAccountId && result.total > 0
              ? {
                  accountId: financeAccountId,
                  categoryId: financeCategoryId || null,
                  total: result.total,
                }
              : null,
        },
      })
      if ("error" in res && typeof res.error === "string") {
        setError(res.error)
      } else if ("recorded" in res) {
        if ("financeWarning" in res && res.financeWarning) {
          setFinanceWarning(res.financeWarning)
        }
        setSuccess(res.recorded)
        router.invalidate()
      }
    } catch {
      setError("Processing failed.")
    }
    setProcessing(false)
  }

  function onReset() {
    setResult(null)
    setError(null)
    setSuccess(null)
    setFinanceWarning(null)
    setAddToFinance(false)
    setFile(null)
    if (preview) {
      URL.revokeObjectURL(preview)
      setPreview(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Receipt Scanner</h1>
        <p className="text-sm text-muted-foreground">
          Scan grocery receipts to track prices across your stores.
        </p>
      </div>

      {success !== null ? (
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Receipt Processed</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {success} price{success !== 1 ? "s" : ""} recorded
              </p>
              {financeWarning && (
                <p className="mt-2 text-sm text-orange-600">{financeWarning}</p>
              )}
            </div>
            <Button variant="outline" onClick={onReset}>
              <Camera className="size-4" />
              Scan Another Receipt
            </Button>
          </CardContent>
        </Card>
      ) : !result ? (
        <Card>
          <CardHeader>
            <CardTitle>Scan Grocery Receipt</CardTitle>
            <CardDescription>
              Upload a receipt photo — items and prices are extracted
              automatically and saved as price observations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!aiConfigured && (
              <div className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                AI features not configured — receipt scanning needs the internal
                AI gateway (CLAUDE_API_URL / CLAUDE_API_SERVICE_SECRET).
              </div>
            )}
            <form onSubmit={onScan} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt">Receipt Image</Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  capture="environment"
                  disabled={scanning || !aiConfigured}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setFile(f)
                    if (preview) URL.revokeObjectURL(preview)
                    setPreview(f ? URL.createObjectURL(f) : null)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, or GIF. Max 25 MB.
                </p>
              </div>
              <Button
                type="submit"
                disabled={scanning || !aiConfigured || !file}
              >
                {scanning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Scanning…
                  </>
                ) : (
                  <>
                    <Camera className="size-4" />
                    Scan Receipt
                  </>
                )}
              </Button>
            </form>

            {scanning && preview && (
              <div className="mt-4 flex items-start gap-4">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="w-32 rounded-lg border object-cover"
                />
                <div className="pt-2 text-sm text-muted-foreground">
                  Analyzing receipt with Claude…
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{result.store}</CardTitle>
                  <CardDescription>{result.date}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={onReset}>
                  <RotateCcw className="size-4" />
                  Scan Another
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                {preview && (
                  <img
                    src={preview}
                    alt="Receipt"
                    className="hidden w-28 shrink-0 rounded-lg border object-cover sm:block"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 space-y-1 border-t pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">
                        {formatCurrency(result.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="tabular-nums">
                        {formatCurrency(result.tax)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-base font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatCurrency(result.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Save Receipt Data</CardTitle>
              <CardDescription>
                Each line becomes a price observation for the selected store.
                New products are created automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="max-w-xs space-y-2">
                <Label className="flex items-center gap-2">
                  <Package className="size-4" />
                  Store
                </Label>
                {stores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No stores configured. Add a store in the Stores page first.
                  </p>
                ) : (
                  <select
                    className={selectClass}
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {financeAccounts.length > 0 && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={addToFinance}
                      onChange={(e) => {
                        setAddToFinance(e.target.checked)
                        if (e.target.checked && !financeAccountId) {
                          setFinanceAccountId(financeAccounts[0]?.id ?? "")
                        }
                      }}
                    />
                    Also add expense to Family Finance (
                    {formatCurrency(result.total)})
                  </label>
                  {addToFinance && (
                    <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Finance Account</Label>
                        <select
                          className={selectClass}
                          value={financeAccountId}
                          onChange={(e) => setFinanceAccountId(e.target.value)}
                        >
                          {financeAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Finance Category</Label>
                        <select
                          className={selectClass}
                          value={financeCategoryId}
                          onChange={(e) => setFinanceCategoryId(e.target.value)}
                        >
                          <option value="">No category</option>
                          {financeCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                onClick={onProcess}
                disabled={processing || stores.length === 0 || !storeId}
              >
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Save Prices — {formatCurrency(result.total)}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
