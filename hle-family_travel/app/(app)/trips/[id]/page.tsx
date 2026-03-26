import { notFound } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { getHouseholdMembers } from "@/lib/household-members";
import { TripDetailTabs } from "@/components/trip-detail-tabs";
import type { HouseholdMember } from "@/lib/household-members";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const { id } = await params;

  const trip = await prisma.trip.findFirst({
    where: { id, householdId },
    include: {
      travelers: { orderBy: { createdAt: "asc" } },
      itineraryDays: {
        orderBy: { date: "asc" },
        include: {
          activities: { orderBy: { sortOrder: "asc" } },
        },
      },
      reservations: { orderBy: { startDateTime: "asc" } },
      packingLists: {
        orderBy: { createdAt: "asc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
      budgetItems: { orderBy: { createdAt: "asc" } },
      contacts: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!trip) notFound();

  const householdMembers = await getHouseholdMembers(householdId);

  // Serialize for client component (Decimal -> number, Date -> string)
  const serializedTrip = {
    ...trip,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    travelers: trip.travelers.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
    itineraryDays: trip.itineraryDays.map((d) => ({
      ...d,
      date: d.date.toISOString(),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      activities: d.activities.map((a) => ({
        ...a,
        cost: a.cost ? Number(a.cost) : null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    })),
    reservations: trip.reservations.map((r) => ({
      ...r,
      startDateTime: r.startDateTime?.toISOString() ?? null,
      endDateTime: r.endDateTime?.toISOString() ?? null,
      cost: r.cost ? Number(r.cost) : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    packingLists: trip.packingLists.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      items: l.items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
    })),
    budgetItems: trip.budgetItems.map((b) => ({
      ...b,
      plannedAmount: Number(b.plannedAmount),
      actualAmount: b.actualAmount ? Number(b.actualAmount) : null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
    contacts: trip.contacts.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  };

  return (
    <TripDetailTabs
      trip={serializedTrip}
      householdMembers={householdMembers as HouseholdMember[]}
    />
  );
}
