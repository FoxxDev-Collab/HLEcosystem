import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdById } from "@/lib/household";
import { getRelativeRelationships } from "@/lib/relative-relationships";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { FamilyTreeView } from "@/components/family-tree-view";

export default async function FamilyTreePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = (await getCurrentHouseholdId())!;

  // Fetch linked households
  const linkedHouseholds = await prisma.linkedHousehold.findMany({
    where: { householdId },
  });
  const linkedHouseholdIds = linkedHouseholds.map((lh) => lh.linkedHouseholdId);
  const allHouseholdIds = [householdId, ...linkedHouseholdIds];

  // Fetch members and relations from all households
  const [members, relations] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId: { in: allHouseholdIds }, isActive: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.familyRelation.findMany({
      where: { householdId: { in: allHouseholdIds } },
    }),
  ]);

  // Build household name map for display
  const householdNames: Record<string, string> = {};
  if (linkedHouseholdIds.length > 0) {
    const households = await Promise.all(
      linkedHouseholdIds.map((id) => getHouseholdById(id))
    );
    for (const h of households) {
      if (h) householdNames[h.id] = h.name;
    }
  }

  // Compute relative relationships for the current user
  const relativeMap = await getRelativeRelationships(householdId, user.id, allHouseholdIds);
  const relativeRelationships: Record<string, string> = {};
  for (const [memberId, relType] of relativeMap) {
    relativeRelationships[memberId] = relType;
  }

  const membersData = members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    relationship: m.relationship as string | null,
    birthday: m.birthday?.toISOString() ?? null,
    linkedUserId: m.linkedUserId,
    householdId: m.householdId,
  }));

  const relationsData = relations.map((r) => ({
    id: r.id,
    fromMemberId: r.fromMemberId,
    toMemberId: r.toMemberId,
    relationType: r.relationType,
  }));

  const uniqueConnections = Math.floor(relations.length / 2);
  const householdCount = allHouseholdIds.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Family Tree</h1>
          <p className="text-muted-foreground">
            {members.length} people
            {householdCount > 1 ? ` from ${householdCount} households` : ""}
            , {uniqueConnections} connection{uniqueConnections !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/family-tree/manage">
            <Settings2 className="size-4 mr-2" />
            Manage Connections
          </Link>
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <FamilyTreeView
          members={membersData}
          relations={relationsData}
          currentUserId={user.id}
          currentHouseholdId={householdId}
          householdNames={householdNames}
          relativeRelationships={relativeRelationships}
        />
      </div>
    </div>
  );
}
