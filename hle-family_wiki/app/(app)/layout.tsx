import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdById, getHouseholdsForUser } from "@/lib/household";
import prisma from "@/lib/prisma";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    const authUrl = process.env.AUTH_URL || "http://localhost:8080";
    const appUrl = process.env.APP_URL || "http://localhost:8087";
    redirect(`${authUrl}/login?redirect=${encodeURIComponent(appUrl + "/wiki")}`);
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [household, households] = await Promise.all([
    getHouseholdById(householdId),
    getHouseholdsForUser(user.id),
  ]);

  if (!household) redirect("/setup");

  // Fetch page tree for sidebar (all non-archived root pages + 2 levels deep)
  const [householdPages, privatePages, sharedIds] = await Promise.all([
    prisma.wikiPage.findMany({
      where: { archived: false, parentId: null, ownerId: householdId, visibility: { in: ["HOUSEHOLD", "SHARED", "PUBLIC"] } },
      select: {
        id: true, title: true, visibility: true, pinned: true,
        children: {
          where: { archived: false },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          select: {
            id: true, title: true,
            children: {
              where: { archived: false },
              orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: [{ pinned: "desc" }, { title: "asc" }],
    }),
    prisma.wikiPage.findMany({
      where: { archived: false, parentId: null, ownerId: user.id, visibility: "PRIVATE" },
      select: {
        id: true, title: true, visibility: true, pinned: true,
        children: {
          where: { archived: false },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          select: {
            id: true, title: true,
            children: {
              where: { archived: false },
              orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: [{ pinned: "desc" }, { title: "asc" }],
    }),
    prisma.pageShare.findMany({
      where: { householdId },
      select: { pageId: true },
    }),
  ]);

  // Fetch shared pages tree
  const sharedPages = sharedIds.length > 0
    ? await prisma.wikiPage.findMany({
        where: { id: { in: sharedIds.map((s) => s.pageId) }, archived: false, parentId: null },
        select: {
          id: true, title: true, visibility: true, pinned: true,
          children: {
            where: { archived: false },
            orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
            select: {
              id: true, title: true,
              children: {
                where: { archived: false },
                orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
                select: { id: true, title: true },
              },
            },
          },
        },
        orderBy: [{ pinned: "desc" }, { title: "asc" }],
      })
    : [];

  // Deduplicate shared pages that are already in household pages
  const householdPageIds = new Set(householdPages.map((p) => p.id));
  const uniqueSharedPages = sharedPages.filter((p) => !householdPageIds.has(p.id));

  type PageNode = {
    id: string;
    title: string;
    children: { id: string; title: string; children: { id: string; title: string }[] }[];
  };

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
    <SidebarProvider>
      <AppSidebar
        user={{ id: user.id, name: user.name, email: user.email, role: user.role }}
        household={{ id: household.id, name: household.name }}
        households={households.map((h) => ({ id: h.id, name: h.name }))}
        appUrls={appUrls}
        pageTree={{
          household: householdPages as PageNode[],
          personal: privatePages as PageNode[],
          shared: uniqueSharedPages as PageNode[],
        }}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Family Wiki</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
