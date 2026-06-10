// Editable "discovered pattern" card for the AI Smart Link page: an AI
// suggestion the user can tweak (bill ⇄ recurring ⇄ skip) before creating.
import {
  Check,
  ChevronUp,
  FileText,
  Pencil,
  Plus,
  Repeat,
  Sparkles,
  X,
} from "lucide-react"
import type { UnlinkedTransactionRow } from "@/server/finance/smart-link"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type EditableSuggestion = {
  key: string
  originalType: "bill" | "recurring"
  chosenType: "bill" | "recurring" | "skip"
  name: string
  payee: string
  amount: number
  // Bill fields
  category: string
  dueDayOfMonth: number
  // Recurring fields
  frequency: string
  // Common
  transactionIds: Array<string>
  confidence: number
  reasoning: string
  created: boolean
  dismissed: boolean
  editing: boolean
}

const selectClass =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const BILL_CATEGORIES = [
  { value: "UTILITIES", label: "Utilities" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "SUBSCRIPTIONS", label: "Subscriptions" },
  { value: "PHONE", label: "Phone" },
  { value: "INTERNET", label: "Internet" },
  { value: "RENT", label: "Rent" },
  { value: "MORTGAGE", label: "Mortgage" },
  { value: "CAR_PAYMENT", label: "Car Payment" },
  { value: "CHILD_CARE", label: "Child Care" },
  { value: "STREAMING", label: "Streaming" },
  { value: "OTHER", label: "Other" },
]

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BI_WEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
]

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const variant = pct >= 85 ? "default" : pct >= 60 ? "secondary" : "outline"
  return <Badge variant={variant}>{pct}%</Badge>
}

export function SmartLinkSuggestionCard({
  suggestion: s,
  transactions,
  isPending,
  onUpdate,
  onCreate,
  onDismiss,
}: {
  suggestion: EditableSuggestion
  transactions: Array<UnlinkedTransactionRow>
  isPending: boolean
  onUpdate: (updates: Partial<EditableSuggestion>) => void
  onCreate: () => void
  onDismiss: () => void
}) {
  const matchingTxs = transactions.filter((t) =>
    s.transactionIds.includes(t.id)
  )
  const borderColor = s.created
    ? "border-green-300 opacity-60"
    : s.chosenType === "bill"
      ? "border-blue-200 dark:border-blue-900"
      : s.chosenType === "recurring"
        ? "border-purple-200 dark:border-purple-900"
        : "border-muted opacity-50"

  return (
    <Card className={borderColor}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {s.chosenType === "bill" ? (
                <FileText className="size-4 shrink-0 text-blue-500" />
              ) : s.chosenType === "recurring" ? (
                <Repeat className="size-4 shrink-0 text-purple-500" />
              ) : (
                <X className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{s.name}</span>
              <Badge variant="outline" className="text-xs">
                {s.chosenType === "bill"
                  ? s.category
                  : s.chosenType === "recurring"
                    ? s.frequency
                    : "Skipped"}
              </Badge>
              <span className="text-sm font-medium tabular-nums">
                {formatCurrency(s.amount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3 shrink-0" />
              {s.reasoning}
              <span className="mx-1">·</span>
              {matchingTxs.length} transaction
              {matchingTxs.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ConfidenceBadge confidence={s.confidence} />
            {s.created ? (
              <Badge className="bg-green-600 text-white">
                <Check className="size-3" />
                Created
              </Badge>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdate({ editing: !s.editing })}
                >
                  {s.editing ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <Pencil className="size-4" />
                  )}
                  {s.editing ? "Close" : "Edit"}
                </Button>
                {s.chosenType !== "skip" && (
                  <Button size="sm" onClick={onCreate} disabled={isPending}>
                    <Plus className="size-4" />
                    {s.chosenType === "bill"
                      ? "Create Bill"
                      : "Create Recurring"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  <X className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {s.editing && !s.created && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Create as</Label>
                <select
                  className={selectClass}
                  value={s.chosenType}
                  onChange={(e) =>
                    onUpdate({
                      chosenType: e.target.value as
                        | "bill"
                        | "recurring"
                        | "skip",
                    })
                  }
                >
                  <option value="bill">Monthly Bill</option>
                  <option value="recurring">Recurring Transaction</option>
                  <option value="skip">Skip (don&apos;t create)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  className="h-8 text-sm"
                  value={s.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  step="0.01"
                  value={s.amount}
                  onChange={(e) =>
                    onUpdate({ amount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payee</Label>
                <Input
                  className="h-8 text-sm"
                  value={s.payee}
                  onChange={(e) => onUpdate({ payee: e.target.value })}
                />
              </div>

              {s.chosenType === "bill" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <select
                      className={selectClass}
                      value={s.category}
                      onChange={(e) => onUpdate({ category: e.target.value })}
                    >
                      {BILL_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due Day of Month</Label>
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      min={1}
                      max={31}
                      value={s.dueDayOfMonth}
                      onChange={(e) =>
                        onUpdate({
                          dueDayOfMonth: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </>
              )}

              {s.chosenType === "recurring" && (
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <select
                    className={selectClass}
                    value={s.frequency}
                    onChange={(e) => onUpdate({ frequency: e.target.value })}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {matchingTxs.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Matching transactions:
                </p>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {matchingTxs.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex justify-between">
                      <span>
                        {tx.payee || tx.description} · {formatDate(tx.date)}
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(Math.abs(tx.amount))}
                      </span>
                    </div>
                  ))}
                  {matchingTxs.length > 5 && (
                    <p>+{matchingTxs.length - 5} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
