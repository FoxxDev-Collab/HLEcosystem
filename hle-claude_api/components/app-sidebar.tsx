"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSwitcher } from "@/components/app-switcher";
import {
  LayoutDashboard,
  Key,
  BarChart3,
  Settings,
  LogOut,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "API Keys", href: "/api-keys", icon: Key },
  { title: "Usage", href: "/usage", icon: BarChart3 },
  { title: "Settings", href: "/settings", icon: Settings },
];

type AppSidebarProps = {
  user: { name: string; email: string };
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Bot className="size-6 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Claude API</h2>
            <p className="text-xs text-muted-foreground">AI Gateway</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
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
        <SidebarGroup>
          <SidebarGroupLabel>Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <AppSwitcher currentApp="" />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
            <LogOut className="size-4 mr-2" />
            Logout
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
