import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Gauge, Plus, Trash2 } from "lucide-react"
import {
  createMileageEntryFn,
  deleteMileageEntryFn,
  getMileagePageFn,
} from "@/server/home-care/fns.mileage"
import type { MileageEntryRow } from "@/server/home-care/mileage"
import { formatDate, toDateInputValue } from "@/lib/format"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/home-care/mileage")({
  loader: () => getMileagePageFn(),
  component: MileagePage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function formatMileage(miles: number): string {
  return `${miles.toLocaleString("en-US")} mi`
}

function MileagePage() {
  const { vehicles, entries } = Route.useLoaderData()
  const router = useRouter()
  const [createError, setCreateError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MileageEntryRow | null>(null)

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createMileageEntryFn({
        data: {
          vehicleId: String(f.get("vehicleId") ?? ""),
          mileage: String(f.get("mileage") ?? ""),
          date: String(f.get("date") ?? ""),
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setCreateError(result.error)
        return
      }
      form.reset()
      router.invalidate()
    } catch {
      setCreateError("Could not log mileage.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mileage Log</h1>
        <p className="text-sm text-muted-foreground">
          Odometer readings across your vehicles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Mileage</CardTitle>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active vehicles.{" "}
              <Link to="/home-care/vehicles" className="underline">
                Add a vehicle
              </Link>{" "}
              first.
            </p>
          ) : (
            <form
              onSubmit={onCreate}
              className="grid items-end gap-4 sm:grid-cols-5"
            >
              <div className="space-y-1">
                <Label htmlFor="m-vehicle">Vehicle</Label>
                <select
                  id="m-vehicle"
                  name="vehicleId"
                  className={selectClass}
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select vehicle
                  </option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.year ? `${v.year} ` : ""}
                      {v.make} {v.model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-mileage">Odometer Reading</Label>
                <Input
                  id="m-mileage"
                  name="mileage"
                  type="number"
                  min="0"
                  placeholder="45230"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-date">Date</Label>
                <Input
                  id="m-date"
                  name="date"
                  type="date"
                  defaultValue={toDateInputValue(new Date())}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-notes">Notes</Label>
                <Input id="m-notes" name="notes" placeholder="Optional" />
              </div>
              <Button type="submit" disabled={pending}>
                <Plus className="size-4" /> Log
              </Button>
            </form>
          )}
          {createError && (
            <p className="mt-2 text-sm text-destructive">{createError}</p>
          )}
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Gauge className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No mileage entries yet. Log your odometer readings to track
              driving history.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Recent Entries ({entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link
                        to="/home-care/vehicles/$id"
                        params={{ id: entry.vehicleId }}
                        className="hover:underline"
                      >
                        {entry.vehicleYear ? `${entry.vehicleYear} ` : ""}
                        {entry.vehicleMake} {entry.vehicleModel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMileage(entry.mileage)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Delete entry"
                        onClick={() => setDeleteTarget(entry)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteEntryDialog
          entry={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function DeleteEntryDialog({
  entry,
  onClose,
  onDeleted,
}: {
  entry: MileageEntryRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteMileageEntryFn({ data: { id: entry.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete entry.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this mileage entry?</AlertDialogTitle>
          <AlertDialogDescription>
            {formatMileage(entry.mileage)} on {formatDate(entry.date)} for the{" "}
            {entry.vehicleYear ? `${entry.vehicleYear} ` : ""}
            {entry.vehicleMake} {entry.vehicleModel}. The vehicle&apos;s current
            odometer value is not changed.
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
