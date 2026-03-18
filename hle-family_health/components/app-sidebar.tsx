"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  HeartPulse,
  CalendarDays,
  Pill,
  Syringe,
  Phone,
  Shield,
  Stethoscope,
  FileText,
  DollarSign,
  Dumbbell,
  Settings,
  LogOut,
  ChevronDown,
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

const overviewNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Family Members", href: "/family", icon: Users },
  { title: "Health Profiles", href: "/profiles", icon: HeartPulse },
];

const medicalNav = [
  { title: "Appointments", href: "/appointments", icon: CalendarDays },
  { title: "Medications", href: "/medications", icon: Pill },
  { title: "Vaccinations", href: "/vaccinations", icon: Syringe },
  { title: "Visit Summaries", href: "/visits", icon: FileText },
];

const directoryNav = [
  { title: "Providers", href: "/providers", icon: Stethoscope },
  { title: "Insurance", href: "/insurance", icon: Shield },
  { title: "Emergency Contacts", href: "/emergency-contacts", icon: Phone },
];

const wellnessNav = [
  { title: "Workouts", href: "/workouts", icon: Dumbbell },
  { title: "Medical Expenses", href: "/expenses", icon: DollarSign },
  { title: "Settings", href: "/settings", icon: Settings },
];

type NavItem = { title: string; href: string; icon: React.ComponentType<{ className?: string }> };

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
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

type Household = { id: string; name: string };
type UserInfo = { name: string; email: string };

export function AppSidebar({
  user,
  household,
  households,
}: {
  user: UserInfo;
  household: Household;
  households: Household[];
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent">
            <div className="text-left">
              <div className="font-semibold">{household.name}</div>
              <div className="text-xs text-muted-foreground">Family Health</div>
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
        <NavGroup label="Medical" items={medicalNav} pathname={pathname} />
        <NavGroup label="Directory" items={directoryNav} pathname={pathname} />
        <NavGroup label="Wellness" items={wellnessNav} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
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
