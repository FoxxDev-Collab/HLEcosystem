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
import { Plus, ExternalLink, Trash2, Pause, Play } from "lucide-react";
import { createProviderAction, toggleProviderActiveAction, deleteProviderAction } from "./actions";

const PROVIDER_TYPES = [
  "DOCTOR", "DENTIST", "OPTOMETRIST", "SPECIALIST", "HOSPITAL",
  "LAB", "PHARMACY", "THERAPIST", "CHIROPRACTOR", "OTHER",
];

export default async function ProvidersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const providers = await prisma.provider.findMany({
    where: { householdId },
    orderBy: [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }],
  });

  // Group by type
  const grouped = new Map<string, typeof providers>();
  for (const p of providers.filter((p) => p.isActive)) {
    const existing = grouped.get(p.type) || [];
    existing.push(p);
    grouped.set(p.type, existing);
  }
  const inactive = providers.filter((p) => !p.isActive);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Providers</h1>

      <Card>
        <CardHeader><CardTitle>Add Provider</CardTitle></CardHeader>
        <CardContent>
          <form action={createProviderAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="Dr. Smith" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue="DOCTOR">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Specialty</Label>
              <Input name="specialty" placeholder="e.g. Pediatrics" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input name="phoneNumber" type="tel" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Address</Label>
              <Input name="address" />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input name="website" type="url" placeholder="https://" />
            </div>
            <div className="space-y-1">
              <Label>Patient Portal</Label>
              <Input name="portalUrl" type="url" placeholder="https://" />
            </div>
            <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Provider</Button>
          </form>
        </CardContent>
      </Card>

      {/* Grouped by type */}
      {Array.from(grouped.entries()).map(([type, provs]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="text-base">{type.replace(/_/g, " ")} ({provs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {provs.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.specialty && <Badge variant="outline" className="text-xs">{p.specialty}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.phoneNumber}
                      {p.address && ` · ${p.address}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {p.portalUrl && (
                      <a href={p.portalUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="size-3.5" /></Button>
                      </a>
                    )}
                    <form action={toggleProviderActiveAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="isActive" value="true" />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7"><Pause className="size-3.5" /></Button>
                    </form>
                    <form action={deleteProviderAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="size-3.5" /></Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {inactive.length > 0 && (
        <Card className="opacity-50">
          <CardHeader><CardTitle className="text-base text-muted-foreground">Inactive ({inactive.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {inactive.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{p.name}</span>
                  <form action={toggleProviderActiveAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="isActive" value="false" />
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7"><Play className="size-3.5" /></Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {providers.length === 0 && (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No providers yet.</p></CardContent></Card>
      )}
    </div>
  );
}
