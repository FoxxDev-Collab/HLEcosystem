import { useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft, CheckCircle2, Trash2 } from "lucide-react"
import {
  deleteEmergencyPlanFn,
  getEmergencyPlanFn,
  markPlanReviewedFn,
  updateEmergencyPlanFn,
} from "@/server/home-care/fns.emergency"
import type { EmergencyPlanType } from "@/server/home-care/emergency"
import { formatDate } from "@/lib/format"
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

export const Route = createFileRoute("/_authed/home-care/emergency/plans/$id")({
  loader: async ({ params }) => {
    const plan = await getEmergencyPlanFn({ data: { id: params.id } })
    if (!plan) throw notFound()
    return plan
  },
  component: PlanDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const PLAN_TYPES: Array<EmergencyPlanType> = [
  "FIRE",
  "FLOOD",
  "EARTHQUAKE",
  "TORNADO",
  "HURRICANE",
  "POWER_OUTAGE",
  "MEDICAL",
  "INTRUDER",
  "EVACUATION",
  "CUSTOM",
]

const PLAN_TYPE_COLORS: Record<EmergencyPlanType, string> = {
  FIRE: "bg-red-100 text-red-800",
  FLOOD: "bg-blue-100 text-blue-800",
  EARTHQUAKE: "bg-amber-100 text-amber-800",
  TORNADO: "bg-gray-100 text-gray-800",
  HURRICANE: "bg-cyan-100 text-cyan-800",
  POWER_OUTAGE: "bg-yellow-100 text-yellow-800",
  MEDICAL: "bg-green-100 text-green-800",
  INTRUDER: "bg-purple-100 text-purple-800",
  EVACUATION: "bg-orange-100 text-orange-800",
  CUSTOM: "bg-gray-100 text-gray-800",
}

// Review recommended when never reviewed or reviewed more than 6 months ago.
function needsReview(lastReviewed: string | null): boolean {
  if (!lastReviewed) return true
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const [y, m, d] = lastReviewed.split("-").map(Number)
  return new Date(y, m - 1, d) < sixMonthsAgo
}

function PlanDetailPage() {
  const plan = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reviewNeeded = needsReview(plan.lastReviewed)

  async function markReviewed() {
    setError(null)
    try {
      const result = await markPlanReviewedFn({ data: { id: plan.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Could not mark plan as reviewed.")
    }
  }

  const detailSections = [
    { label: "Description", value: plan.description, italic: false },
    { label: "Meeting Point", value: plan.meetingPoint, italic: false },
    { label: "Evacuation Route", value: plan.evacuationRoute, italic: false },
    { label: "Procedures", value: plan.procedures, italic: false },
    { label: "Notes", value: plan.notes, italic: true },
  ].filter((s) => s.value)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/home-care/emergency/plans">
          <Button variant="ghost" size="icon" title="Back to plans">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{plan.title}</h1>
          <Badge className={PLAN_TYPE_COLORS[plan.type]}>
            {plan.type.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className={reviewNeeded ? "border-amber-300" : "border-green-300"}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {reviewNeeded ? (
                <span className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="size-4" />
                  {plan.lastReviewed
                    ? `Last reviewed ${formatDate(plan.lastReviewed)} — review recommended`
                    : "This plan has never been reviewed"}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="size-4" />
                  Last reviewed {formatDate(plan.lastReviewed)}
                </span>
              )}
            </div>
            <Button
              variant={reviewNeeded ? "default" : "outline"}
              size="sm"
              onClick={markReviewed}
            >
              <CheckCircle2 className="size-3.5" />
              Mark as Reviewed
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailSections.map((s) => (
              <div key={s.label}>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  {s.label}
                </p>
                <p
                  className={`text-sm whitespace-pre-wrap ${s.italic ? "italic" : ""}`}
                >
                  {s.value}
                </p>
              </div>
            ))}
            {detailSections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No details added yet. Use the edit form to add plan details.
              </p>
            )}
          </CardContent>
        </Card>

        <EditPlanCard
          plan={plan}
          onSaved={() => router.invalidate()}
          onDelete={() => setDeleteOpen(true)}
        />
      </div>

      {deleteOpen && (
        <DeletePlanDialog
          planId={plan.id}
          planTitle={plan.title}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => navigate({ to: "/home-care/emergency/plans" })}
        />
      )}
    </div>
  )
}

function EditPlanCard({
  plan,
  onSaved,
  onDelete,
}: {
  plan: {
    id: string
    type: EmergencyPlanType
    title: string
    description: string | null
    meetingPoint: string | null
    evacuationRoute: string | null
    procedures: string | null
    reviewFrequencyMonths: number | null
    notes: string | null
  }
  onSaved: () => void
  onDelete: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const reviewMonths = String(f.get("reviewFrequencyMonths") ?? "").trim()
    try {
      const result = await updateEmergencyPlanFn({
        data: {
          id: plan.id,
          title: String(f.get("title") ?? ""),
          type: String(f.get("type") ?? "CUSTOM") as EmergencyPlanType,
          description: String(f.get("description") ?? ""),
          meetingPoint: String(f.get("meetingPoint") ?? ""),
          evacuationRoute: String(f.get("evacuationRoute") ?? ""),
          procedures: String(f.get("procedures") ?? ""),
          reviewFrequencyMonths: reviewMonths ? Number(reviewMonths) : null,
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      setPending(false)
      onSaved()
    } catch {
      setError("Could not save changes.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pe-title">Title</Label>
            <Input
              id="pe-title"
              name="title"
              defaultValue={plan.title}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-type">Type</Label>
            <select
              id="pe-type"
              name="type"
              className={selectClass}
              defaultValue={plan.type}
            >
              {PLAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-description">Description</Label>
            <Textarea
              id="pe-description"
              name="description"
              defaultValue={plan.description ?? ""}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-meeting">Meeting Point</Label>
            <Input
              id="pe-meeting"
              name="meetingPoint"
              defaultValue={plan.meetingPoint ?? ""}
              placeholder="e.g. Front yard by mailbox"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-route">Evacuation Route</Label>
            <Textarea
              id="pe-route"
              name="evacuationRoute"
              defaultValue={plan.evacuationRoute ?? ""}
              rows={2}
              placeholder="Describe exit routes"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-procedures">Procedures</Label>
            <Textarea
              id="pe-procedures"
              name="procedures"
              defaultValue={plan.procedures ?? ""}
              rows={4}
              placeholder="Step-by-step instructions"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-review">Review Frequency (months)</Label>
            <Input
              id="pe-review"
              name="reviewFrequencyMonths"
              type="number"
              min="1"
              defaultValue={plan.reviewFrequencyMonths ?? ""}
              placeholder="6"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-notes">Notes</Label>
            <Textarea
              id="pe-notes"
              name="notes"
              defaultValue={plan.notes ?? ""}
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
              Delete Plan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function DeletePlanDialog({
  planId,
  planTitle,
  onClose,
  onDeleted,
}: {
  planId: string
  planTitle: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteEmergencyPlanFn({ data: { id: planId } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete plan.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{planTitle}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This emergency plan will be permanently removed.
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
