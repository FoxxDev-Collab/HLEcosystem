import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Landmark, MapPin, Plus, Receipt } from "lucide-react"
import type { FinanceTripStatus } from "@/server/finance/trips"
import { createTripFn, getTripsPageFn } from "@/server/finance/fns.trips"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_authed/finance/trips/")({
  loader: () => getTripsPageFn(),
  component: TripsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const TRIP_STATUS_COLORS: Record<FinanceTripStatus, string> = {
  PLANNING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
}

function TripsPage() {
  const { trips, projects } = Route.useLoaderData()
  const navigate = useNavigate()

  const activeTrips = trips.filter(
    (t) => t.status === "ACTIVE" || t.status === "PLANNING"
  )
  const totalSpent = trips.reduce((sum, t) => sum + t.totalSpent, 0)
  const taxDeductibleTotal = trips
    .filter((t) => t.isTaxDeductible)
    .reduce((sum, t) => sum + t.totalSpent, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Trips</h1>
        <p className="text-sm text-muted-foreground">
          Trip expense tracking, with tax-deductible totals
        </p>
      </div>

      {trips.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Trips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trips.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Trips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTrips.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(totalSpent)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1 text-sm">
                <Landmark className="size-3.5" /> Tax Deductible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 tabular-nums">
                {formatCurrency(taxDeductibleTotal)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <NewTripCard
        projects={projects}
        onCreated={(id) =>
          navigate({ to: "/finance/trips/$id", params: { id } })
        }
      />

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No trips yet. Create one to start tracking expenses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Card
              key={trip.id}
              className="h-full transition-colors hover:bg-accent/30"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Link to="/finance/trips/$id" params={{ id: trip.id }}>
                    <CardTitle className="cursor-pointer text-base hover:underline">
                      {trip.name}
                    </CardTitle>
                  </Link>
                  <div className="flex items-center gap-1.5">
                    {trip.isTaxDeductible && (
                      <Badge
                        variant="outline"
                        className="border-green-300 text-green-600 dark:border-green-700"
                      >
                        <Landmark className="size-3" /> Tax
                      </Badge>
                    )}
                    <Badge className={TRIP_STATUS_COLORS[trip.status]}>
                      {trip.status}
                    </Badge>
                  </div>
                </div>
                {trip.destination && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {trip.destination}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xl font-bold tabular-nums">
                  {formatCurrency(trip.totalSpent)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Receipt className="size-3" />
                  {trip.expenseCount} expense
                  {trip.expenseCount !== 1 ? "s" : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                </div>
                {trip.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {trip.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function NewTripCard({
  projects,
  onCreated,
}: {
  projects: Array<{ id: string; name: string }>
  onCreated: (id: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createTripFn({
        data: {
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? ""),
          destination: String(f.get("destination") ?? ""),
          startDate: String(f.get("startDate") ?? ""),
          endDate: String(f.get("endDate") ?? ""),
          isTaxDeductible: f.get("isTaxDeductible") === "on",
          taxPurpose: String(f.get("taxPurpose") ?? ""),
          budgetPlannerProjectId:
            String(f.get("budgetPlannerProjectId") ?? "").trim() || null,
        },
      })
      onCreated(result.id)
    } catch {
      setError("Could not create trip.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="trip-name">Trip Name</Label>
              <Input
                id="trip-name"
                name="name"
                placeholder="e.g. Boise House Repair"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-destination">Destination</Label>
              <Input
                id="trip-destination"
                name="destination"
                placeholder="e.g. Boise, ID"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-start">Start Date</Label>
              <Input id="trip-start" name="startDate" type="date" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-end">End Date</Label>
              <Input id="trip-end" name="endDate" type="date" required />
            </div>
          </div>
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="trip-description">Description</Label>
              <Input
                id="trip-description"
                name="description"
                placeholder="Optional details"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-project">Linked Project</Label>
              <select
                id="trip-project"
                name="budgetPlannerProjectId"
                className={selectClass}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                name="isTaxDeductible"
                id="trip-tax-deductible"
                className="size-4 rounded border-input"
              />
              <Label htmlFor="trip-tax-deductible" className="cursor-pointer">
                Tax Deductible
              </Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-tax-purpose">Tax Purpose</Label>
              <Input
                id="trip-tax-purpose"
                name="taxPurpose"
                placeholder="e.g. Property repair"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" /> Create Trip
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
