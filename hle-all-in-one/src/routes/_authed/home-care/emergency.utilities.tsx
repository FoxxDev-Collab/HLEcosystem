import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Plus, Trash2, Zap } from "lucide-react"
import {
  createUtilityShutoffFn,
  deleteUtilityShutoffFn,
  getUtilitiesPageFn,
} from "@/server/home-care/fns.emergency"
import type { UtilityShutoffRow } from "@/server/home-care/emergency"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

export const Route = createFileRoute("/_authed/home-care/emergency/utilities")({
  loader: () => getUtilitiesPageFn(),
  component: EmergencyUtilitiesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const UTILITY_TYPES = [
  "Gas",
  "Water",
  "Electric",
  "Sewer",
  "Internet",
  "HVAC",
  "Sprinkler",
  "Other",
]

const TYPE_COLORS: Record<string, string> = {
  Gas: "bg-orange-100 text-orange-800",
  Water: "bg-blue-100 text-blue-800",
  Electric: "bg-yellow-100 text-yellow-800",
  Sewer: "bg-gray-100 text-gray-800",
  Internet: "bg-purple-100 text-purple-800",
  HVAC: "bg-cyan-100 text-cyan-800",
  Sprinkler: "bg-green-100 text-green-800",
  Other: "bg-gray-100 text-gray-800",
}

function EmergencyUtilitiesPage() {
  const { shutoffs, rooms } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<UtilityShutoffRow | null>(
    null
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Utility Shutoff Locations</h1>
        <p className="text-sm text-muted-foreground">
          Document where and how to shut off gas, water, and electric.
        </p>
      </div>

      <AddShutoffCard rooms={rooms} onSaved={() => router.invalidate()} />

      {shutoffs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Zap className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No utility shutoff locations recorded. Document where and how to
              shut off gas, water, and electric.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shutoffs.map((shutoff) => (
            <Card key={shutoff.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Badge
                      className={
                        TYPE_COLORS[shutoff.utilityType] ?? TYPE_COLORS.Other
                      }
                    >
                      {shutoff.utilityType}
                    </Badge>
                    <p className="font-medium">{shutoff.location}</p>
                    {shutoff.roomName && (
                      <p className="text-sm text-muted-foreground">
                        Room: {shutoff.roomName}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Delete"
                    onClick={() => setDeleteTarget(shutoff)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {shutoff.procedure && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">
                      Procedure
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {shutoff.procedure}
                    </p>
                  </div>
                )}
                {shutoff.toolsNeeded && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">
                      Tools Needed
                    </p>
                    <p className="text-sm">{shutoff.toolsNeeded}</p>
                  </div>
                )}
                {shutoff.notes && (
                  <p className="text-sm text-muted-foreground italic">
                    {shutoff.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteShutoffDialog
          shutoff={deleteTarget}
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

function AddShutoffCard({
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
      const result = await createUtilityShutoffFn({
        data: {
          utilityType: String(f.get("utilityType") ?? "Water"),
          location: String(f.get("location") ?? ""),
          roomId: String(f.get("roomId") ?? ""),
          procedure: String(f.get("procedure") ?? ""),
          toolsNeeded: String(f.get("toolsNeeded") ?? ""),
          notes: String(f.get("notes") ?? ""),
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
      setError("Could not add shutoff location.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Shutoff Location</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-1">
            <Label htmlFor="us-type">Utility Type</Label>
            <select
              id="us-type"
              name="utilityType"
              className={selectClass}
              defaultValue="Water"
            >
              {UTILITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="us-location">Location</Label>
            <Input
              id="us-location"
              name="location"
              placeholder="e.g. Basement, near water heater"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="us-room">Room</Label>
            <select id="us-room" name="roomId" className={selectClass}>
              <option value="">Optional</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="us-procedure">Procedure</Label>
            <Textarea
              id="us-procedure"
              name="procedure"
              placeholder="Step-by-step instructions to shut off"
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="us-tools">Tools Needed</Label>
            <Input
              id="us-tools"
              name="toolsNeeded"
              placeholder="e.g. Wrench, key"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="us-notes">Notes</Label>
            <Input
              id="us-notes"
              name="notes"
              placeholder="Additional details"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Shutoff"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteShutoffDialog({
  shutoff,
  onClose,
  onDeleted,
}: {
  shutoff: UtilityShutoffRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteUtilityShutoffFn({ data: { id: shutoff.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete shutoff location.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {shutoff.utilityType} shutoff?
          </AlertDialogTitle>
          <AlertDialogDescription>
            “{shutoff.location}” will be permanently removed.
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
