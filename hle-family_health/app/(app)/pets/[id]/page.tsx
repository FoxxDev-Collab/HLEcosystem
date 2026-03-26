import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PetDetailTabs } from "@/components/pet-detail-tabs";

export default async function PetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const pet = await prisma.pet.findFirst({
    where: { id, householdId },
    include: {
      vaccinations: {
        orderBy: { dateAdministered: "desc" },
        include: { provider: true },
      },
      medications: {
        orderBy: [{ isActive: "desc" }, { medicationName: "asc" }],
      },
      appointments: {
        orderBy: { appointmentDateTime: "desc" },
        include: { provider: true },
      },
      conditions: {
        orderBy: [{ isOngoing: "desc" }, { conditionName: "asc" }],
      },
      insurances: {
        orderBy: [{ isActive: "desc" }, { providerName: "asc" }],
      },
    },
  });
  if (!pet) notFound();

  // Get veterinary providers for appointment form
  const vetProviders = await prisma.provider.findMany({
    where: { householdId, type: "VETERINARIAN", isActive: true },
    orderBy: { name: "asc" },
  });

  // Serialize Decimal and Date fields for client component
  const serializedPet = {
    ...pet,
    weightLbs: pet.weightLbs ? Number(pet.weightLbs) : null,
    dateOfBirth: pet.dateOfBirth?.toISOString() ?? null,
    adoptionDate: pet.adoptionDate?.toISOString() ?? null,
    createdAt: pet.createdAt.toISOString(),
    updatedAt: pet.updatedAt.toISOString(),
    vaccinations: pet.vaccinations.map((v) => ({
      ...v,
      dateAdministered: v.dateAdministered.toISOString(),
      nextDueDate: v.nextDueDate?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      provider: v.provider ? { id: v.provider.id, name: v.provider.name } : null,
    })),
    medications: pet.medications.map((m) => ({
      ...m,
      startDate: m.startDate?.toISOString() ?? null,
      endDate: m.endDate?.toISOString() ?? null,
      nextRefillDate: m.nextRefillDate?.toISOString() ?? null,
      costPerRefill: m.costPerRefill ? Number(m.costPerRefill) : null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    appointments: pet.appointments.map((a) => ({
      ...a,
      appointmentDateTime: a.appointmentDateTime.toISOString(),
      cost: a.cost ? Number(a.cost) : null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      provider: a.provider ? { id: a.provider.id, name: a.provider.name } : null,
    })),
    conditions: pet.conditions.map((c) => ({
      ...c,
      diagnosedDate: c.diagnosedDate?.toISOString() ?? null,
      resolvedDate: c.resolvedDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    insurances: pet.insurances.map((i) => ({
      ...i,
      monthlyPremium: i.monthlyPremium ? Number(i.monthlyPremium) : null,
      deductible: i.deductible ? Number(i.deductible) : null,
      annualLimit: i.annualLimit ? Number(i.annualLimit) : null,
      effectiveDate: i.effectiveDate?.toISOString() ?? null,
      expirationDate: i.expirationDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
  };

  const serializedProviders = vetProviders.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pets"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{pet.name}</h1>
          <p className="text-muted-foreground">
            {pet.species.replace(/_/g, " ")}
            {pet.breed && ` - ${pet.breed}`}
            {pet.gender && ` - ${pet.gender}`}
          </p>
        </div>
      </div>

      <PetDetailTabs pet={serializedPet} vetProviders={serializedProviders} />
    </div>
  );
}
