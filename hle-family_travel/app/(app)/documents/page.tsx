import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { getHouseholdMembers } from "@/lib/household-members";
import { DocumentsList } from "@/components/documents-list";

export default async function DocumentsPage() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const [documents, trips, householdMembers] = await Promise.all([
    prisma.travelDocument.findMany({
      where: { householdId },
      orderBy: [{ type: "asc" }, { expiryDate: "asc" }],
      include: { trip: { select: { id: true, name: true } } },
    }),
    prisma.trip.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getHouseholdMembers(householdId),
  ]);

  const serializedDocs = documents.map((d) => ({
    ...d,
    issueDate: d.issueDate?.toISOString() ?? null,
    expiryDate: d.expiryDate?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    trip: d.trip ? { id: d.trip.id, name: d.trip.name } : null,
  }));

  return (
    <DocumentsList
      documents={serializedDocs}
      trips={trips}
      householdMembers={householdMembers}
    />
  );
}
