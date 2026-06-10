import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Plus,
  Trash2,
} from "lucide-react"
import {
  addSupplyItemFn,
  createSupplyKitFn,
  deleteSupplyItemFn,
  deleteSupplyKitFn,
  getSuppliesPageFn,
  markKitCheckedFn,
} from "@/server/home-care/fns.emergency"
import type {
  SupplyCondition,
  SupplyKitRow,
  SupplyRow,
} from "@/server/home-care/emergency"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
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

export const Route = createFileRoute("/_authed/home-care/emergency/supplies")({
  loader: () => getSuppliesPageFn(),
  component: EmergencySuppliesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const SUPPLY_CONDITIONS: Array<SupplyCondition> = [
  "GOOD",
  "LOW",
  "EXPIRED",
  "NEEDS_REPLACEMENT",
]

const CONDITION_COLORS: Record<SupplyCondition, string> = {
  GOOD: "bg-green-100 text-green-800",
  LOW: "bg-yellow-100 text-yellow-800",
  EXPIRED: "bg-red-100 text-red-800",
  NEEDS_REPLACEMENT: "bg-orange-100 text-orange-800",
}

function daysUntil(expirationDate: string): number {
  const [y, m, d] = expirationDate.split("-").map(Number)
  const exp = new Date(y, m - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function expirationColor(expirationDate: string): string {
  const days = daysUntil(expirationDate)
  if (days < 30) return "text-red-600 font-medium"
  if (days < 60) return "text-yellow-600"
  return "text-green-600"
}

function expirationLabel(expirationDate: string): string {
  const days = daysUntil(expirationDate)
  if (days < 0) return `EXPIRED (${Math.abs(days)}d ago)`
  if (days === 0) return "Expires today"
  if (days < 30) return `${days}d left`
  return ""
}

function EmergencySuppliesPage() {
  const { kits, supplies, rooms } = Route.useLoaderData()
  const router = useRouter()
  const [deleteKitTarget, setDeleteKitTarget] = useState<SupplyKitRow | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  const suppliesByKit = new Map<string, Array<SupplyRow>>()
  for (const s of supplies) {
    const list = suppliesByKit.get(s.kitId) ?? []
    list.push(s)
    suppliesByKit.set(s.kitId, list)
  }

  const expiringCount = supplies.filter(
    (s) => s.expirationDate && daysUntil(s.expirationDate) <= 30
  ).length

  async function runMutation(fn: () => Promise<{ error?: string }>) {
    setError(null)
    try {
      const result = await fn()
      if (result.error) {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Emergency Supply Kits</h1>
          <p className="text-sm text-muted-foreground">
            Track kits, their contents, and expiration dates.
          </p>
        </div>
        {expiringCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="size-4" />
            {expiringCount} item{expiringCount !== 1 ? "s" : ""} expiring soon
          </div>
        )}
      </div>

      <AddKitCard rooms={rooms} onSaved={() => router.invalidate()} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {kits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No supply kits yet. Create kits to track your emergency supplies.
            </p>
          </CardContent>
        </Card>
      ) : (
        kits.map((kit) => {
          const items = suppliesByKit.get(kit.id) ?? []
          return (
            <Card key={kit.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{kit.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {kit.location && <span>{kit.location}</span>}
                      {kit.roomName && <span>({kit.roomName})</span>}
                      <span>|</span>
                      <span>
                        {items.length} item{items.length !== 1 ? "s" : ""}
                      </span>
                      <span>|</span>
                      <span>
                        Last checked:{" "}
                        {kit.lastChecked
                          ? formatDate(kit.lastChecked)
                          : "Never"}
                      </span>
                    </div>
                    {kit.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {kit.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      title="Mark as checked"
                      onClick={() =>
                        runMutation(() =>
                          markKitCheckedFn({ data: { id: kit.id } })
                        )
                      }
                    >
                      <CheckCircle2 className="size-3.5" />
                      Checked
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Delete kit"
                      onClick={() => setDeleteKitTarget(kit)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            {item.quantity}
                            {item.unit ? ` ${item.unit}` : ""}
                          </TableCell>
                          <TableCell>
                            <Badge className={CONDITION_COLORS[item.condition]}>
                              {item.condition.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.expirationDate ? (
                              <div>
                                <span
                                  className={expirationColor(
                                    item.expirationDate
                                  )}
                                >
                                  {formatDate(item.expirationDate)}
                                </span>
                                {expirationLabel(item.expirationDate) && (
                                  <span
                                    className={`block text-xs ${expirationColor(item.expirationDate)}`}
                                  >
                                    {expirationLabel(item.expirationDate)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.notes || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Remove item"
                              onClick={() =>
                                runMutation(() =>
                                  deleteSupplyItemFn({ data: { id: item.id } })
                                )
                              }
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <AddSupplyForm
                  kitId={kit.id}
                  onSaved={() => router.invalidate()}
                />
              </CardContent>
            </Card>
          )
        })
      )}

      {deleteKitTarget && (
        <DeleteKitDialog
          kit={deleteKitTarget}
          onClose={() => setDeleteKitTarget(null)}
          onDeleted={() => {
            setDeleteKitTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function AddKitCard({
  rooms,
  onSaved,
}: {
  rooms: Array<{ id: string; name: string }>
  onSaved: () => void
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
      const result = await createSupplyKitFn({
        data: {
          name: String(f.get("name") ?? ""),
          location: String(f.get("location") ?? ""),
          roomId: String(f.get("roomId") ?? ""),
          description: String(f.get("description") ?? ""),
          notes: "",
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
      setError("Could not create kit.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Supply Kit</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="kit-name">Kit Name</Label>
            <Input
              id="kit-name"
              name="name"
              placeholder="e.g. 72-Hour Kit"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kit-location">Location</Label>
            <Input
              id="kit-location"
              name="location"
              placeholder="e.g. Hall closet"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kit-room">Room</Label>
            <select id="kit-room" name="roomId" className={selectClass}>
              <option value="">Optional</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="kit-description">Description</Label>
            <Input
              id="kit-description"
              name="description"
              placeholder="What's in this kit?"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Kit"}
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

function AddSupplyForm({
  kitId,
  onSaved,
}: {
  kitId: string
  onSaved: () => void
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
      const result = await addSupplyItemFn({
        data: {
          kitId,
          name: String(f.get("name") ?? ""),
          quantity: Number(f.get("quantity") ?? 1) || 1,
          unit: String(f.get("unit") ?? ""),
          expirationDate: String(f.get("expirationDate") ?? ""),
          condition: String(f.get("condition") ?? "GOOD") as SupplyCondition,
          notes: "",
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
      setError("Could not add item.")
      setPending(false)
    }
  }

  return (
    <div className="border-t pt-4">
      <p className="mb-2 text-sm font-medium">Add Item to Kit</p>
      <form
        onSubmit={onSubmit}
        className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="space-y-1">
          <Label htmlFor={`item-name-${kitId}`} className="text-xs">
            Item Name
          </Label>
          <Input
            id={`item-name-${kitId}`}
            name="name"
            placeholder="e.g. Bottled Water"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`item-qty-${kitId}`} className="text-xs">
            Quantity
          </Label>
          <Input
            id={`item-qty-${kitId}`}
            name="quantity"
            type="number"
            min="1"
            defaultValue="1"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`item-unit-${kitId}`} className="text-xs">
            Unit
          </Label>
          <Input
            id={`item-unit-${kitId}`}
            name="unit"
            placeholder="e.g. gallons, packs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`item-exp-${kitId}`} className="text-xs">
            Expiration
          </Label>
          <Input id={`item-exp-${kitId}`} name="expirationDate" type="date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`item-cond-${kitId}`} className="text-xs">
            Condition
          </Label>
          <select
            id={`item-cond-${kitId}`}
            name="condition"
            className={selectClass}
            defaultValue="GOOD"
          >
            {SUPPLY_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          <Plus className="size-3.5" />
          {pending ? "Adding…" : "Add"}
        </Button>
        {error && (
          <p className="text-sm text-destructive sm:col-span-2 lg:col-span-6">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}

function DeleteKitDialog({
  kit,
  onClose,
  onDeleted,
}: {
  kit: SupplyKitRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteSupplyKitFn({ data: { id: kit.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete kit.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{kit.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            All supplies in this kit will be deleted with it.
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
