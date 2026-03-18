"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getInverseRelation } from "@/lib/relationships";
import type { Relationship } from "@prisma/client";

export async function createRelationAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const fromMemberId = formData.get("fromMemberId") as string;
  const toMemberId = formData.get("toMemberId") as string;
  const relationType = formData.get("relationType") as Relationship;

  if (!fromMemberId || !toMemberId || !relationType || fromMemberId === toMemberId) return;

  // Build valid household set: current + linked
  const linkedHouseholds = await prisma.linkedHousehold.findMany({
    where: { householdId },
    select: { linkedHouseholdId: true },
  });
  const validHouseholdIds = [householdId, ...linkedHouseholds.map((lh) => lh.linkedHouseholdId)];

  // Verify both members belong to a valid household
  const [fromMember, toMember] = await Promise.all([
    prisma.familyMember.findFirst({ where: { id: fromMemberId, householdId: { in: validHouseholdIds } } }),
    prisma.familyMember.findFirst({ where: { id: toMemberId, householdId: { in: validHouseholdIds } } }),
  ]);
  if (!fromMember || !toMember) return;

  const inverseType = getInverseRelation(relationType);

  // Create both directions in a transaction (owned by current household)
  await prisma.$transaction([
    prisma.familyRelation.create({
      data: { householdId, fromMemberId, toMemberId, relationType },
    }),
    prisma.familyRelation.create({
      data: {
        householdId,
        fromMemberId: toMemberId,
        toMemberId: fromMemberId,
        relationType: inverseType,
      },
    }),
  ]);

  revalidatePath("/family-tree");
  revalidatePath("/family-tree/manage");
}

export async function deleteRelationAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  if (!id) return;

  // Find the relation to get its members
  const relation = await prisma.familyRelation.findFirst({
    where: { id, householdId },
  });
  if (!relation) return;

  // Delete both directions
  await prisma.familyRelation.deleteMany({
    where: {
      householdId,
      OR: [
        { fromMemberId: relation.fromMemberId, toMemberId: relation.toMemberId },
        { fromMemberId: relation.toMemberId, toMemberId: relation.fromMemberId },
      ],
    },
  });

  revalidatePath("/family-tree");
  revalidatePath("/family-tree/manage");
}
