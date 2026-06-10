import {
  LayoutDashboard,
  Users,
  Home,
  Shield,
  Settings,
  DollarSign,
  HeartPulse,
  Wrench,
  HardDrive,
  UtensilsCrossed,
  BookOpen,
  Plane,
  GitBranch,
  CalendarDays,
  Gift,
  Network,
  Clapperboard,
  Plus,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}
export type NavGroup = { label: string; items: Array<NavItem> }

/**
 * Single source of truth for both the bottom app-switcher grid and the
 * contextual middle nav. A module's `base` drives the switcher link; its
 * `nav` renders in the sidebar whenever the active route is under `base`.
 * `enabled: false` modules show greyed in the switcher (ported in later
 * phases) so the full ecosystem is always visible.
 */
export type ModuleDef = {
  key: string
  name: string
  icon: LucideIcon
  base: string
  color: string
  enabled: boolean
  /** Empty slot reserved for a future app — renders as a dashed tile. */
  placeholder?: boolean
  nav: Array<NavGroup>
}

export const MODULES: Array<ModuleDef> = [
  {
    key: "manager",
    name: "Manager",
    icon: Users,
    base: "/manager",
    color: "text-blue-600 dark:text-blue-400",
    enabled: true,
    nav: [
      {
        label: "Overview",
        items: [
          { title: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
        ],
      },
      {
        label: "Organization",
        items: [
          { title: "Users", href: "/manager/members", icon: Users, adminOnly: true },
          { title: "Households", href: "/manager/households", icon: Home },
        ],
      },
      {
        label: "Account",
        items: [
          { title: "Security", href: "/manager/security", icon: Shield },
          { title: "Settings", href: "/manager/settings", icon: Settings },
        ],
      },
    ],
  },
  {
    key: "hub",
    name: "Hub",
    icon: Home,
    base: "/hub",
    color: "text-indigo-600 dark:text-indigo-400",
    enabled: true,
    nav: [
      {
        label: "Overview",
        items: [
          { title: "Dashboard", href: "/hub/dashboard", icon: LayoutDashboard },
        ],
      },
      {
        label: "Family",
        items: [
          { title: "Members", href: "/hub/members", icon: Users },
          { title: "Relationships", href: "/hub/relationships", icon: Network },
          { title: "Family Tree", href: "/hub/tree", icon: GitBranch },
        ],
      },
      {
        label: "Activity",
        items: [
          { title: "Events", href: "/hub/events", icon: CalendarDays },
          { title: "Gifts", href: "/hub/gifts", icon: Gift },
        ],
      },
    ],
  },
  // Coming soon — visible (greyed) in the switcher, ported in later phases.
  { key: "finance", name: "Finance", icon: DollarSign, base: "/finance", color: "text-green-600 dark:text-green-400", enabled: false, nav: [] },
  { key: "health", name: "Health", icon: HeartPulse, base: "/health", color: "text-red-600 dark:text-red-400", enabled: false, nav: [] },
  { key: "home", name: "Home Care", icon: Wrench, base: "/home-care", color: "text-orange-600 dark:text-orange-400", enabled: false, nav: [] },
  { key: "files", name: "Files", icon: HardDrive, base: "/files", color: "text-purple-600 dark:text-purple-400", enabled: false, nav: [] },
  { key: "meals", name: "Meals", icon: UtensilsCrossed, base: "/meals", color: "text-amber-600 dark:text-amber-400", enabled: false, nav: [] },
  { key: "wiki", name: "Wiki", icon: BookOpen, base: "/wiki", color: "text-teal-600 dark:text-teal-400", enabled: false, nav: [] },
  { key: "travel", name: "Travel", icon: Plane, base: "/travel", color: "text-cyan-600 dark:text-cyan-400", enabled: false, nav: [] },
  { key: "media", name: "Media", icon: Clapperboard, base: "/media", color: "text-pink-600 dark:text-pink-400", enabled: false, nav: [] },
  // Reserved slots for two future apps.
  { key: "slot-1", name: "Soon", icon: Plus, base: "/__slot-1", color: "", enabled: false, placeholder: true, nav: [] },
  { key: "slot-2", name: "Soon", icon: Plus, base: "/__slot-2", color: "", enabled: false, placeholder: true, nav: [] },
]

export function getActiveModule(pathname: string): ModuleDef | undefined {
  return MODULES.find(
    (m) =>
      !m.placeholder &&
      (pathname === m.base || pathname.startsWith(m.base + "/")),
  )
}
