import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Phone, Plus, Trash2 } from "lucide-react"
import {
  createEmergencyContactFn,
  deleteEmergencyContactFn,
  getEmergencyContactsFn,
} from "@/server/home-care/fns.emergency"
import type {
  EmergencyContactRow,
  EmergencyContactType,
} from "@/server/home-care/emergency"
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

export const Route = createFileRoute("/_authed/home-care/emergency/contacts")({
  loader: () => getEmergencyContactsFn(),
  component: EmergencyContactsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const CONTACT_TYPES: Array<EmergencyContactType> = [
  "NEIGHBOR",
  "UTILITY",
  "LOCAL_SERVICE",
  "INSURANCE",
  "GOVERNMENT",
  "VETERINARIAN",
  "OTHER",
]

const TYPE_COLORS: Record<EmergencyContactType, string> = {
  NEIGHBOR: "bg-blue-100 text-blue-800",
  UTILITY: "bg-yellow-100 text-yellow-800",
  LOCAL_SERVICE: "bg-green-100 text-green-800",
  INSURANCE: "bg-purple-100 text-purple-800",
  GOVERNMENT: "bg-red-100 text-red-800",
  VETERINARIAN: "bg-teal-100 text-teal-800",
  OTHER: "bg-gray-100 text-gray-800",
}

function typeLabel(t: string): string {
  return t.replace(/_/g, " ")
}

function EmergencyContactsPage() {
  const contacts = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<EmergencyContactRow | null>(
    null
  )

  const grouped = CONTACT_TYPES.map((type) => ({
    type,
    items: contacts.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Emergency Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Neighbors, utilities, insurance, and other important contacts.
        </p>
      </div>

      <AddContactCard onSaved={() => router.invalidate()} />

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No emergency contacts yet. Add important contacts for your
              household.
            </p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(({ type, items }) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge className={TYPE_COLORS[type]}>{typeLabel(type)}</Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  ({items.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.name}</span>
                        {contact.priority > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Priority {contact.priority}
                          </Badge>
                        )}
                      </div>
                      {contact.company && (
                        <p className="text-sm text-muted-foreground">
                          {contact.company}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {contact.phone && <span>Phone: {contact.phone}</span>}
                        {contact.phoneAlt && (
                          <span>Alt: {contact.phoneAlt}</span>
                        )}
                        {contact.email && <span>Email: {contact.email}</span>}
                      </div>
                      {contact.address && (
                        <p className="text-sm text-muted-foreground">
                          {contact.address}
                        </p>
                      )}
                      {contact.accountNumber && (
                        <p className="text-sm text-muted-foreground">
                          Account: {contact.accountNumber}
                        </p>
                      )}
                      {contact.availableHours && (
                        <p className="text-sm text-muted-foreground">
                          Hours: {contact.availableHours}
                        </p>
                      )}
                      {contact.notes && (
                        <p className="text-sm text-muted-foreground italic">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteTarget(contact)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {deleteTarget && (
        <DeleteContactDialog
          contact={deleteTarget}
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

function AddContactCard({ onSaved }: { onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createEmergencyContactFn({
        data: {
          name: String(f.get("name") ?? ""),
          type: String(f.get("type") ?? "OTHER") as EmergencyContactType,
          company: String(f.get("company") ?? ""),
          phone: String(f.get("phone") ?? ""),
          phoneAlt: String(f.get("phoneAlt") ?? ""),
          email: String(f.get("email") ?? ""),
          address: String(f.get("address") ?? ""),
          accountNumber: String(f.get("accountNumber") ?? ""),
          availableHours: String(f.get("availableHours") ?? ""),
          priority: Number(f.get("priority") ?? 0) || 0,
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
      setError("Could not add contact.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Contact</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="ec-name">Name</Label>
            <Input
              id="ec-name"
              name="name"
              placeholder="Contact name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-type">Type</Label>
            <select
              id="ec-type"
              name="type"
              className={selectClass}
              defaultValue="OTHER"
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-company">Company</Label>
            <Input id="ec-company" name="company" placeholder="Organization" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-phone">Phone</Label>
            <Input
              id="ec-phone"
              name="phone"
              type="tel"
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-phoneAlt">Alt Phone</Label>
            <Input
              id="ec-phoneAlt"
              name="phoneAlt"
              type="tel"
              placeholder="Alternate number"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-email">Email</Label>
            <Input
              id="ec-email"
              name="email"
              type="email"
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-address">Address</Label>
            <Input
              id="ec-address"
              name="address"
              placeholder="Street address"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-account">Account #</Label>
            <Input
              id="ec-account"
              name="accountNumber"
              placeholder="Account number"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-hours">Available Hours</Label>
            <Input
              id="ec-hours"
              name="availableHours"
              placeholder="e.g. 24/7, M-F 9-5"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-priority">Priority (0-10)</Label>
            <Input
              id="ec-priority"
              name="priority"
              type="number"
              min="0"
              max="10"
              defaultValue="0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec-notes">Notes</Label>
            <Input
              id="ec-notes"
              name="notes"
              placeholder="Additional details"
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
  contact: EmergencyContactRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteEmergencyContactFn({
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
