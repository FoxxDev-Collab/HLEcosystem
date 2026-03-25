"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { setConfig } from "@/lib/service-config";

export async function updateSettingsAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const serviceEnabled = formData.get("service_enabled") as string;
  const defaultModel = formData.get("default_model") as string;
  const rateLimit = formData.get("rate_limit_per_minute") as string;
  const monthlyCostLimit = formData.get("monthly_cost_limit") as string;

  await Promise.all([
    setConfig("service_enabled", serviceEnabled),
    setConfig("default_model", defaultModel),
    setConfig("rate_limit_per_minute", rateLimit),
    setConfig("monthly_cost_limit", monthlyCostLimit),
  ]);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
