import { useState } from "react"
import { Globe, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react"
import type { TravelContactRow } from "@/server/travel/detail"
import {
  createTravelContactFn,
  deleteTravelContactFn,
} from "@/server/travel/fns.detail"
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
import { Textarea } from "@/components/ui/textarea"

export function TripContactsTab({
  tripId,
  contacts,
  onChanged,
}: {
  tripId: string
  contacts: Array<TravelContactRow>
  onChanged: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function remove(contactId: string) {
    setActionError(null)
    try {
      const result = await deleteTravelContactFn({ data: { id: contactId } })
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setActionError("Could not delete contact.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contacts ({contacts.length})</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" /> Add contact
        </Button>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No travel contacts yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.name}</span>
                      {contact.role && (
                        <Badge variant="outline" className="text-xs">
                          {contact.role}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" /> {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" /> {contact.email}
                        </span>
                      )}
                      {contact.website && (
                        <a
                          href={contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Globe className="size-3" /> Website
                        </a>
                      )}
                    </div>
                    {contact.address && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3" /> {contact.address}
                      </div>
                    )}
                    {contact.notes && (
                      <p className="text-xs text-muted-foreground">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete contact"
                    onClick={() => remove(contact.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {addOpen && (
        <AddContactDialog
          tripId={tripId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function AddContactDialog({
  tripId,
  onClose,
  onSaved,
}: {
  tripId: string
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
    try {
      const result = await createTravelContactFn({
        data: {
          tripId,
          name: String(f.get("name") ?? ""),
          role: String(f.get("role") ?? ""),
          phone: String(f.get("phone") ?? ""),
          email: String(f.get("email") ?? ""),
          address: String(f.get("address") ?? ""),
          website: String(f.get("website") ?? ""),
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add contact.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add travel contact</DialogTitle>
          <DialogDescription>
            Guides, concierges, emergency numbers — anyone you may need to reach
            during the trip.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input id="contact-name" name="name" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-role">Role</Label>
            <Input
              id="contact-role"
              name="role"
              placeholder="e.g., Tour Guide, Hotel Concierge"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" name="phone" type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" name="email" type="email" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-address">Address</Label>
            <Input id="contact-address" name="address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-website">Website</Label>
            <Input id="contact-website" name="website" type="url" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea id="contact-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
