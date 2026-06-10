import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft, Check, X } from "lucide-react"
import {
  finalizeImportBatchFn,
  getImportBatchFn,
  skipImportedTransactionFn,
} from "@/server/finance/fns.import"
import type { ImportMatchStatus } from "@/server/finance/import"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/finance/import/$id")({
  loader: ({ params }) => getImportBatchFn({ data: { id: params.id } }),
  component: ImportBatchPage,
})

const STATUS_BADGE: Record<ImportMatchStatus, string> = {
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  AUTO_MATCHED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DUPLICATE:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  IMPORTED:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  SKIPPED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

function ImportBatchPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Import batch not found</h1>
        <Button variant="outline" render={<Link to="/finance/import" />}>
          <ArrowLeft className="size-4" />
          Back to Import
        </Button>
      </div>
    )
  }

  const { batch, rows } = data
  const pendingCount = rows.filter((r) => r.matchStatus === "PENDING").length

  async function onSkip(id: string) {
    setError(null)
    const result = await skipImportedTransactionFn({ data: { id } })
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.invalidate()
  }

  async function onFinalize() {
    setError(null)
    setPending(true)
    try {
      const result = await finalizeImportBatchFn({
        data: { batchId: batch.id },
      })
      if ("error" in result) {
        setError(result.error)
      } else {
        router.invalidate()
      }
    } catch {
      setError("Import failed.")
    }
    setPending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            render={<Link to="/finance/import" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{batch.fileName}</h1>
            <p className="text-sm text-muted-foreground">
              {batch.accountName} · {batch.totalRows} transactions ·{" "}
              {formatDateTime(batch.importedAt)}
            </p>
          </div>
        </div>
        {!batch.isFinalized && pendingCount > 0 && (
          <Button onClick={onFinalize} disabled={pending}>
            <Check className="size-4" />
            {pending
              ? "Importing…"
              : `Import ${pendingCount} Transaction${pendingCount !== 1 ? "s" : ""}`}
          </Button>
        )}
        {batch.isFinalized && (
          <Badge className="bg-green-100 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-300">
            Finalized
          </Badge>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Rows" value={batch.totalRows} />
        <SummaryCard
          label="Pending"
          value={pendingCount}
          className="text-yellow-600"
        />
        <SummaryCard
          label="Imported"
          value={batch.importedCount}
          className="text-green-600"
        />
        <SummaryCard
          label="Duplicates"
          value={batch.duplicateCount}
          className="text-orange-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No rows in this batch
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {tx.payee || tx.description || "Transaction"}
                      </span>
                      <Badge className={STATUS_BADGE[tx.matchStatus]}>
                        {tx.matchStatus}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                      {tx.checkNumber && <> · Check #{tx.checkNumber}</>}
                      {tx.suggestedCategoryName && (
                        <>
                          {" "}
                          ·{" "}
                          <span
                            style={{
                              color: tx.suggestedCategoryColor ?? undefined,
                            }}
                          >
                            {tx.suggestedCategoryName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        tx.amount < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </span>
                    {tx.matchStatus === "PENDING" && !batch.isFinalized && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Skip"
                        onClick={() => onSkip(tx.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${className ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
