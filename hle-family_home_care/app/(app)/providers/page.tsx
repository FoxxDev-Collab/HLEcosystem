import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, HardHat, Star } from "lucide-react";
import { createProviderAction, deleteProviderAction } from "./actions";

const SPECIALTIES = [
  "HVAC", "PLUMBING", "ELECTRICAL", "APPLIANCE_REPAIR", "GENERAL_CONTRACTOR",
  "LANDSCAPING", "PEST_CONTROL", "ROOFING", "PAINTING", "FLOORING",
  "AUTO_MECHANIC", "AUTO_BODY", "AUTO_DEALER", "CLEANING", "LOCKSMITH",
  "HANDYMAN", "OTHER",
];

export default async function ProvidersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const providers = await prisma.serviceProvider.findMany({
    where: { householdId },
    include: { _count: { select: { repairs: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Service Providers</h1>

      <Card>
        <CardHeader><CardTitle>Add Provider</CardTitle></CardHeader>
        <CardContent>
          <form action={createProviderAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="Contact name" required />
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Input name="company" placeholder="Business name" />
            </div>
            <div className="space-y-1">
              <Label>Specialty</Label>
              <Select name="specialty" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input name="phone" type="tel" placeholder="(555) 123-4567" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="email@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Rating (1-5)</Label>
              <Input name="rating" type="number" min="1" max="5" placeholder="1-5" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Optional notes" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add</Button>
          </form>
        </CardContent>
      </Card>

      {providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <HardHat className="size-10 mx-auto mb-3 opacity-40" />
            <p>No service providers yet. Add your contractors, mechanics, and repair contacts.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>All Providers ({providers.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-center">Repairs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.company || "\u2014"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.specialty.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.phone || "\u2014"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email || "\u2014"}</TableCell>
                    <TableCell>
                      {p.rating ? (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: p.rating }).map((_, i) => (
                            <Star key={i} className="size-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{p._count.repairs}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteProviderAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                          <Trash2 className="size-3.5 text-red-500" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
