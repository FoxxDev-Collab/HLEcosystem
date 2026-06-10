import { useState } from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import { Check, ChevronDown, Fingerprint, LogOut, Plus } from "lucide-react"
import { AppSwitcher } from "@/components/app-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { getActiveModule } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { logoutFn, switchHouseholdFn } from "@/server/fns.auth"
import type { HouseholdRole, Role } from "@/lib/types"
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
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type SidebarUser = { id: string; name: string; email: string; role: Role }
type HouseholdEntry = { id: string; name: string; role: HouseholdRole }

export function AppSidebar({
  user,
  activeHousehold,
  households,
}: {
  user: SidebarUser
  activeHousehold: { id: string; name: string } | null
  households: Array<HouseholdEntry>
}) {
  const pathname = useLocation().pathname
  const router = useRouter()
  const navigate = useNavigate()
  const activeModule = getActiveModule(pathname)
  const [appsOpen, setAppsOpen] = useState(true)

  async function switchTo(householdId: string) {
    if (householdId === activeHousehold?.id) return
    await switchHouseholdFn({ data: { householdId } })
    router.invalidate()
  }

  async function logout() {
    await logoutFn()
    await navigate({ to: "/login" })
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Fingerprint className="size-3.5" />
              </div>
              <div className="text-left">
                <div className="text-sm leading-none font-semibold">
                  {activeHousehold?.name ?? "No household"}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {activeModule?.name ?? "HLEcosystem"}
                </div>
              </div>
            </div>
            <ChevronDown className="size-4 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {households.map((h) => (
              <DropdownMenuItem
                key={h.id}
                className="cursor-pointer"
                onClick={() => switchTo(h.id)}
              >
                <span className="truncate">{h.name}</span>
                {h.id === activeHousehold?.id && (
                  <Check className="ml-auto size-3.5" />
                )}
              </DropdownMenuItem>
            ))}
            {households.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              className="cursor-pointer"
              render={<Link to="/manager/households" />}
            >
              <Plus className="size-3.5" />
              <span>New household</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {(activeModule?.nav ?? []).map((group) => {
          const items = group.items.filter(
            (item) => !item.adminOnly || user.role === "ADMIN"
          )
          if (items.length === 0) return null
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={
                          pathname === item.href ||
                          pathname.startsWith(item.href + "/")
                        }
                        render={<Link to={item.href as LinkProps["to"]} />}
                      >
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}

        {/* mt-auto pins the switcher to the bottom; the group collapses via
            its label (click "Apps" to toggle). */}
        <Collapsible
          open={appsOpen}
          onOpenChange={setAppsOpen}
          className="mt-auto"
        >
          <SidebarGroup>
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className="flex w-full cursor-pointer items-center justify-between text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase transition-colors hover:text-foreground"
            >
              Apps
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  appsOpen ? "" : "-rotate-90"
                )}
              />
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <AppSwitcher />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {user.email}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
