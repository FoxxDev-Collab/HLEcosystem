import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Phone } from "lucide-react";
import { createEmergencyContactAction, deleteEmergencyContactAction } from "./actions";

export default async function EmergencyContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const memberFilter = params.memberId ? { familyMemberId: params.memberId } : {};

  const [members, contacts] = await Promise.all([
    prisma.familyMember.findMany({ where: { householdId, isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.emergencyContact.findMany({
      where: { familyMember: { householdId }, ...memberFilter },
      include: { familyMember: true },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
    }),
  ]);

  // Group by member
  const byMember = new Map<string, typeof contacts>();
  for (const c of contacts) {
    const name = `${c.familyMember.firstName} ${c.familyMember.lastName}`;
    const existing = byMember.get(name) || [];
    existing.push(c);
    byMember.set(name, existing);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Emergency Contacts</h1>

      <Card>
        <CardHeader><CardTitle>Add Emergency Contact</CardTitle></CardHeader>
        <CardContent>
          <form action={createEmergencyContactAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>For Family Member</Label>
              <Select name="familyMemberId" defaultValue={params.memberId || members[0]?.id} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Contact Name</Label><Input name="name" required /></div>
            <div className="space-y-1"><Label>Relationship</Label><Input name="relationship" placeholder="e.g. Mother, Friend" required /></div>
            <div className="space-y-1"><Label>Phone</Label><Input name="phoneNumber" type="tel" required /></div>
            <div className="space-y-1"><Label>Alternate Phone</Label><Input name="alternatePhone" type="tel" /></div>
            <div className="space-y-1"><Label>Email</Label><Input name="email" type="email" /></div>
            <div className="space-y-1"><Label>Priority</Label><Input name="priority" type="number" min="1" max="10" defaultValue="1" /></div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Contact</Button>
          </form>
        </CardContent>
      </Card>

      {Array.from(byMember.entries()).map(([name, ecs]) => (
        <Card key={name}>
          <CardHeader><CardTitle className="text-base">{name}</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {ecs.map((ec) => (
                <div key={ec.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">#{ec.priority}</Badge>
                      <span className="text-sm font-medium">{ec.name}</span>
                      <span className="text-xs text-muted-foreground">({ec.relationship})</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <Phone className="size-3 inline mr-1" />{ec.phoneNumber}
                      {ec.alternatePhone && ` · Alt: ${ec.alternatePhone}`}
                      {ec.email && ` · ${ec.email}`}
                    </div>
                  </div>
                  <form action={deleteEmergencyContactAction}>
                    <input type="hidden" name="id" value={ec.id} />
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="size-3.5" /></Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {contacts.length === 0 && (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No emergency contacts yet.</p></CardContent></Card>
      )}
    </div>
  );
}
