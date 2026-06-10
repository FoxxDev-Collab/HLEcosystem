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
  Gauge,
  Trash2,
  Wrench,
} from "lucide-react"
import {
  deleteVehicleFn,
  getVehicleFn,
  updateVehicleFn,
} from "@/server/home-care/fns.vehicles"
import type { VehicleStatus } from "@/server/home-care/vehicles"
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

export const Route = createFileRoute("/_authed/home-care/vehicles/$id")({
  loader: ({ params }) => getVehicleFn({ data: { id: params.id } }),
  component: VehicleDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const STATUSES: Array<VehicleStatus> = ["ACTIVE", "SOLD", "SCRAPPED", "STORED"]

function formatMileage(miles: number | null): string {
  if (miles === null) return "—"
  return `${miles.toLocaleString("en-US")} mi`
}

function VehicleDetailPage() {
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
        <p className="text-sm text-muted-foreground">Vehicle not found.</p>
        <Button variant="outline" render={<Link to="/home-care/vehicles" />}>
          <ArrowLeft className="size-4" /> Back to vehicles
        </Button>
      </div>
    )
  }

  const { vehicle, mileageEntries, maintenanceLogs, repairs, documents } = data

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await updateVehicleFn({
        data: {
          id: vehicle.id,
          year: text("year"),
          make: text("make"),
          model: text("model"),
          trim: text("trim"),
          vin: text("vin"),
          licensePlate: text("licensePlate"),
          color: text("color"),
          currentMileage: text("currentMileage"),
          purchaseDate: text("purchaseDate"),
          purchasePrice: text("purchasePrice"),
          purchasedFrom: text("purchasedFrom"),
          status: text("status") as VehicleStatus,
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
      setError("Could not save vehicle.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link to="/home-care/vehicles" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">
            {vehicle.year ? `${vehicle.year} ` : ""}
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-sm text-muted-foreground">
            {vehicle.currentMileage !== null
              ? formatMileage(vehicle.currentMileage)
              : "No mileage recorded"}
            {vehicle.licensePlate && ` · ${vehicle.licensePlate}`}
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
              <Label htmlFor="v-year">Year</Label>
              <Input
                id="v-year"
                name="year"
                type="number"
                defaultValue={vehicle.year ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-make">Make</Label>
              <Input
                id="v-make"
                name="make"
                defaultValue={vehicle.make}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-model">Model</Label>
              <Input
                id="v-model"
                name="model"
                defaultValue={vehicle.model}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-trim">Trim</Label>
              <Input
                id="v-trim"
                name="trim"
                defaultValue={vehicle.trim ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-vin">VIN</Label>
              <Input id="v-vin" name="vin" defaultValue={vehicle.vin ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-plate">License Plate</Label>
              <Input
                id="v-plate"
                name="licensePlate"
                defaultValue={vehicle.licensePlate ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-color">Color</Label>
              <Input
                id="v-color"
                name="color"
                defaultValue={vehicle.color ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-mileage">Current Mileage</Label>
              <Input
                id="v-mileage"
                name="currentMileage"
                type="number"
                min="0"
                defaultValue={vehicle.currentMileage ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-status">Status</Label>
              <select
                id="v-status"
                name="status"
                className={selectClass}
                defaultValue={vehicle.status}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-purchaseDate">Purchase Date</Label>
              <Input
                id="v-purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={toDateInputValue(vehicle.purchaseDate)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-purchasePrice">Purchase Price</Label>
              <Input
                id="v-purchasePrice"
                name="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={vehicle.purchasePrice ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-purchasedFrom">Purchased From</Label>
              <Input
                id="v-purchasedFrom"
                name="purchasedFrom"
                defaultValue={vehicle.purchasedFrom ?? ""}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="v-notes">Notes</Label>
              <Input
                id="v-notes"
                name="notes"
                defaultValue={vehicle.notes ?? ""}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents attached. Upload titles and receipts from the{" "}
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
            <Gauge className="size-4" /> Mileage History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mileageEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mileage entries.{" "}
              <Link to="/home-care/mileage" className="underline">
                Log mileage
              </Link>
            </p>
          ) : (
            <div className="divide-y">
              {mileageEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm">{formatDate(entry.date)}</span>
                  <span className="text-sm font-medium">
                    {formatMileage(entry.mileage)}
                  </span>
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
              No maintenance records for this vehicle.
            </p>
          ) : (
            <div className="divide-y">
              {maintenanceLogs.map((log) => (
                <div key={log.id} className="py-3">
                  <div className="text-sm font-medium">{log.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(log.completedDate)}
                    {log.completedBy && ` · ${log.completedBy}`}
                    {log.mileageAtService !== null &&
                      ` · ${formatMileage(log.mileageAtService)}`}
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
              No repair records for this vehicle.
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {deleteOpen && (
        <DeleteVehicleDialog
          label={`${vehicle.year ? `${vehicle.year} ` : ""}${vehicle.make} ${vehicle.model}`}
          id={vehicle.id}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => navigate({ to: "/home-care/vehicles" })}
        />
      )}
    </div>
  )
}

function DeleteVehicleDialog({
  label,
  id,
  onClose,
  onDeleted,
}: {
  label: string
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
      const result = await deleteVehicleFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete vehicle.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the vehicle and its mileage log, and
            detaches its maintenance records, repairs, and documents.
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
