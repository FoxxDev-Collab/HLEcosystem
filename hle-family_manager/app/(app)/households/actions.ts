"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type ActionState = { error: string } | null;

export async function createHouseholdAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "Household name is required" };

  const cookieStore = await cookies();
  const userId = cookieStore.get("hub_user_id")?.value ?? null;
  if (!userId) return { error: "Not authenticated — please log in again" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User account not found" };

  const spouseUserId = (formData.get("spouseUserId") as string) || null;

  try {
    const membersToCreate: Array<{
      userId: string;
      displayName: string;
      role: "ADMIN";
      familyRelationship: "Spouse";
    }> = [
      {
        userId,
        displayName: user.name,
        role: "ADMIN",
        familyRelationship: "Spouse",
      },
    ];

    if (spouseUserId && spouseUserId !== userId) {
      const spouse = await prisma.user.findUnique({ where: { id: spouseUserId } });
      if (!spouse) return { error: "Selected spouse account not found" };
      membersToCreate.push({
        userId: spouseUserId,
        displayName: spouse.name,
        role: "ADMIN",
        familyRelationship: "Spouse",
      });
    }

    await prisma.household.create({
      data: {
        name: name.trim(),
        members: { create: membersToCreate },
      },
    });
  } catch (e) {
    console.error("[createHousehold] Failed:", e);
    return { error: "Failed to create household — check server logs" };
  }

  revalidatePath("/households");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return null;
}

export async function updateHouseholdAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  if (!id || !name?.trim()) return;

  await prisma.household.update({
    where: { id },
    data: { name: name.trim() },
  });

  revalidatePath(`/households/${id}`);
  revalidatePath("/households");
  revalidatePath("/dashboard");
}

export async function deleteHouseholdAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.household.delete({ where: { id } });

  revalidatePath("/households");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/households");
}

export async function addMemberAction(formData: FormData): Promise<void> {
  const householdId = formData.get("householdId") as string;
  const userId = formData.get("userId") as string;
  const displayName = formData.get("displayName") as string;
  const familyRelationship = (formData.get("familyRelationship") as string) || "Child";

  if (!householdId || !userId || !displayName?.trim()) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Enforce max 2 spouses per household
  if (familyRelationship === "Spouse") {
    const spouseCount = await prisma.householdMember.count({
      where: { householdId, familyRelationship: "Spouse" },
    });
    if (spouseCount >= 2) return;
  }

  // Spouses are always ADMIN, children default to MEMBER
  const role = familyRelationship === "Spouse" ? "ADMIN" : "MEMBER";

  await prisma.householdMember.create({
    data: {
      householdId,
      userId,
      displayName: displayName.trim(),
      role,
      familyRelationship: familyRelationship as "Spouse" | "Child",
    },
  });

  revalidatePath(`/households/${householdId}`);
  revalidatePath("/households");
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const memberId = formData.get("memberId") as string;
  const role = formData.get("role") as string;
  const householdId = formData.get("householdId") as string;

  if (!memberId || !role) return;

  // Spouses must remain ADMIN — only children can have their role changed
  const member = await prisma.householdMember.findUnique({ where: { id: memberId } });
  if (!member) return;
  if (member.familyRelationship === "Spouse" && role !== "ADMIN") return;

  await prisma.householdMember.update({
    where: { id: memberId },
    data: { role: role as "ADMIN" | "MEMBER" | "VIEWER" },
  });

  revalidatePath(`/households/${householdId}`);
  revalidatePath("/households");
}

export async function setMemberRelationshipAction(formData: FormData): Promise<void> {
  const memberId = formData.get("memberId") as string;
  const familyRelationship = formData.get("familyRelationship") as string;
  const householdId = formData.get("householdId") as string;

  if (!memberId || !familyRelationship || !householdId) return;

  const member = await prisma.householdMember.findUnique({ where: { id: memberId } });
  if (!member) return;

  // Enforce max 2 spouses
  if (familyRelationship === "Spouse") {
    const spouseCount = await prisma.householdMember.count({
      where: { householdId, familyRelationship: "Spouse" },
    });
    if (spouseCount >= 2) return;
  }

  const role = familyRelationship === "Spouse" ? "ADMIN" : member.role;

  await prisma.householdMember.update({
    where: { id: memberId },
    data: {
      familyRelationship: familyRelationship as "Spouse" | "Child",
      role,
    },
  });

  revalidatePath(`/households/${householdId}`);
  revalidatePath("/households");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const memberId = formData.get("memberId") as string;
  const householdId = formData.get("householdId") as string;

  if (!memberId) return;

  await prisma.householdMember.delete({ where: { id: memberId } });

  revalidatePath(`/households/${householdId}`);
  revalidatePath("/households");
}
