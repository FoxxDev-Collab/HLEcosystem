"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession } from "@/lib/auth";
import { setCurrentHousehold, getCurrentHouseholdId } from "@/lib/household";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function switchHouseholdAction(formData: FormData): Promise<void> {
  const householdId = formData.get("householdId") as string;
  if (!householdId) return;
  await setCurrentHousehold(householdId);
  redirect("/dashboard");
}

export async function syncTripStatusesAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await Promise.all([
    // PLANNING/BOOKED trips whose start date has passed → IN_PROGRESS
    prisma.trip.updateMany({
      where: {
        householdId,
        status: { in: ["PLANNING", "BOOKED"] },
        startDate: { lte: today },
        endDate: { gte: today },
      },
      data: { status: "IN_PROGRESS" },
    }),
    // IN_PROGRESS/BOOKED/PLANNING trips whose end date has passed → COMPLETED
    prisma.trip.updateMany({
      where: {
        householdId,
        status: { in: ["PLANNING", "BOOKED", "IN_PROGRESS"] },
        endDate: { lt: today },
      },
      data: { status: "COMPLETED" },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/trips");
}
