import { useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Gift,
  Home,
  Lightbulb,
  Link2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react"
import {
  addAddressFn,
  addCareerEntryFn,
  deleteAddressFn,
  deleteCareerEntryFn,
  deletePersonFn,
  getPersonFn,
  togglePersonActiveFn,
  updatePersonFn,
} from "@/server/hub/fns.people"
import type {
  AddressRow,
  CareerEntryRow,
  FamilyMemberRow,
} from "@/server/hub/people"
import {
  formatAge,
  formatCurrency,
  formatDate,
  toDateInputValue,
} from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authed/hub/people/$id")({
  loader: async ({ params }) => {
    const data = await getPersonFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: PersonDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const CONTACT_METHODS = ["NONE", "PHONE", "EMAIL", "TEXT"] as const

const RELATIONSHIP_LABELS: Record<string, string> = {
  AuntUncle: "Aunt / Uncle",
  NieceNephew: "Niece / Nephew",
  InLaw: "In-Law",
  StepParent: "Step-Parent",
  StepChild: "Step-Child",
  StepSibling: "Step-Sibling",
}

function formatRelationship(rel: string): string {
  return RELATIONSHIP_LABELS[rel] ?? rel
}

const GIFT_STATUS_COLORS: Record<string, string> = {
  IDEA: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PURCHASED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  WRAPPED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  GIVEN: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
}

const DATE_TYPE_COLORS: Record<string, string> = {
  BIRTHDAY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ANNIVERSARY: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  GRADUATION:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  MEMORIAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  HOLIDAY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  CUSTOM:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
}

function PersonDetailPage() {
  const {
    member,
    addresses,
    careerEntries,
    relations,
    importantDates,
    gifts,
    giftIdeas,
    relative,
    viewerUserId,
    householdId,
  } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  const [addAddressOpen, setAddAddressOpen] = useState(false)
  const [addCareerOpen, setAddCareerOpen] = useState(false)
  const [deleteAddressTarget, setDeleteAddressTarget] =
    useState<AddressRow | null>(null)
  const [deleteCareerTarget, setDeleteCareerTarget] =
    useState<CareerEntryRow | null>(null)
  const [deletePersonOpen, setDeletePersonOpen] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const relativeMap = new Map(relative.map((r) => [r.memberId, r.relationType]))
  const displayRel = relativeMap.get(member.id) ?? member.relationship
  const isMe = member.linkedUserId === viewerUserId
  const age = formatAge(member.birthday)
  const currentAddress = addresses.find((a) => a.isCurrent) ?? null
  const previousAddresses = addresses.filter((a) => !a.isCurrent)
  const currentJob = careerEntries.find((c) => c.isCurrent) ?? null
  const previousJobs = careerEntries.filter((c) => !c.isCurrent)

  function refresh() {
    router.invalidate()
  }

  async function toggleActive() {
    setToggleError(null)
    try {
      const result = await togglePersonActiveFn({ data: { id: member.id } })
      if ("error" in result && typeof result.error === "string") {
        setToggleError(result.error)
        return
      }
      refresh()
    } catch {
      setToggleError("Could not update status.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link to="/hub/people" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {isMe ? "Your Profile" : `${member.firstName} ${member.lastName}`}
            </h1>
            {isMe && <Badge>You</Badge>}
            {member.linkedUserId && !isMe && <Badge>Household</Badge>}
            {!member.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            {isMe && (
              <span className="text-sm text-muted-foreground">
                {member.firstName} {member.lastName}
              </span>
            )}
            {displayRel && (
              <Badge variant="outline">{formatRelationship(displayRel)}</Badge>
            )}
            {age !== null && (
              <span className="text-xs text-muted-foreground">Age {age}</span>
            )}
            {currentJob && (
              <span className="text-xs text-muted-foreground">
                {currentJob.title
                  ? `${currentJob.title} at ${currentJob.employer}`
                  : currentJob.employer}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <EditPersonCard member={member} isMe={isMe} onSaved={refresh} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="size-4" /> Address History
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddAddressOpen(true)}
                >
                  <Plus className="size-3.5" /> Add address
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentAddress && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Home className="size-3 text-primary" />
                        <span className="text-xs font-semibold">Current</span>
                        {currentAddress.label && (
                          <Badge variant="outline">
                            {currentAddress.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{currentAddress.addressLine1}</p>
                      {currentAddress.addressLine2 && (
                        <p className="text-sm">{currentAddress.addressLine2}</p>
                      )}
                      <p className="text-sm">
                        {[
                          currentAddress.city,
                          currentAddress.state,
                          currentAddress.zipCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        {currentAddress.country && ` ${currentAddress.country}`}
                      </p>
                      {currentAddress.moveInDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Since {formatDate(currentAddress.moveInDate)}
                        </p>
                      )}
                      {currentAddress.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {currentAddress.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete address"
                      onClick={() => setDeleteAddressTarget(currentAddress)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}

              {previousAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Previous
                  </p>
                  {previousAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="rounded-lg border border-dashed p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          {addr.label && (
                            <Badge variant="outline" className="mb-1">
                              {addr.label}
                            </Badge>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {addr.addressLine1}
                          </p>
                          {addr.addressLine2 && (
                            <p className="text-sm text-muted-foreground">
                              {addr.addressLine2}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {[addr.city, addr.state, addr.zipCode]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {(addr.moveInDate || addr.moveOutDate) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {addr.moveInDate && formatDate(addr.moveInDate)}
                              {addr.moveInDate && addr.moveOutDate && " — "}
                              {addr.moveOutDate && formatDate(addr.moveOutDate)}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete address"
                          onClick={() => setDeleteAddressTarget(addr)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addresses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No addresses tracked yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="size-4" /> Career History
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddCareerOpen(true)}
                >
                  <Plus className="size-3.5" /> Add position
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentJob && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Building2 className="size-3 text-primary" />
                        <span className="text-xs font-semibold">
                          Current Position
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        {currentJob.title || "Employee"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currentJob.employer}
                      </p>
                      {currentJob.department && (
                        <p className="text-xs text-muted-foreground">
                          {currentJob.department}
                        </p>
                      )}
                      {currentJob.location && (
                        <p className="text-xs text-muted-foreground">
                          {currentJob.location}
                        </p>
                      )}
                      {currentJob.startDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Since {formatDate(currentJob.startDate)}
                        </p>
                      )}
                      {currentJob.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {currentJob.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete position"
                      onClick={() => setDeleteCareerTarget(currentJob)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}

              {previousJobs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Previous
                  </p>
                  {previousJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-dashed p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {job.title || "Employee"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {job.employer}
                          </p>
                          {job.department && (
                            <p className="text-xs text-muted-foreground">
                              {job.department}
                            </p>
                          )}
                          {job.location && (
                            <p className="text-xs text-muted-foreground">
                              {job.location}
                            </p>
                          )}
                          {(job.startDate || job.endDate) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {job.startDate && formatDate(job.startDate)}
                              {job.startDate && job.endDate && " — "}
                              {job.endDate && formatDate(job.endDate)}
                            </p>
                          )}
                          {job.notes && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {job.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete position"
                          onClick={() => setDeleteCareerTarget(job)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {careerEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No positions tracked yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="size-4" /> Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relations.length > 0 ? (
                <div className="mb-3 space-y-2">
                  {relations.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="shrink-0">
                        {formatRelationship(r.relationType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">of</span>
                      <Link
                        to="/hub/people/$id"
                        params={{ id: r.toMemberId }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {r.toFirstName} {r.toLastName}
                      </Link>
                      {r.toHouseholdId !== householdId && (
                        <Badge variant="secondary" className="shrink-0">
                          Other
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-xs text-muted-foreground">
                  No connections defined yet.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                render={<Link to="/hub/tree/manage" />}
              >
                Manage Connections
              </Button>
            </CardContent>
          </Card>

          {importantDates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="size-4" /> Important Dates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {importantDates.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm">{d.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(d.date)}
                        </p>
                      </div>
                      <Badge className={DATE_TYPE_COLORS[d.type]}>
                        {d.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {gifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Gift className="size-4" /> Gift History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {gifts.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm">{g.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.occasion && `${g.occasion} · `}
                          {g.actualCost !== null
                            ? formatCurrency(g.actualCost)
                            : g.estimatedCost !== null
                              ? `~${formatCurrency(g.estimatedCost)}`
                              : ""}
                        </p>
                      </div>
                      <Badge className={GIFT_STATUS_COLORS[g.status]}>
                        {g.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {giftIdeas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="size-4" /> Gift Ideas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {giftIdeas.map((gi) => (
                    <div
                      key={gi.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm">{gi.idea}</p>
                        <p className="text-xs text-muted-foreground">
                          {gi.estimatedCost !== null &&
                            formatCurrency(gi.estimatedCost)}
                          {gi.source && ` · From: ${gi.source}`}
                        </p>
                      </div>
                      <Badge
                        variant={
                          gi.priority === "HIGH"
                            ? "destructive"
                            : gi.priority === "MEDIUM"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {gi.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-destructive">
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {member.isActive
                    ? "Deactivate to hide this person from lists without deleting their history."
                    : "Reactivate to show this person in lists again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={toggleActive}
                >
                  {member.isActive ? "Deactivate" : "Reactivate"}
                </Button>
                {toggleError && (
                  <p className="mt-2 text-sm text-destructive">{toggleError}</p>
                )}
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {isMe
                    ? "Remove yourself from the People directory. Your account will not be affected."
                    : "Permanently delete this person and all associated data."}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setDeletePersonOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  {isMe ? "Remove from People" : "Delete Person"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {addAddressOpen && (
        <AddAddressDialog
          familyMemberId={member.id}
          onClose={() => setAddAddressOpen(false)}
          onSaved={() => {
            setAddAddressOpen(false)
            refresh()
          }}
        />
      )}
      {addCareerOpen && (
        <AddCareerDialog
          familyMemberId={member.id}
          onClose={() => setAddCareerOpen(false)}
          onSaved={() => {
            setAddCareerOpen(false)
            refresh()
          }}
        />
      )}
      {deleteAddressTarget && (
        <ConfirmDeleteDialog
          title="Delete this address?"
          description={`${deleteAddressTarget.addressLine1}, ${deleteAddressTarget.city} will be removed from the address history.`}
          onConfirm={() =>
            deleteAddressFn({ data: { id: deleteAddressTarget.id } })
          }
          onClose={() => setDeleteAddressTarget(null)}
          onDone={() => {
            setDeleteAddressTarget(null)
            refresh()
          }}
        />
      )}
      {deleteCareerTarget && (
        <ConfirmDeleteDialog
          title="Delete this position?"
          description={`${deleteCareerTarget.employer} will be removed from the career history.`}
          onConfirm={() =>
            deleteCareerEntryFn({ data: { id: deleteCareerTarget.id } })
          }
          onClose={() => setDeleteCareerTarget(null)}
          onDone={() => {
            setDeleteCareerTarget(null)
            refresh()
          }}
        />
      )}
      {deletePersonOpen && (
        <ConfirmDeleteDialog
          title={
            isMe
              ? "Remove yourself from People?"
              : `Delete ${member.firstName} ${member.lastName}?`
          }
          description={
            isMe
              ? "Your account is not affected — only this People entry and its history are removed."
              : "This permanently deletes the person along with their addresses, career history, and gift records."
          }
          confirmLabel={isMe ? "Remove" : "Delete"}
          onConfirm={() => deletePersonFn({ data: { id: member.id } })}
          onClose={() => setDeletePersonOpen(false)}
          onDone={() => navigate({ to: "/hub/people" })}
        />
      )}
    </div>
  )
}

function EditPersonCard({
  member,
  isMe,
  onSaved,
}: {
  member: FamilyMemberRow
  isMe: boolean
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const [holidayCards, setHolidayCards] = useState(member.includeInHolidayCards)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await updatePersonFn({
        data: {
          id: member.id,
          firstName: text("firstName"),
          lastName: text("lastName"),
          nickname: text("nickname"),
          relationshipNotes: text("relationshipNotes"),
          birthday: text("birthday"),
          anniversary: text("anniversary"),
          phone: text("phone"),
          email: text("email"),
          preferredContactMethod: text("preferredContactMethod") as
            | "NONE"
            | "PHONE"
            | "EMAIL"
            | "TEXT",
          addressLine1: text("addressLine1"),
          addressLine2: text("addressLine2"),
          city: text("city"),
          state: text("state"),
          zipCode: text("zipCode"),
          country: text("country"),
          notes: text("notes"),
          includeInHolidayCards: holidayCards,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      setSaved(true)
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
        <CardTitle className="text-sm font-semibold">
          {isMe ? "Your Details" : "Personal Details"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-firstName">First name *</Label>
              <Input
                id="e-firstName"
                name="firstName"
                defaultValue={member.firstName}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-lastName">Last name *</Label>
              <Input
                id="e-lastName"
                name="lastName"
                defaultValue={member.lastName}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-nickname">Nickname</Label>
              <Input
                id="e-nickname"
                name="nickname"
                defaultValue={member.nickname ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-birthday">Birthday</Label>
              <Input
                id="e-birthday"
                name="birthday"
                type="date"
                defaultValue={toDateInputValue(member.birthday)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-anniversary">Wedding anniversary</Label>
              <Input
                id="e-anniversary"
                name="anniversary"
                type="date"
                defaultValue={toDateInputValue(member.anniversary)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-contact">Preferred contact</Label>
              <select
                id="e-contact"
                name="preferredContactMethod"
                defaultValue={member.preferredContactMethod}
                className={selectClass}
              >
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-phone">Phone</Label>
              <Input
                id="e-phone"
                name="phone"
                type="tel"
                defaultValue={member.phone ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">Email</Label>
              <Input
                id="e-email"
                name="email"
                type="email"
                defaultValue={member.email ?? ""}
              />
            </div>
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground">
            Quick address (also managed in Address History below)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-address1">Address line 1</Label>
              <Input
                id="e-address1"
                name="addressLine1"
                defaultValue={member.addressLine1 ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-address2">Address line 2</Label>
              <Input
                id="e-address2"
                name="addressLine2"
                defaultValue={member.addressLine2 ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              name="city"
              placeholder="City"
              defaultValue={member.city ?? ""}
            />
            <Input
              name="state"
              placeholder="State"
              defaultValue={member.state ?? ""}
            />
            <Input
              name="zipCode"
              placeholder="Zip"
              defaultValue={member.zipCode ?? ""}
            />
            <Input
              name="country"
              placeholder="Country"
              defaultValue={member.country ?? ""}
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="e-relNotes">Relationship notes</Label>
            <Textarea
              id="e-relNotes"
              name="relationshipNotes"
              rows={2}
              defaultValue={member.relationshipNotes ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-notes">Notes</Label>
            <Textarea
              id="e-notes"
              name="notes"
              rows={2}
              defaultValue={member.notes ?? ""}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="e-holidayCards"
              checked={holidayCards}
              onCheckedChange={(checked) => setHolidayCards(checked === true)}
            />
            <Label htmlFor="e-holidayCards" className="font-normal">
              Include in holiday card list
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
            {saved && (
              <span className="text-sm text-muted-foreground">Saved.</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function AddAddressDialog({
  familyMemberId,
  onClose,
  onSaved,
}: {
  familyMemberId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [isCurrent, setIsCurrent] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await addAddressFn({
        data: {
          familyMemberId,
          label: text("label"),
          addressLine1: text("addressLine1"),
          addressLine2: text("addressLine2"),
          city: text("city"),
          state: text("state"),
          zipCode: text("zipCode"),
          country: text("country"),
          isCurrent,
          moveInDate: text("moveInDate"),
          moveOutDate: text("moveOutDate"),
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
      setError("Could not add address.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add address</DialogTitle>
          <DialogDescription>
            Marking it current moves the existing current address into history.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="a-label">Label</Label>
              <Input
                id="a-label"
                name="label"
                placeholder="e.g. College, First apartment"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-line1">Address line 1 *</Label>
              <Input id="a-line1" name="addressLine1" required />
            </div>
          </div>
          <Input name="addressLine2" placeholder="Address line 2" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="city" placeholder="City *" required />
            <Input name="state" placeholder="State" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input name="zipCode" placeholder="Zip" />
            <Input name="country" placeholder="Country" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="a-moveIn">Move-in date</Label>
              <Input id="a-moveIn" name="moveInDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-moveOut">Move-out date</Label>
              <Input id="a-moveOut" name="moveOutDate" type="date" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="a-isCurrent"
              checked={isCurrent}
              onCheckedChange={(checked) => setIsCurrent(checked === true)}
            />
            <Label htmlFor="a-isCurrent" className="font-normal">
              Current address
            </Label>
          </div>
          <Textarea name="notes" placeholder="Notes" rows={2} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddCareerDialog({
  familyMemberId,
  onClose,
  onSaved,
}: {
  familyMemberId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [isCurrent, setIsCurrent] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await addCareerEntryFn({
        data: {
          familyMemberId,
          employer: text("employer"),
          title: text("title"),
          department: text("department"),
          startDate: text("startDate"),
          endDate: text("endDate"),
          isCurrent,
          location: text("location"),
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
      setError("Could not add position.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add position</DialogTitle>
          <DialogDescription>
            Marking it current closes out the existing current position.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="c-employer">Employer *</Label>
              <Input id="c-employer" name="employer" required autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-title">Job title</Label>
              <Input id="c-title" name="title" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="c-department">Department</Label>
              <Input id="c-department" name="department" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-location">Location</Label>
              <Input
                id="c-location"
                name="location"
                placeholder="e.g. Remote, Fort Meade, MD"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="c-start">Start date</Label>
              <Input id="c-start" name="startDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-end">End date</Label>
              <Input id="c-end" name="endDate" type="date" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="c-isCurrent"
              checked={isCurrent}
              onCheckedChange={(checked) => setIsCurrent(checked === true)}
            />
            <Label htmlFor="c-isCurrent" className="font-normal">
              Current position
            </Label>
          </div>
          <Textarea name="notes" placeholder="Notes" rows={2} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add position"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
  onDone,
}: {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => Promise<{ ok: true } | { error: string }>
  onClose: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await onConfirm()
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDone()
    } catch {
      setError("Something went wrong.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
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
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
