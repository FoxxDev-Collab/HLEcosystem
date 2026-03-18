"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type ActionState = { error: string } | null;

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("hub_user_id")?.value ?? null;
}

export async function createHouseholdAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "Household name is required" };

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log("[createHousehold] cookies present:", allCookies.map(c => c.name));

  const userId = cookieStore.get("hub_user_id")?.value ?? null;
  console.log("[createHousehold] userId:", userId ? `${userId.substring(0, 8)}...` : "null");

  if (!userId) return { error: "Not authenticated — please log in again" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User account not found" };

  try {
    await prisma.household.create({
      data: {
        name: name.trim(),
        members: {
          create: {
            userId,
            displayName: user.name,
            role: "ADMIN",
          },
        },
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
  const role = formData.get("role") as string;
  const displayName = formData.get("displayName") as string;
  const familyRelationship = (formData.get("familyRelationship") as string) || null;

  if (!householdId || !userId || !role || !displayName?.trim()) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await prisma.householdMember.create({
    data: {
      householdId,
      userId,
      displayName: displayName.trim(),
      role: role as "ADMIN" | "MEMBER" | "VIEWER",
      ...(familyRelationship ? { familyRelationship: familyRelationship as never } : {}),
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

  await prisma.householdMember.update({
    where: { id: memberId },
    data: { role: role as "ADMIN" | "MEMBER" | "VIEWER" },
  });

  revalidatePath(`/households/${householdId}`);
  revalidatePath("/households");
}

export async function updateMemberRelationshipAction(formData: FormData): Promise<void> {
  const memberId = formData.get("memberId") as string;
  const familyRelationship = (formData.get("familyRelationship") as string) || null;
  const householdId = formData.get("householdId") as string;

  if (!memberId) return;

  await prisma.householdMember.update({
    where: { id: memberId },
    data: { familyRelationship: familyRelationship as never },
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
