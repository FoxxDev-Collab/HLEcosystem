import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Phone, Plus, Trash2 } from "lucide-react"
import {
  createHealthEmergencyContactFn,
  deleteHealthEmergencyContactFn,
  getEmergencyContactsPageFn,
} from "@/server/health/fns.emergency-contacts"
import type { HealthEmergencyContactRow } from "@/server/health/emergency-contacts"
import type { HealthMemberOption } from "@/server/health/medications"
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

export const Route = createFileRoute("/_authed/health/emergency-contacts")({
  loader: () => getEmergencyContactsPageFn(),
  component: EmergencyContactsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function EmergencyContactsPage() {
  const { members, contacts } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] =
    useState<HealthEmergencyContactRow | null>(null)

  // Group by member (legacy grouping; contacts arrive priority-sorted).
  const byMember = new Map<string, Array<HealthEmergencyContactRow>>()
  for (const c of contacts) {
    const name = `${c.memberFirstName} ${c.memberLastName}`
    const existing = byMember.get(name) ?? []
    existing.push(c)
    byMember.set(name, existing)
  }

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Emergency Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Who to call for each family member, in priority order.
        </p>
      </div>

      <AddContactCard members={members} onSaved={refresh} />

      {Array.from(byMember.entries()).map(([name, list]) => (
        <Card key={name}>
          <CardHeader>
            <CardTitle className="text-base">{name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {list.map((ec) => (
                <div
                  key={ec.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{ec.priority}
                      </Badge>
                      <span className="text-sm font-medium">{ec.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({ec.relationship})
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <Phone className="mr-1 inline size-3" />
                      {ec.phoneNumber}
                      {ec.alternatePhone && ` · Alt: ${ec.alternatePhone}`}
                      {ec.email && ` · ${ec.email}`}
                    </div>
                    {ec.address && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ec.address}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Delete"
                    onClick={() => setDeleteTarget(ec)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {contacts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="mx-auto mb-3 size-10 opacity-40" />
            <p>No emergency contacts yet.</p>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteContactDialog
          contact={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function AddContactCard({
  members,
  onSaved,
}: {
  members: Array<HealthMemberOption>
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
      const result = await createHealthEmergencyContactFn({
        data: {
          memberId: String(f.get("memberId") ?? ""),
          name: String(f.get("name") ?? ""),
          relationship: String(f.get("relationship") ?? ""),
          phoneNumber: String(f.get("phoneNumber") ?? ""),
          alternatePhone: String(f.get("alternatePhone") ?? ""),
          email: String(f.get("email") ?? ""),
          address: String(f.get("address") ?? ""),
          priority: Number(f.get("priority") ?? 1) || 1,
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
      setError("Could not add contact.")
      setPending(false)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Enable health tracking for a family member first to add emergency
          contacts.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Emergency Contact</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="hec-member">For Family Member</Label>
            <select
              id="hec-member"
              name="memberId"
              className={selectClass}
              defaultValue={members[0]?.id}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="hec-name">Contact Name</Label>
            <Input id="hec-name" name="name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hec-relationship">Relationship</Label>
            <Input
              id="hec-relationship"
              name="relationship"
              placeholder="e.g. Mother, Friend"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hec-phone">Phone</Label>
            <Input id="hec-phone" name="phoneNumber" type="tel" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hec-altPhone">Alternate Phone</Label>
            <Input id="hec-altPhone" name="alternatePhone" type="tel" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hec-email">Email</Label>
            <Input id="hec-email" name="email" type="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hec-address">Address</Label>
            <Input id="hec-address" name="address" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hec-priority">Priority</Label>
            <Input
              id="hec-priority"
              name="priority"
              type="number"
              min="1"
              max="10"
              defaultValue="1"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Contact"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteContactDialog({
  contact,
  onClose,
  onDeleted,
}: {
  contact: HealthEmergencyContactRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteHealthEmergencyContactFn({
        data: { id: contact.id },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete contact.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {contact.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This emergency contact will be permanently removed.
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
