"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSwitcher, type AppUrls } from "@/components/app-switcher";
import {
  LayoutDashboard,
  Plane,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Calendar,
  Package,
  DollarSign,
  Users,
  CalendarDays,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction, switchHouseholdAction } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";

const overviewNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Trips", href: "/trips", icon: Plane },
];

const planningNav = [
  { title: "Itinerary", href: "/itinerary", icon: CalendarDays },
  { title: "Reservations", href: "/reservations", icon: Calendar },
  { title: "Packing", href: "/packing", icon: Package },
  { title: "Budget", href: "/budget", icon: DollarSign },
  { title: "Contacts", href: "/contacts", icon: Users },
];

const managementNav = [
  { title: "Documents", href: "/documents", icon: FileText },
];

const accountNav = [
  { title: "Settings", href: "/settings", icon: Settings },
];

type Household = {
  id: string;
  name: string;
};

type UserInfo = {
  name: string;
  email: string;
};

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: typeof overviewNav;
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname === item.href}>
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({
  user,
  household,
  households,
  appUrls,
}: {
  user: UserInfo;
  household: Household;
  households: Household[];
  appUrls: AppUrls;
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent">
            <div className="text-left">
              <div className="font-semibold">{household.name}</div>
              <div className="text-xs text-muted-foreground">Family Travel</div>
            </div>
            {households.length > 1 && <ChevronDown className="size-4 opacity-50" />}
          </DropdownMenuTrigger>
          {households.length > 1 && (
            <DropdownMenuContent align="start" className="w-56">
              {households.map((h) => (
                <form key={h.id} action={switchHouseholdAction}>
                  <input type="hidden" name="householdId" value={h.id} />
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full cursor-pointer">
                      {h.name}
                      {h.id === household.id && (
                        <span className="ml-auto text-xs text-muted-foreground">Active</span>
                      )}
                    </button>
                  </DropdownMenuItem>
                </form>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Overview" items={overviewNav} pathname={pathname} />
        <NavGroup label="Planning" items={planningNav} pathname={pathname} />
        <NavGroup label="Management" items={managementNav} pathname={pathname} />
        <NavGroup label="Account" items={accountNav} pathname={pathname} />
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/70">
            Apps
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <AppSwitcher currentApp="TRAVEL" appUrls={appUrls} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
