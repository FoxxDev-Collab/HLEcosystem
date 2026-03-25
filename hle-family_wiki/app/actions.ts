"use server";

import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { setCurrentHousehold } from "@/lib/household";

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function switchHouseholdAction(formData: FormData): Promise<void> {
  const householdId = formData.get("householdId") as string;
  if (!householdId) return;
  await setCurrentHousehold(householdId);
  redirect("/wiki");
}
