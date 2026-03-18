import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  redirect("/dashboard");
}
