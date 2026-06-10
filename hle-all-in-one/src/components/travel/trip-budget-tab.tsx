import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type {
  TravelBudgetCategory,
  TravelBudgetItemRow,
} from "@/server/travel/detail"
import {
  createBudgetItemFn,
  deleteBudgetItemFn,
} from "@/server/travel/fns.detail"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BUDGET_CATEGORIES,
  enumLabel,
  parseMoney,
  selectClass,
} from "./trip-shared"

export function TripBudgetTab({
  tripId,
  budgetItems,
  onChanged,
}: {
  tripId: string
  budgetItems: Array<TravelBudgetItemRow>
  onChanged: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const totalPlanned = budgetItems.reduce((sum, b) => sum + b.plannedAmount, 0)
  const totalActual = budgetItems.reduce(
    (sum, b) => sum + (b.actualAmount ?? 0),
    0
  )
  const totalDiff = totalPlanned - totalActual

  async function remove(itemId: string) {
    setActionError(null)
    try {
      const result = await deleteBudgetItemFn({ data: { id: itemId } })
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setActionError("Could not delete budget item.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budget</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" /> Add item
        </Button>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {budgetItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No budget items yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetItems.map((item) => {
                  const diff =
                    item.actualAmount !== null
                      ? item.plannedAmount - item.actualAmount
                      : null
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {enumLabel(item.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.description}</div>
                        {item.notes && (
                          <div className="text-xs text-muted-foreground">
                            {item.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.plannedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.actualAmount !== null
                          ? formatCurrency(item.actualAmount)
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          diff !== null
                            ? diff >= 0
                              ? "text-green-600"
                              : "text-red-600"
                            : ""
                        }`}
                      >
                        {diff !== null
                          ? (diff >= 0 ? "+" : "−") +
                            formatCurrency(Math.abs(diff))
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete budget item"
                          onClick={() => remove(item.id)}
                        >
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">
                    Totals
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(totalPlanned)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(totalActual)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      totalDiff >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {(totalDiff >= 0 ? "+" : "−") +
                      formatCurrency(Math.abs(totalDiff))}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {addOpen && (
        <AddBudgetItemDialog
          tripId={tripId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function AddBudgetItemDialog({
  tripId,
  onClose,
  onSaved,
}: {
  tripId: string
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
    const category: TravelBudgetCategory | undefined = BUDGET_CATEGORIES.find(
      (c) => c === f.get("category")
    )
    const plannedAmount = parseMoney(f.get("plannedAmount"))
    if (!category || plannedAmount === null) {
      setError("Category and planned amount are required.")
      setPending(false)
      return
    }
    try {
      const result = await createBudgetItemFn({
        data: {
          tripId,
          category,
          description: String(f.get("description") ?? ""),
          plannedAmount,
          actualAmount: parseMoney(f.get("actualAmount")),
          currency: "USD",
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add budget item.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add budget item</DialogTitle>
          <DialogDescription>
            Track what you plan to spend against what you actually spend.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget-category">Category *</Label>
            <select
              id="budget-category"
              name="category"
              className={selectClass}
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select category
              </option>
              {BUDGET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-desc">Description *</Label>
            <Input id="budget-desc" name="description" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-planned">Planned amount *</Label>
              <Input
                id="budget-planned"
                name="plannedAmount"
                type="number"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-actual">Actual amount</Label>
              <Input
                id="budget-actual"
                name="actualAmount"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-notes">Notes</Label>
            <Input id="budget-notes" name="notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
