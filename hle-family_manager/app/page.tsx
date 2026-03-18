import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getActiveUsers } from "@/lib/users";

export default async function HomePage() {
  const users = await getActiveUsers();
  if (users.length === 0) redirect("/register");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  redirect("/dashboard");
}
