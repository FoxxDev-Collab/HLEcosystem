"use server";

import { redirect } from "next/navigation";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { setCurrentHousehold, getHouseholdsForUser } from "@/lib/household";

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function switchHouseholdAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const householdId = formData.get("householdId") as string;
  if (!householdId) redirect("/dashboard");

  // Verify the user actually belongs to this household before setting the cookie.
  // Without this check, any user could switch to any household ID by crafting a POST.
  const households = await getHouseholdsForUser(user.id);
  if (!households.some((h) => h.id === householdId)) {
    redirect("/dashboard");
  }

  await setCurrentHousehold(householdId);
  redirect("/dashboard");
}
