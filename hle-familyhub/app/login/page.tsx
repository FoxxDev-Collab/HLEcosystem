import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const authUrl = process.env.AUTH_URL || "http://localhost:8080";
  const appUrl = process.env.APP_URL || "http://localhost:8081";
  redirect(`${authUrl}/login?redirect=${encodeURIComponent(appUrl + "/")}`);
}
