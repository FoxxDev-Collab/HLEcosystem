import { useMemo, useState } from "react"
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  Globe,
  Plus,
  Search,
  UserPlus,
  UserRoundPlus,
  Users,
} from "lucide-react"
import {
  createPersonFn,
  getPeoplePageFn,
  syncHouseholdMemberFn,
} from "@/server/hub/fns.people"
import type { FamilyMemberRow, Relationship } from "@/server/hub/people"
import { formatAge, formatDateLong } from "@/lib/format"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authed/hub/people/")({
  loader: () => getPeoplePageFn(),
  component: PeoplePage,
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

type SectionFilter = "ALL" | "HOUSEHOLD" | "CONTACTS" | "HOLIDAY"

function PeoplePage() {
  const {
    members,
    unlinkedHouseholdMembers,
    relative,
    crossHousehold,
    viewerUserId,
  } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<SectionFilter>("ALL")
  const [syncError, setSyncError] = useState<string | null>(null)

  const relativeMap = useMemo(
    () => new Map(relative.map((r) => [r.memberId, r.relationType])),
    [relative]
  )

  // Viewer-relative relation from the family tree wins over the static field.
  function displayRel(m: FamilyMemberRow): Relationship | null {
    return relativeMap.get(m.id) ?? m.relationship
  }

  function matches(m: FamilyMemberRow): boolean {
    if (filter === "HOLIDAY" && !m.includeInHolidayCards) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [
      `${m.firstName} ${m.lastName}`,
      m.nickname,
      m.email,
      m.phone,
      m.city,
      m.state,
    ]
      .filter((v): v is string => v !== null)
      .some((v) => v.toLowerCase().includes(q))
  }

  const linkedMembers = members.filter(
    (m) => m.linkedUserId && m.isActive && matches(m)
  )
  const standaloneMembers = members.filter((m) => !m.linkedUserId && matches(m))
  const visibleCross = crossHousehold.filter((m) => {
    const q = query.trim().toLowerCase()
    return !q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
  })
  const crossGroups = useMemo(() => {
    const byHousehold = new Map<string, typeof visibleCross>()
    for (const m of visibleCross) {
      const group = byHousehold.get(m.householdName) ?? []
      group.push(m)
      byHousehold.set(m.householdName, group)
    }
    return [...byHousehold.entries()]
  }, [visibleCross])

  const totalLinked = members.filter((m) => m.linkedUserId && m.isActive).length
  const totalStandalone = members.filter((m) => !m.linkedUserId).length

  async function addHouseholdMember(userId: string) {
    setSyncError(null)
    try {
      const result = await syncHouseholdMemberFn({ data: { userId } })
      if ("error" in result && typeof result.error === "string") {
        setSyncError(result.error)
        return
      }
      if ("id" in result) {
        navigate({ to: "/hub/people/$id", params: { id: result.id } })
      }
    } catch {
      setSyncError("Could not add household member.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} contact{members.length !== 1 ? "s" : ""} ·{" "}
            {totalLinked} household · {totalStandalone} other
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add person
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, nickname, email, phone, or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as SectionFilter)}
          className={`${selectClass} sm:w-52`}
        >
          <option value="ALL">All people</option>
          <option value="HOUSEHOLD">Household members</option>
          <option value="CONTACTS">Other contacts</option>
          <option value="HOLIDAY">Holiday card list</option>
        </select>
      </div>

      {syncError && <p className="text-sm text-destructive">{syncError}</p>}

      {unlinkedHouseholdMembers.length > 0 && filter !== "CONTACTS" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Members not yet added to People
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {unlinkedHouseholdMembers.map((hm) => {
                const isMe = hm.userId === viewerUserId
                return (
                  <div
                    key={hm.userId}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      isMe ? "border-primary/40 bg-primary/5" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">
                          {hm.displayName}
                        </p>
                        {isMe && <Badge>You</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {hm.email}
                      </p>
                    </div>
                    <Button
                      variant={isMe ? "default" : "outline"}
                      size="sm"
                      className="ml-2 shrink-0"
                      onClick={() => addHouseholdMember(hm.userId)}
                    >
                      <UserPlus className="size-3.5" />
                      {isMe ? "Add yourself" : "Add"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {filter !== "CONTACTS" && linkedMembers.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Household Members</h2>
            <span className="text-xs text-muted-foreground">
              {linkedMembers.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {linkedMembers.map((m) => (
              <PersonCard
                key={m.id}
                member={m}
                isMe={m.linkedUserId === viewerUserId}
                relation={displayRel(m)}
                householdBadge
              />
            ))}
          </div>
        </section>
      )}

      {filter !== "CONTACTS" &&
        unlinkedHouseholdMembers.length === 0 &&
        linkedMembers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No household members.{" "}
            <Link
              to="/manager/households"
              className="text-primary hover:underline"
            >
              Add members in the Manager
            </Link>
            .
          </p>
        )}

      {filter !== "HOUSEHOLD" && standaloneMembers.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <UserRoundPlus className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Other Contacts</h2>
            <span className="text-xs text-muted-foreground">
              {standaloneMembers.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {standaloneMembers.map((m) => (
              <PersonCard
                key={m.id}
                member={m}
                isMe={false}
                relation={displayRel(m)}
              />
            ))}
          </div>
        </section>
      )}

      {filter !== "HOUSEHOLD" && totalStandalone === 0 && (
        <p className="text-sm text-muted-foreground">
          No other contacts yet. Add relatives and friends to track birthdays,
          addresses, and gifts.
        </p>
      )}

      {filter === "ALL" && crossGroups.length > 0 && (
        <section>
          <div className="mb-1 flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">
              Family from Other Households
            </h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Connected via your family tree.{" "}
            <Link
              to="/hub/tree/manage"
              className="text-primary hover:underline"
            >
              Manage connections
            </Link>
          </p>
          {crossGroups.map(([householdName, group]) => (
            <div key={householdName} className="mb-4 space-y-2">
              <Badge variant="secondary">{householdName}</Badge>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((m) => (
                  <Link key={m.id} to="/hub/people/$id" params={{ id: m.id }}>
                    <Card className="h-full cursor-pointer transition-colors hover:border-primary/40">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {m.firstName} {m.lastName}
                            </p>
                            {m.birthday && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatDateLong(m.birthday)} (Age{" "}
                                {formatAge(m.birthday)})
                              </p>
                            )}
                          </div>
                          {relativeMap.get(m.id) && (
                            <Badge variant="outline">
                              {formatRelationship(relativeMap.get(m.id) ?? "")}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {createOpen && (
        <CreatePersonDialog
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

function PersonCard({
  member,
  isMe,
  relation,
  householdBadge = false,
}: {
  member: FamilyMemberRow
  isMe: boolean
  relation: Relationship | null
  householdBadge?: boolean
}) {
  return (
    <Link to="/hub/people/$id" params={{ id: member.id }}>
      <Card
        className={`h-full cursor-pointer transition-colors hover:border-primary/40 ${
          !member.isActive ? "opacity-60" : ""
        } ${isMe ? "ring-1 ring-primary/30" : ""}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold">
                  {member.firstName} {member.lastName}
                </p>
                {isMe && <Badge>You</Badge>}
                {!member.isActive && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              {member.nickname && (
                <p className="truncate text-xs text-muted-foreground">
                  “{member.nickname}”
                </p>
              )}
              {member.birthday && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateLong(member.birthday)} (Age{" "}
                  {formatAge(member.birthday)})
                </p>
              )}
              {(member.phone || member.email) && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {member.phone || member.email}
                </p>
              )}
              {!householdBadge && member.city && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[member.city, member.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {householdBadge && <Badge>Household</Badge>}
              {relation && (
                <Badge variant="outline">{formatRelationship(relation)}</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function CreatePersonDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [holidayCards, setHolidayCards] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await createPersonFn({
        data: {
          firstName: text("firstName"),
          lastName: text("lastName"),
          nickname: text("nickname"),
          relationshipNotes: "",
          birthday: text("birthday"),
          anniversary: text("anniversary"),
          phone: text("phone"),
          email: text("email"),
          preferredContactMethod: text("preferredContactMethod") as
            "NONE" | "PHONE" | "EMAIL" | "TEXT",
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
      onSaved()
    } catch {
      setError("Could not add person.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>
            A contact in your People directory — birthdays and anniversaries
            sync to your important dates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="p-firstName">First name *</Label>
              <Input id="p-firstName" name="firstName" required autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-lastName">Last name *</Label>
              <Input id="p-lastName" name="lastName" required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-nickname">Nickname</Label>
            <Input id="p-nickname" name="nickname" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="p-birthday">Birthday</Label>
              <Input id="p-birthday" name="birthday" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-anniversary">Anniversary</Label>
              <Input id="p-anniversary" name="anniversary" type="date" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="p-phone">Phone</Label>
              <Input id="p-phone" name="phone" type="tel" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" name="email" type="email" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-contact">Preferred contact</Label>
            <select
              id="p-contact"
              name="preferredContactMethod"
              className={selectClass}
              defaultValue="NONE"
            >
              {CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label htmlFor="p-address1">Address</Label>
            <Input id="p-address1" name="addressLine1" placeholder="Line 1" />
          </div>
          <Input name="addressLine2" placeholder="Line 2" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="city" placeholder="City" />
            <Input name="state" placeholder="State" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input name="zipCode" placeholder="Zip" />
            <Input name="country" placeholder="Country" />
          </div>

          <Separator />

          <div className="space-y-1">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea id="p-notes" name="notes" rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="p-holidayCards"
              checked={holidayCards}
              onCheckedChange={(checked) => setHolidayCards(checked === true)}
            />
            <Label htmlFor="p-holidayCards" className="font-normal">
              Include in holiday card list
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
