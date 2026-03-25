"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSwitcher } from "@/components/app-switcher";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  CalendarDays,
  ListTodo,
  Lightbulb,
  Gift,
  Film,
  Settings,
  LogOut,
  ChevronDown,
  Heart,
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
];

const familyNav = [
  { title: "People", href: "/people", icon: Users },
  { title: "Family Tree", href: "/family-tree", icon: GitBranch },
];

const eventsNav = [
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Important Dates", href: "/dates", icon: CalendarDays },
  { title: "To-Do Lists", href: "/todos", icon: ListTodo },
];

const giftsNav = [
  { title: "Gift Ideas", href: "/gift-ideas", icon: Lightbulb },
  { title: "Gift Tracker", href: "/gifts", icon: Gift },
];

const mediaNav = [
  { title: "Media Requests", href: "/media-requests", icon: Film },
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
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
              >
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
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Heart className="size-3.5" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm leading-none">{household.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">FamilyHub</div>
              </div>
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

      <SidebarContent className="hub-scroll">
        <NavGroup label="Overview" items={overviewNav} pathname={pathname} />
        <NavGroup label="Family" items={familyNav} pathname={pathname} />
        <NavGroup label="Events" items={eventsNav} pathname={pathname} />
        <NavGroup label="Gifts" items={giftsNav} pathname={pathname} />
        <NavGroup label="Media" items={mediaNav} pathname={pathname} />
        <NavGroup label="Account" items={accountNav} pathname={pathname} />
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/70">
            Apps
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <AppSwitcher currentApp="HUB" />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
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
