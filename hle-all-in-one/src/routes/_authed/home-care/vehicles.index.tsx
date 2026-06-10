import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Car, Plus } from "lucide-react"
import {
  createVehicleFn,
  getVehiclesPageFn,
} from "@/server/home-care/fns.vehicles"
import type { VehicleStatus } from "@/server/home-care/vehicles"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/home-care/vehicles/")({
  loader: () => getVehiclesPageFn(),
  component: VehiclesPage,
})

const STATUS_COLORS: Record<VehicleStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  SOLD: "bg-gray-100 text-gray-800",
  SCRAPPED: "bg-red-100 text-red-800",
  STORED: "bg-blue-100 text-blue-800",
}

function formatMileage(miles: number | null): string {
  if (miles === null) return "—"
  return `${miles.toLocaleString("en-US")} mi`
}

function VehiclesPage() {
  const vehicles = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            Cars, trucks, and other vehicles.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add vehicle
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Car className="mx-auto mb-3 size-10 opacity-40" />
            <p>No vehicles yet. Add your cars, trucks, and other vehicles.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead className="text-right">Mileage</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link
                        to="/home-care/vehicles/$id"
                        params={{ id: v.id }}
                        className="font-medium hover:underline"
                      >
                        {v.year ? `${v.year} ` : ""}
                        {v.make} {v.model}
                      </Link>
                      {v.trim && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {v.trim}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.color || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.licensePlate || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMileage(v.currentMileage)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {v.purchasePrice !== null
                        ? formatCurrency(v.purchasePrice)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[v.status]}>
                        {v.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {createOpen && (
        <CreateVehicleDialog
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

function CreateVehicleDialog({
  onClose,
  onSaved,
}: {
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
      const result = await createVehicleFn({
        data: {
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
          notes: "",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add vehicle.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add vehicle</DialogTitle>
          <DialogDescription>
            Track maintenance, repairs, and mileage for a vehicle.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="v-year">Year</Label>
              <Input id="v-year" name="year" type="number" placeholder="2024" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-make">Make *</Label>
              <Input
                id="v-make"
                name="make"
                placeholder="e.g. Toyota"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-model">Model *</Label>
              <Input
                id="v-model"
                name="model"
                placeholder="e.g. Camry"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="v-trim">Trim</Label>
              <Input id="v-trim" name="trim" placeholder="e.g. SE, XLE" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-color">Color</Label>
              <Input id="v-color" name="color" placeholder="e.g. Silver" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="v-vin">VIN</Label>
              <Input id="v-vin" name="vin" placeholder="Vehicle ID Number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-plate">License Plate</Label>
              <Input id="v-plate" name="licensePlate" placeholder="ABC-1234" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="v-mileage">Current Mileage</Label>
            <Input
              id="v-mileage"
              name="currentMileage"
              type="number"
              min="0"
              placeholder="45000"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="v-purchaseDate">Purchase Date</Label>
              <Input id="v-purchaseDate" name="purchaseDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-purchasePrice">Purchase Price</Label>
              <Input
                id="v-purchasePrice"
                name="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="v-purchasedFrom">Purchased From</Label>
            <Input
              id="v-purchasedFrom"
              name="purchasedFrom"
              placeholder="Dealership"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
