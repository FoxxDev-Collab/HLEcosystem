"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSwitcher } from "@/components/app-switcher";
import {
  BookOpen, User, Users, Globe, Share2, Search,
  Settings, LogOut, ChevronDown, ChevronRight, BookMarked,
  FileText, Pin, Lock,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction, switchHouseholdAction } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";

type Household = { id: string; name: string };
type UserInfo = { id: string; name: string; email: string; role: string };
type PageNode = {
  id: string;
  title: string;
  children: { id: string; title: string; children: { id: string; title: string }[] }[];
};
type PageTree = {
  household: PageNode[];
  personal: PageNode[];
  shared: PageNode[];
};

const quickNav = [
  { title: "All Pages", href: "/wiki", icon: BookOpen },
  { title: "Search", href: "/wiki/search", icon: Search },
];

const accountNav = [
  { title: "Settings", href: "/settings", icon: Settings },
];

function PageTreeItem({ page, pathname, depth = 0 }: { page: PageNode; pathname: string; depth?: number }) {
  const isActive = pathname === `/wiki/${page.id}`;
  const isEditing = pathname === `/wiki/${page.id}/edit`;
  const hasChildren = page.children.length > 0;
  const isExpanded = pathname.startsWith(`/wiki/${page.id}`) ||
    page.children.some((c) =>
      pathname.startsWith(`/wiki/${c.id}`) ||
      c.children.some((gc) => pathname.startsWith(`/wiki/${gc.id}`))
    );

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive || isEditing} className="h-7">
          <Link href={`/wiki/${page.id}`}>
            <FileText className="size-3.5" />
            <span className="truncate">{page.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen={isExpanded} className="group/collapsible">
      <SidebarMenuItem>
        <div className="flex items-center">
          <SidebarMenuButton asChild isActive={isActive || isEditing} className="h-7 flex-1 min-w-0">
            <Link href={`/wiki/${page.id}`}>
              <FileText className="size-3.5" />
              <span className="truncate">{page.title}</span>
            </Link>
          </SidebarMenuButton>
          <CollapsibleTrigger asChild>
            <button className="p-1 rounded-sm hover:bg-sidebar-accent text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0">
              <ChevronRight className="size-3 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <SidebarMenuSub>
            {page.children.map((child) => {
              const childActive = pathname === `/wiki/${child.id}` || pathname === `/wiki/${child.id}/edit`;
              const childHasChildren = child.children.length > 0;
              const childExpanded = pathname.startsWith(`/wiki/${child.id}`) ||
                child.children.some((gc) => pathname.startsWith(`/wiki/${gc.id}`));

              if (!childHasChildren) {
                return (
                  <SidebarMenuSubItem key={child.id}>
                    <SidebarMenuSubButton asChild isActive={childActive} className="h-7">
                      <Link href={`/wiki/${child.id}`}>
                        <span className="truncate">{child.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              }

              return (
                <Collapsible key={child.id} defaultOpen={childExpanded} className="group/nested">
                  <SidebarMenuSubItem>
                    <div className="flex items-center">
                      <SidebarMenuSubButton asChild isActive={childActive} className="h-7 flex-1 min-w-0">
                        <Link href={`/wiki/${child.id}`}>
                          <span className="truncate">{child.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                      <CollapsibleTrigger asChild>
                        <button className="p-0.5 rounded-sm hover:bg-sidebar-accent text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0">
                          <ChevronRight className="size-2.5 transition-transform group-data-[state=open]/nested:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {child.children.map((grandchild) => {
                          const gcActive = pathname === `/wiki/${grandchild.id}` || pathname === `/wiki/${grandchild.id}/edit`;
                          return (
                            <SidebarMenuSubItem key={grandchild.id}>
                              <SidebarMenuSubButton asChild isActive={gcActive} className="h-6">
                                <Link href={`/wiki/${grandchild.id}`}>
                                  <span className="truncate text-[12px]">{grandchild.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuSubItem>
                </Collapsible>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function PageTreeGroup({ label, icon: Icon, pages, pathname, emptyText }: {
  label: string;
  icon: typeof Users;
  pages: PageNode[];
  pathname: string;
  emptyText: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70 flex items-center gap-1.5">
        <Icon className="size-3" />
        {label}
        <span className="ml-auto text-[9px] font-normal opacity-60">{pages.length}</span>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {pages.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground/50">{emptyText}</div>
          ) : (
            pages.map((page) => (
              <PageTreeItem key={page.id} page={page} pathname={pathname} />
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ user, household, households, pageTree }: {
  user: UserInfo;
  household: Household;
  households: Household[];
  pageTree: PageTree;
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors">
            <div className="flex items-center gap-2.5 text-left">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <BookMarked className="size-3.5" />
              </div>
              <div>
                <div className="font-semibold text-[13px] leading-tight">{household.name}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">Family Wiki</div>
              </div>
            </div>
            {households.length > 1 && <ChevronDown className="size-3.5 opacity-40" />}
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

      <SidebarContent className="wiki-scroll">
        {/* Quick navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {quickNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} className="h-8">
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

        {/* Page trees by workspace */}
        <PageTreeGroup
          label="Household"
          icon={Users}
          pages={pageTree.household}
          pathname={pathname}
          emptyText="No household pages"
        />

        <PageTreeGroup
          label="Personal"
          icon={Lock}
          pages={pageTree.personal}
          pathname={pathname}
          emptyText="No personal pages"
        />

        {pageTree.shared.length > 0 && (
          <PageTreeGroup
            label="Shared"
            icon={Share2}
            pages={pageTree.shared}
            pathname={pathname}
            emptyText="No shared pages"
          />
        )}

        {/* Account */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} className="h-8">
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
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/70">
            Apps
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <AppSwitcher currentApp="WIKI" />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground transition-colors" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
