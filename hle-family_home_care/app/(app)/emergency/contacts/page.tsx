import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone, Trash2, Pencil } from "lucide-react";
import {
  createEmergencyContactAction,
  updateEmergencyContactAction,
  deleteEmergencyContactAction,
} from "../actions";

const CONTACT_TYPES = [
  "NEIGHBOR",
  "UTILITY",
  "LOCAL_SERVICE",
  "INSURANCE",
  "GOVERNMENT",
  "VETERINARIAN",
  "OTHER",
];

const TYPE_COLORS: Record<string, string> = {
  NEIGHBOR: "bg-blue-100 text-blue-800",
  UTILITY: "bg-yellow-100 text-yellow-800",
  LOCAL_SERVICE: "bg-green-100 text-green-800",
  INSURANCE: "bg-purple-100 text-purple-800",
  GOVERNMENT: "bg-red-100 text-red-800",
  VETERINARIAN: "bg-teal-100 text-teal-800",
  OTHER: "bg-gray-100 text-gray-800",
};

export default async function EmergencyContactsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const contacts = await prisma.emergencyContact.findMany({
    where: { householdId },
    orderBy: [{ priority: "desc" }, { type: "asc" }, { name: "asc" }],
  });

  // Group by type
  const grouped = CONTACT_TYPES.reduce(
    (acc, type) => {
      const items = contacts.filter((c) => c.type === type);
      if (items.length > 0) acc[type] = items;
      return acc;
    },
    {} as Record<string, typeof contacts>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Emergency Contacts</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createEmergencyContactAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="Contact name" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Input name="company" placeholder="Organization" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input name="phone" type="tel" placeholder="(555) 123-4567" />
            </div>
            <div className="space-y-1">
              <Label>Alt Phone</Label>
              <Input name="phoneAlt" type="tel" placeholder="Alternate number" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="email@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input name="address" placeholder="Street address" />
            </div>
            <div className="space-y-1">
              <Label>Account #</Label>
              <Input name="accountNumber" placeholder="Account number" />
            </div>
            <div className="space-y-1">
              <Label>Available Hours</Label>
              <Input name="availableHours" placeholder="e.g. 24/7, M-F 9-5" />
            </div>
            <div className="space-y-1">
              <Label>Priority (0-10)</Label>
              <Input name="priority" type="number" min="0" max="10" defaultValue="0" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Additional details" />
            </div>
            <Button type="submit">
              <Plus className="size-4 mr-2" />Add Contact
            </Button>
          </form>
        </CardContent>
      </Card>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="size-10 mx-auto mb-3 opacity-40" />
            <p>No emergency contacts yet. Add important contacts for your household.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, items]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={TYPE_COLORS[type]}>{type.replace(/_/g, " ")}</Badge>
                <span className="text-muted-foreground text-sm font-normal">({items.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((contact) => (
                  <div key={contact.id} className="flex items-start justify-between border-b last:border-0 pb-4 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.name}</span>
                        {contact.priority > 0 && (
                          <Badge variant="outline" className="text-xs">Priority {contact.priority}</Badge>
                        )}
                      </div>
                      {contact.company && (
                        <p className="text-sm text-muted-foreground">{contact.company}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {contact.phone && <span>Phone: {contact.phone}</span>}
                        {contact.phoneAlt && <span>Alt: {contact.phoneAlt}</span>}
                        {contact.email && <span>Email: {contact.email}</span>}
                      </div>
                      {contact.address && (
                        <p className="text-sm text-muted-foreground">{contact.address}</p>
                      )}
                      {contact.accountNumber && (
                        <p className="text-sm text-muted-foreground">Account: {contact.accountNumber}</p>
                      )}
                      {contact.availableHours && (
                        <p className="text-sm text-muted-foreground">Hours: {contact.availableHours}</p>
                      )}
                      {contact.notes && (
                        <p className="text-sm text-muted-foreground italic">{contact.notes}</p>
                      )}
                    </div>
                    <form action={deleteEmergencyContactAction}>
                      <input type="hidden" name="id" value={contact.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                        <Trash2 className="size-3.5 text-red-500" />
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
