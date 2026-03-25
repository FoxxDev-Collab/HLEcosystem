export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    const authUrl = process.env.AUTH_URL || "http://localhost:8080";
    const appUrl = process.env.APP_URL || "http://localhost:8088";
    redirect(`${authUrl}/login?redirect=${encodeURIComponent(appUrl + "/")}`);
  }

  if (user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  redirect("/dashboard");
}
