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

  // Step 1: Get current household members
  const currentMembers = await prisma.familyMember.findMany({
    where: { householdId, isActive: true },
    orderBy: { firstName: "asc" },
  });

  // Step 2: Get all relations owned by this household to discover cross-household members
  const currentRelations = await prisma.familyRelation.findMany({
    where: { householdId },
  });

  // Step 3: Find member IDs from other households referenced in relations
  const currentMemberIds = new Set(currentMembers.map((m) => m.id));
  const otherMemberIds = new Set<string>();
  for (const r of currentRelations) {
    if (!currentMemberIds.has(r.fromMemberId)) otherMemberIds.add(r.fromMemberId);
    if (!currentMemberIds.has(r.toMemberId)) otherMemberIds.add(r.toMemberId);
  }

  // Step 4: Fetch those other-household members and their inter-household relations
  let otherMembers: typeof currentMembers = [];
  let otherRelations: typeof currentRelations = [];
  if (otherMemberIds.size > 0) {
    otherMembers = await prisma.familyMember.findMany({
      where: { id: { in: [...otherMemberIds] }, isActive: true },
    });

    // Discover all household IDs involved
    const otherHouseholdIds = [...new Set(otherMembers.map((m) => m.householdId))];

    // Also fetch relations within those other households (so the tree is complete)
    if (otherHouseholdIds.length > 0) {
      otherRelations = await prisma.familyRelation.findMany({
        where: {
          householdId: { in: otherHouseholdIds },
          id: { notIn: currentRelations.map((r) => r.id) },
        },
      });

      // Check if other-household relations reference additional members we haven't loaded
      const allLoadedIds = new Set([...currentMemberIds, ...otherMemberIds]);
      const additionalIds = new Set<string>();
      for (const r of otherRelations) {
        if (!allLoadedIds.has(r.fromMemberId)) additionalIds.add(r.fromMemberId);
        if (!allLoadedIds.has(r.toMemberId)) additionalIds.add(r.toMemberId);
      }
      if (additionalIds.size > 0) {
        const additionalMembers = await prisma.familyMember.findMany({
          where: { id: { in: [...additionalIds] }, isActive: true },
        });
        otherMembers = [...otherMembers, ...additionalMembers];
      }
    }
  }

  const members = [...currentMembers, ...otherMembers];
  const relations = [...currentRelations, ...otherRelations];

  // Build household name map for non-current households
  const otherHouseholdIds = [...new Set(
    otherMembers.map((m) => m.householdId).filter((id) => id !== householdId)
  )];
  const allHouseholdIds = [householdId, ...otherHouseholdIds];

  const householdNames: Record<string, string> = {};
  if (otherHouseholdIds.length > 0) {
    const households = await Promise.all(
      otherHouseholdIds.map((id) => getHouseholdById(id))
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
