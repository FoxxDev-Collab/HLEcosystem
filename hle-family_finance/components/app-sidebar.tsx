"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  FolderKanban,
  Heart,
  Tags,
  Building2,
  CreditCard,
  FileText,
  Upload,
  Landmark,
  Settings,
  LogOut,
  ChevronDown,
  BarChart3,
  Repeat,
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

const mainNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Accounts", href: "/accounts", icon: Wallet },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { title: "Categories", href: "/categories", icon: Tags },
];

const budgetNav = [
  { title: "Budgets", href: "/budgets", icon: PieChart },
  { title: "Budget Planner", href: "/budget-planner", icon: FolderKanban },
  { title: "Wishlists", href: "/wishlist", icon: Heart },
  { title: "Reports", href: "/reports", icon: BarChart3 },
];

const wealthNav = [
  { title: "Assets", href: "/assets", icon: Building2 },
  { title: "Debts", href: "/debts", icon: CreditCard },
  { title: "Bills", href: "/bills", icon: FileText },
  { title: "Recurring", href: "/recurring", icon: Repeat },
];

const toolsNav = [
  { title: "Import", href: "/import", icon: Upload },
  { title: "Taxes", href: "/taxes", icon: Landmark },
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
  items: typeof mainNav;
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
              <div className="text-xs text-muted-foreground">Family Finance</div>
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
        <NavGroup label="Overview" items={mainNav} pathname={pathname} />
        <NavGroup label="Budget" items={budgetNav} pathname={pathname} />
        <NavGroup label="Wealth" items={wealthNav} pathname={pathname} />
        <NavGroup label="Tools" items={toolsNav} pathname={pathname} />
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
