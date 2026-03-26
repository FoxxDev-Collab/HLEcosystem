export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    const authUrl = process.env.AUTH_URL || "http://localhost:8080";
    const appUrl = process.env.APP_URL || "http://localhost:8089";
    redirect(`${authUrl}/login?redirect=${encodeURIComponent(appUrl + "/")}`);
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  redirect("/dashboard");
}
