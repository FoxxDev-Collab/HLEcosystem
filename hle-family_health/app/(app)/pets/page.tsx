import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatAge } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PawPrint, Plus } from "lucide-react";
import { createPetAction } from "./actions";

const SPECIES_OPTIONS = [
  "DOG", "CAT", "BIRD", "FISH", "REPTILE", "SMALL_MAMMAL", "HORSE", "OTHER",
];

const SPECIES_LABELS: Record<string, string> = {
  DOG: "Dog",
  CAT: "Cat",
  BIRD: "Bird",
  FISH: "Fish",
  REPTILE: "Reptile",
  SMALL_MAMMAL: "Small Mammal",
  HORSE: "Horse",
  OTHER: "Other",
};

export default async function PetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const pets = await prisma.pet.findMany({
    where: { householdId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          vaccinations: true,
          medications: { where: { isActive: true } },
          appointments: { where: { status: "SCHEDULED" } },
          conditions: { where: { isOngoing: true } },
          insurances: { where: { isActive: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Pets</h1>

      <Card>
        <CardHeader><CardTitle>Add Pet</CardTitle></CardHeader>
        <CardContent>
          <form action={createPetAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="Buddy" required />
            </div>
            <div className="space-y-1">
              <Label>Species</Label>
              <Select name="species" defaultValue="DOG">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIES_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{SPECIES_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Breed</Label>
              <Input name="breed" placeholder="e.g. Golden Retriever" />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input name="dateOfBirth" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select name="gender">
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Weight (lbs)</Label>
              <Input name="weightLbs" type="number" step="0.1" placeholder="0.0" />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input name="color" placeholder="e.g. Golden" />
            </div>
            <div className="space-y-1">
              <Label>Microchip ID</Label>
              <Input name="microchipId" placeholder="Optional" />
            </div>
            <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Pet</Button>
          </form>
        </CardContent>
      </Card>

      {pets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PawPrint className="size-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No pets yet. Add your first pet above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => {
            const age = formatAge(pet.dateOfBirth);
            return (
              <Link key={pet.id} href={`/pets/${pet.id}`}>
                <Card className={`hover:bg-accent/50 transition-colors cursor-pointer h-full ${!pet.isActive ? "opacity-50" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <PawPrint className="size-4" />
                        {pet.name}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {SPECIES_LABELS[pet.species] || pet.species}
                        </Badge>
                        {!pet.isActive && (
                          <Badge variant="outline" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {pet.breed && `${pet.breed} · `}
                      {age !== null ? `${age} year${age !== 1 ? "s" : ""} old` : "Age unknown"}
                      {pet.gender && ` · ${pet.gender}`}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {pet._count.medications > 0 && (
                        <Badge variant="outline" className="text-xs">{pet._count.medications} meds</Badge>
                      )}
                      {pet._count.appointments > 0 && (
                        <Badge variant="outline" className="text-xs">{pet._count.appointments} upcoming</Badge>
                      )}
                      {pet._count.vaccinations > 0 && (
                        <Badge variant="outline" className="text-xs">{pet._count.vaccinations} vaccines</Badge>
                      )}
                      {pet._count.conditions > 0 && (
                        <Badge variant="outline" className="text-xs">{pet._count.conditions} conditions</Badge>
                      )}
                      {pet._count.insurances > 0 && (
                        <Badge variant="outline" className="text-xs">Insured</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
