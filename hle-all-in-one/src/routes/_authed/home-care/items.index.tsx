import { useMemo, useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowUpDown,
  Plus,
  Refrigerator,
  Search,
  ShieldCheck,
} from "lucide-react"
import { createItemFn, getItemsPageFn } from "@/server/home-care/fns.items"
import type { ItemCondition, ItemListRow } from "@/server/home-care/items"
import type { RoomOption } from "@/server/home-care/rooms"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_authed/home-care/items/")({
  validateSearch: (search: Record<string, unknown>): { roomId?: string } => ({
    roomId: typeof search.roomId === "string" ? search.roomId : undefined,
  }),
  loader: () => getItemsPageFn(),
  component: ItemsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const CONDITIONS: Array<ItemCondition> = [
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "POOR",
  "NEEDS_REPAIR",
  "DECOMMISSIONED",
]

const CONDITION_COLORS: Record<ItemCondition, string> = {
  EXCELLENT: "bg-green-100 text-green-800",
  GOOD: "bg-blue-100 text-blue-800",
  FAIR: "bg-yellow-100 text-yellow-800",
  POOR: "bg-orange-100 text-orange-800",
  NEEDS_REPAIR: "bg-red-100 text-red-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-800",
}

type SortColumn = "name" | "room" | "warranty" | "condition"

function ItemsPage() {
  const { items, rooms } = Route.useLoaderData()
  const { roomId } = Route.useSearch()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [roomFilter, setRoomFilter] = useState(roomId ?? "")
  const [sort, setSort] = useState<SortColumn>("name")
  const [dir, setDir] = useState<"asc" | "desc">("asc")

  function toggleSort(column: SortColumn) {
    if (sort === column) {
      setDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSort(column)
      setDir("asc")
    }
  }

  const today = new Date()
  const todayStr = toDayString(today)
  const thirtyOut = toDayString(
    new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  )
  const warrantyAlerts = items.filter(
    (i) =>
      i.warrantyExpires &&
      i.warrantyExpires > todayStr &&
      i.warrantyExpires <= thirtyOut
  ).length

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = items.filter((i) => {
      if (roomFilter && i.roomId !== roomFilter) return false
      if (!q) return true
      return [i.name, i.manufacturer, i.model]
        .filter((v): v is string => v !== null)
        .some((v) => v.toLowerCase().includes(q))
    })
    const sign = dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => sign * compareItems(a, b, sort))
  }, [items, query, roomFilter, sort, dir])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Items &amp; Appliances</h1>
          <p className="text-sm text-muted-foreground">
            Home appliances, systems, and equipment.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      {warrantyAlerts > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-400">
              <AlertTriangle className="size-4" />
              <span>
                <strong>{warrantyAlerts}</strong>{" "}
                {warrantyAlerts !== 1 ? "warranties" : "warranty"} expiring
                within 30 days
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className={`${selectClass} w-48`}
          aria-label="Filter by room"
        >
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {visible.length} item{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Refrigerator className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No items yet. Add your home appliances, systems, and equipment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              All Items ({visible.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton
                      label="Name"
                      onClick={() => toggleSort("name")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      label="Room"
                      onClick={() => toggleSort("room")}
                    />
                  </TableHead>
                  <TableHead>Manufacturer / Model</TableHead>
                  <TableHead>
                    <SortButton
                      label="Warranty"
                      onClick={() => toggleSort("warranty")}
                    />
                  </TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>
                    <SortButton
                      label="Condition"
                      onClick={() => toggleSort("condition")}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        to="/home-care/items/$id"
                        params={{ id: item.id }}
                        className="font-medium hover:underline"
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.roomName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[item.manufacturer, item.model]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      {item.warrantyExpires ? (
                        <span className="flex items-center gap-1 text-xs">
                          <ShieldCheck
                            className={`size-3 ${
                              item.warrantyExpires < todayStr
                                ? "text-red-500"
                                : "text-green-600"
                            }`}
                          />
                          <span
                            className={
                              item.warrantyExpires < todayStr
                                ? "text-red-600"
                                : "text-green-600"
                            }
                          >
                            {formatDate(item.warrantyExpires)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.purchasePrice !== null
                        ? formatCurrency(item.purchasePrice)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={CONDITION_COLORS[item.condition]}>
                        {item.condition.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No items match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {createOpen && (
        <CreateItemDialog
          rooms={rooms}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function toDayString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function compareItems(a: ItemListRow, b: ItemListRow, sort: SortColumn) {
  switch (sort) {
    case "room":
      return (a.roomName ?? "￿").localeCompare(b.roomName ?? "￿")
    case "warranty":
      return (a.warrantyExpires ?? "￿").localeCompare(b.warrantyExpires ?? "￿")
    case "condition":
      return CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition)
    default:
      return a.name.localeCompare(b.name)
  }
}

function SortButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-left hover:text-foreground"
    >
      {label} <ArrowUpDown className="size-3" />
    </button>
  )
}

function CreateItemDialog({
  rooms,
  onClose,
  onSaved,
}: {
  rooms: Array<RoomOption>
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
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await createItemFn({
        data: {
          name: text("name"),
          roomId: text("roomId"),
          description: "",
          manufacturer: text("manufacturer"),
          model: text("model"),
          serialNumber: text("serialNumber"),
          purchaseDate: text("purchaseDate"),
          purchasePrice: text("purchasePrice"),
          purchasedFrom: text("purchasedFrom"),
          warrantyExpires: text("warrantyExpires"),
          warrantyNotes: "",
          condition: text("condition") as ItemCondition,
          manualUrl: "",
          notes: text("notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add item.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add item</DialogTitle>
          <DialogDescription>
            Track an appliance, system, or piece of equipment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="i-name">Name *</Label>
            <Input
              id="i-name"
              name="name"
              placeholder="e.g. Dishwasher, HVAC Unit"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="i-room">Room</Label>
              <select id="i-room" name="roomId" className={selectClass}>
                <option value="">No room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-condition">Condition</Label>
              <select
                id="i-condition"
                name="condition"
                className={selectClass}
                defaultValue="GOOD"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="i-manufacturer">Manufacturer</Label>
              <Input
                id="i-manufacturer"
                name="manufacturer"
                placeholder="Brand"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-model">Model</Label>
              <Input id="i-model" name="model" placeholder="Model number" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="i-serial">Serial Number</Label>
            <Input id="i-serial" name="serialNumber" placeholder="S/N" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="i-purchaseDate">Purchase Date</Label>
              <Input id="i-purchaseDate" name="purchaseDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-purchasePrice">Purchase Price</Label>
              <Input
                id="i-purchasePrice"
                name="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="i-warrantyExpires">Warranty Expires</Label>
              <Input
                id="i-warrantyExpires"
                name="warrantyExpires"
                type="date"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-purchasedFrom">Purchased From</Label>
              <Input
                id="i-purchasedFrom"
                name="purchasedFrom"
                placeholder="Store / retailer"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="i-notes">Notes</Label>
            <Input id="i-notes" name="notes" placeholder="Optional" />
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
