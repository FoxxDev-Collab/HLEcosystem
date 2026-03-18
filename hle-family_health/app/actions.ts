"use server";

import { redirect } from "next/navigation";
import { setCurrentUser, clearCurrentUser } from "@/lib/auth";
import { setCurrentHousehold, getHouseholdsForUser } from "@/lib/household";

export async function selectUserAction(formData: FormData): Promise<void> {
  const userId = formData.get("userId") as string;
  if (!userId) return;

  await setCurrentUser(userId);

  const households = await getHouseholdsForUser(userId);
  if (households.length === 0) {
    redirect("/setup");
  }

  await setCurrentHousehold(households[0].id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearCurrentUser();
  redirect("/login");
}

export async function switchHouseholdAction(formData: FormData): Promise<void> {
  const householdId = formData.get("householdId") as string;
  if (!householdId) return;
  await setCurrentHousehold(householdId);
  redirect("/dashboard");
}
