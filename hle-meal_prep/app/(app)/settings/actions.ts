"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { testMealieConnection } from "@/lib/mealie";

export async function saveMealieConfigAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const apiUrl = (formData.get("apiUrl") as string)?.trim().replace(/\/+$/, "");
  const apiToken = (formData.get("apiToken") as string)?.trim();

  if (!apiUrl || !apiToken) return;

  // Test the connection before saving
  const result = await testMealieConnection(apiUrl, apiToken);
  if (!result.ok) {
    // We can't easily return errors from server actions without a client component,
    // but the config won't be saved if the connection fails.
    // For now, still save but mark as inactive if test fails.
  }

  await prisma.mealieConfig.upsert({
    where: { householdId },
    create: {
      householdId,
      apiUrl,
      apiToken,
      isActive: result.ok,
    },
    update: {
      apiUrl,
      apiToken,
      isActive: result.ok,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/mealie");
  revalidatePath("/dashboard");
}

export async function testMealieConfigAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const apiUrl = (formData.get("apiUrl") as string)?.trim().replace(/\/+$/, "");
  const apiToken = (formData.get("apiToken") as string)?.trim();

  if (!apiUrl || !apiToken) return;

  const result = await testMealieConnection(apiUrl, apiToken);

  // Redirect back with test result as query param
  const status = result.ok ? "ok" : encodeURIComponent(result.error || "Connection failed");
  redirect(`/settings?mealie_test=${status}`);
}

export async function disconnectMealieAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  await prisma.mealieConfig.deleteMany({
    where: { householdId },
  });

  revalidatePath("/settings");
  revalidatePath("/mealie");
  revalidatePath("/dashboard");
}
