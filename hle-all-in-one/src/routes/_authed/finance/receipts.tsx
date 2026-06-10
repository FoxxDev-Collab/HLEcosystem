import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { Camera, Check, Loader2, RotateCcw, Sparkles } from "lucide-react"
import {
  createTransactionFromReceiptFn,
  getReceiptsPageFn,
  scanReceiptFn,
  suggestReceiptCategoryFn,
} from "@/server/finance/fns.receipts"
import type { CategorizeResult, ReceiptData } from "@/server/finance/claude-api"
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

export const Route = createFileRoute("/_authed/finance/receipts")({
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

function confidenceColor(c: number): string {
  if (c >= 0.85) return "text-green-600 dark:text-green-400"
  if (c >= 0.6) return "text-yellow-600 dark:text-yellow-400"
  return "text-muted-foreground"
}

function ReceiptsPage() {
  const { accounts, categories, aiConfigured } = Route.useLoaderData()
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [result, setResult] = useState<ReceiptData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [created, setCreated] = useState(false)
  const [accountId, setAccountId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [suggestion, setSuggestion] = useState<CategorizeResult | null>(null)

  // Auto-suggest a category for the scanned receipt (legacy behavior). The
  // candidate names live server-side — only store + item summary go up.
  async function fetchSuggestion(parsed: ReceiptData) {
    if (categories.length === 0) return
    setSuggesting(true)
    try {
      const res = await suggestReceiptCategoryFn({
        data: {
          store: parsed.store,
          itemSummary: parsed.items
            .map((i) => i.name)
            .join(", ")
            .slice(0, 2000),
        },
      })
      if ("suggestion" in res && res.suggestion) {
        const suggested = res.suggestion
        setSuggestion(suggested)
        const match = categories.find(
          (c) => c.name.toLowerCase() === suggested.category.toLowerCase()
        )
        if (match) setCategoryId(match.id)
      }
    } catch {
      // Suggestion is best-effort — ignore failures.
    }
    setSuggesting(false)
  }

  async function onScan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setSuggestion(null)
    setCategoryId("")
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
      const res = await scanReceiptFn({ data: { image, mimeType: file.type } })
      if ("error" in res && typeof res.error === "string") {
        setError(res.error)
      } else if ("data" in res && res.data) {
        setResult(res.data)
        setAccountId(accounts[0]?.id ?? "")
        fetchSuggestion(res.data)
      }
    } catch {
      setError("Scan failed.")
    }
    setScanning(false)
  }

  async function onCreate() {
    if (!result || !accountId) return
    setError(null)
    setCreating(true)
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(result.date)
        ? result.date
        : new Date().toISOString().split("T")[0]
      const res = await createTransactionFromReceiptFn({
        data: {
          accountId,
          categoryId: categoryId || null,
          store: result.store || "Receipt",
          date,
          total: Math.abs(result.total) || 0.01,
          items: result.items,
        },
      })
      if ("error" in res && typeof res.error === "string") {
        setError(res.error)
      } else {
        setCreated(true)
        router.invalidate()
      }
    } catch {
      setError("Could not create the transaction.")
    }
    setCreating(false)
  }

  function onReset() {
    setResult(null)
    setError(null)
    setSuggestion(null)
    setCreated(false)
    setCategoryId("")
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
          Snap a photo of your receipt and let Claude extract the details
          automatically.
        </p>
      </div>

      {created ? (
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Expense Created</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {result ? formatCurrency(result.total) : ""} added to your
                ledger.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={onReset}>
                <Camera className="size-4" />
                Scan Another Receipt
              </Button>
              <Button render={<Link to="/finance/transactions" />}>
                View Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !result ? (
        <Card>
          <CardHeader>
            <CardTitle>Scan Receipt</CardTitle>
            <CardDescription>
              Take a photo or upload an image of your receipt. Claude will
              extract the store, items, prices, and total.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!aiConfigured && (
              <div className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                AI gateway not configured — receipt scanning needs the internal
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
                  JPEG, PNG, WebP, or GIF. Max 25 MB. On mobile, tap to use your
                  camera.
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
                    {result.paymentMethod && (
                      <div className="flex justify-between pt-1 text-xs">
                        <span className="text-muted-foreground">Payment</span>
                        <span>{result.paymentMethod}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Transaction</CardTitle>
              <CardDescription>
                Add this receipt as an expense transaction to one of your
                accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create an account first.{" "}
                  <Link to="/finance/accounts" className="underline">
                    Go to accounts
                  </Link>
                </p>
              ) : (
                <>
                  <div className="grid max-w-lg gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="receipt-account">Account</Label>
                      <select
                        id="receipt-account"
                        className={selectClass}
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} (
                            {a.type.replaceAll("_", " ").toLowerCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="receipt-category"
                        className="flex items-center gap-2"
                      >
                        Category
                        {suggesting && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </Label>
                      <select
                        id="receipt-category"
                        className={selectClass}
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.parentCategoryId ? `— ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {suggestion && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Sparkles className="size-3.5 text-primary" />
                      <span className="text-muted-foreground">
                        AI suggested <strong>{suggestion.category}</strong>
                      </span>
                      <span className={confidenceColor(suggestion.confidence)}>
                        ({Math.round(suggestion.confidence * 100)}% confident)
                      </span>
                      {suggestion.reasoning && (
                        <span className="hidden text-muted-foreground sm:inline">
                          — {suggestion.reasoning}
                        </span>
                      )}
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button onClick={onCreate} disabled={creating || !accountId}>
                    {creating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        Create Expense — {formatCurrency(result.total)}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
