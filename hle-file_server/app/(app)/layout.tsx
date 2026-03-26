import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdById, getHouseholdsForUser } from "@/lib/household";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { UploadProvider } from "@/components/upload-context";
import { UploadPanel } from "@/components/upload-panel";
import { QueryProvider } from "@/components/query-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    const authUrl = process.env.AUTH_URL || "http://localhost:8080";
    const appUrl = process.env.APP_URL || "http://localhost:8085";
    redirect(`${authUrl}/login?redirect=${encodeURIComponent(appUrl + "/dashboard")}`);
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [household, households] = await Promise.all([
    getHouseholdById(householdId),
    getHouseholdsForUser(user.id),
  ]);

  if (!household) redirect("/setup");

  const appUrls: Record<string, string> = {};
  const urlMap: Record<string, string | undefined> = {
    MANAGER: process.env.NEXT_PUBLIC_APP_URL_MANAGER,
    HUB: process.env.NEXT_PUBLIC_APP_URL_HUB,
    FINANCE: process.env.NEXT_PUBLIC_APP_URL_FINANCE,
    HEALTH: process.env.NEXT_PUBLIC_APP_URL_HEALTH,
    HOME: process.env.NEXT_PUBLIC_APP_URL_HOME,
    FILES: process.env.NEXT_PUBLIC_APP_URL_FILES,
    MEALS: process.env.NEXT_PUBLIC_APP_URL_MEALS,
    WIKI: process.env.NEXT_PUBLIC_APP_URL_WIKI,
    TRAVEL: process.env.NEXT_PUBLIC_APP_URL_TRAVEL,
  };
  for (const [key, val] of Object.entries(urlMap)) {
    if (val) appUrls[key] = val;
  }

  return (
    <QueryProvider>
    <UploadProvider>
      <SidebarProvider>
        <AppSidebar
          user={{ name: user.name, email: user.email }}
          household={{ id: household.id, name: household.name }}
          households={households.map((h) => ({ id: h.id, name: h.name }))}
          appUrls={appUrls}
        />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <UploadPanel />
    </UploadProvider>
    </QueryProvider>
  );
}
