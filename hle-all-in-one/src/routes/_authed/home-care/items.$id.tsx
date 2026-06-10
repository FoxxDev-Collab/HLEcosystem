import { useState } from "react"
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react"
import {
  archiveItemFn,
  deleteItemFn,
  getItemFn,
  updateItemFn,
} from "@/server/home-care/fns.items"
import type { ItemCondition } from "@/server/home-care/items"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export const Route = createFileRoute("/_authed/home-care/items/$id")({
  loader: ({ params }) => getItemFn({ data: { id: params.id } }),
  component: ItemDetailPage,
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

function ItemDetailPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Item not found.</p>
        <Button variant="outline" render={<Link to="/home-care/items" />}>
          <ArrowLeft className="size-4" /> Back to items
        </Button>
      </div>
    )
  }

  const { item, rooms, maintenanceLogs, repairs, documents } = data
  const todayStr = toDateInputValue(new Date())
  const warrantyActive =
    item.warrantyExpires !== null && item.warrantyExpires > todayStr

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await updateItemFn({
        data: {
          id: item.id,
          name: text("name"),
          roomId: text("roomId"),
          description: text("description"),
          manufacturer: text("manufacturer"),
          model: text("model"),
          serialNumber: text("serialNumber"),
          purchaseDate: text("purchaseDate"),
          purchasePrice: text("purchasePrice"),
          purchasedFrom: text("purchasedFrom"),
          warrantyExpires: text("warrantyExpires"),
          warrantyNotes: text("warrantyNotes"),
          condition: text("condition") as ItemCondition,
          manualUrl: text("manualUrl"),
          notes: text("notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      setSaved(true)
      router.invalidate()
    } catch {
      setError("Could not save item.")
    } finally {
      setPending(false)
    }
  }

  async function onArchive() {
    setError(null)
    try {
      const result = await archiveItemFn({ data: { id: item.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      navigate({ to: "/home-care/items" })
    } catch {
      setError("Could not archive item.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link to="/home-care/items" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {item.name}
            {item.isArchived && <Badge variant="secondary">Archived</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {item.roomName || "No room"}
            {item.manufacturer && ` · ${item.manufacturer}`}
            {item.model && ` ${item.model}`}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSave}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-1">
              <Label htmlFor="i-name">Name</Label>
              <Input
                id="i-name"
                name="name"
                defaultValue={item.name}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-room">Room</Label>
              <select
                id="i-room"
                name="roomId"
                className={selectClass}
                defaultValue={item.roomId ?? ""}
              >
                <option value="">No room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-manufacturer">Manufacturer</Label>
              <Input
                id="i-manufacturer"
                name="manufacturer"
                defaultValue={item.manufacturer ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-model">Model</Label>
              <Input
                id="i-model"
                name="model"
                defaultValue={item.model ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-serial">Serial Number</Label>
              <Input
                id="i-serial"
                name="serialNumber"
                defaultValue={item.serialNumber ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-condition">Condition</Label>
              <select
                id="i-condition"
                name="condition"
                className={selectClass}
                defaultValue={item.condition}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-purchaseDate">Purchase Date</Label>
              <Input
                id="i-purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={toDateInputValue(item.purchaseDate)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-purchasePrice">Purchase Price</Label>
              <Input
                id="i-purchasePrice"
                name="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.purchasePrice ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-purchasedFrom">Purchased From</Label>
              <Input
                id="i-purchasedFrom"
                name="purchasedFrom"
                defaultValue={item.purchasedFrom ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-warrantyExpires">Warranty Expires</Label>
              <Input
                id="i-warrantyExpires"
                name="warrantyExpires"
                type="date"
                defaultValue={toDateInputValue(item.warrantyExpires)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-warrantyNotes">Warranty Notes</Label>
              <Input
                id="i-warrantyNotes"
                name="warrantyNotes"
                defaultValue={item.warrantyNotes ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-manualUrl">Manual URL</Label>
              <Input
                id="i-manualUrl"
                name="manualUrl"
                defaultValue={item.manualUrl ?? ""}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="i-description">Description</Label>
              <Input
                id="i-description"
                name="description"
                defaultValue={item.description ?? ""}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="i-notes">Notes</Label>
              <Input
                id="i-notes"
                name="notes"
                defaultValue={item.notes ?? ""}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save Changes"}
              </Button>
              {saved && (
                <span className="text-sm text-muted-foreground">Saved.</span>
              )}
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex gap-2 border-t pt-4">
            {!item.isArchived && (
              <Button variant="outline" size="sm" onClick={onArchive}>
                Archive
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {item.warrantyExpires && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck
                className={`size-5 ${
                  warrantyActive ? "text-green-600" : "text-red-500"
                }`}
              />
              <div>
                <div className="text-sm font-medium">
                  Warranty {warrantyActive ? "Active" : "Expired"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {warrantyActive ? "Expires" : "Expired"}{" "}
                  {formatDate(item.warrantyExpires)}
                  {item.warrantyNotes && ` — ${item.warrantyNotes}`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents attached. Upload manuals and receipts from the{" "}
              <Link to="/home-care/documents" className="underline">
                Documents
              </Link>{" "}
              page.
            </p>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2"
                >
                  <Link
                    to="/home-care/documents/$id"
                    params={{ id: doc.id }}
                    className="text-sm hover:underline"
                  >
                    <span className="font-medium">{doc.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {doc.type}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4" /> Maintenance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {maintenanceLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No maintenance records for this item.
            </p>
          ) : (
            <div className="divide-y">
              {maintenanceLogs.map((log) => (
                <div key={log.id} className="py-3">
                  <div className="text-sm font-medium">{log.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(log.completedDate)}
                    {log.completedBy && ` · ${log.completedBy}`}
                    {log.cost !== null && ` · ${formatCurrency(log.cost)}`}
                  </div>
                  {log.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4" /> Repair History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {repairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repair records for this item.
            </p>
          ) : (
            <div className="divide-y">
              {repairs.map((repair) => (
                <div key={repair.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{repair.title}</div>
                    <Badge variant="secondary">
                      {repair.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(repair.reportedDate)}
                    {repair.completedBy && ` · ${repair.completedBy}`}
                    {repair.providerName && ` · ${repair.providerName}`}
                    {repair.totalCost !== null &&
                      ` · ${formatCurrency(repair.totalCost)}`}
                  </div>
                  {repair.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {repair.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {deleteOpen && (
        <DeleteItemDialog
          name={item.name}
          id={item.id}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => navigate({ to: "/home-care/items" })}
        />
      )}
    </div>
  )
}

function DeleteItemDialog({
  name,
  id,
  onClose,
  onDeleted,
}: {
  name: string
  id: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteItemFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete item.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the item and detaches its documents,
            maintenance records, and repairs.
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
