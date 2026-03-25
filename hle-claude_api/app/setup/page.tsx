import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function SetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // This app doesn't need household selection — redirect to dashboard
  redirect("/dashboard");
}
