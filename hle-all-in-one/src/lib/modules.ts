import {
  ArrowLeftRight,
  Award,
  BarChart3,
  BookOpen,
  BookUser,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  Car,
  ChefHat,
  Clapperboard,
  Dumbbell,
  ClipboardList,
  DollarSign,
  FileKey,
  FileText,
  Gauge,
  Gem,
  Globe,
  Gift,
  GitBranch,
  GraduationCap,
  HardDrive,
  HardHat,
  HeartPulse,
  Home,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Link2,
  ListChecks,
  ListTodo,
  Lock,
  Luggage,
  Package,
  PawPrint,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  Plus,
  ReceiptText,
  Refrigerator,
  Repeat,
  Route,
  Search,
  ScanLine,
  Settings,
  Share2,
  Settings2,
  Shield,
  ShieldCheck,
  Stethoscope,
  Syringe,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  TicketCheck,
  TrendingDown,
  Trophy,
  Upload,
  UtensilsCrossed,
  Users,
  Wand2,
  Wrench,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Instance ADMIN only (e.g. user provisioning). */
  adminOnly?: boolean
  /** Household OWNER or instance ADMIN (household-privileged features). */
  ownerOrAdmin?: boolean
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
          {
            title: "Dashboard",
            href: "/manager/dashboard",
            icon: LayoutDashboard,
          },
        ],
      },
      {
        label: "Organization",
        items: [
          {
            title: "Users",
            href: "/manager/members",
            icon: Users,
            adminOnly: true,
          },
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
          { title: "Calendar", href: "/hub/calendar", icon: CalendarDays },
        ],
      },
      {
        label: "Family",
        items: [
          { title: "People", href: "/hub/people", icon: Users },
          { title: "Address Book", href: "/hub/address-book", icon: BookUser },
          { title: "Family Tree", href: "/hub/tree", icon: GitBranch },
        ],
      },
      {
        label: "Planning",
        items: [
          { title: "Important Dates", href: "/hub/dates", icon: CalendarHeart },
          { title: "To-Do Lists", href: "/hub/todos", icon: ListTodo },
          { title: "Gift Ideas", href: "/hub/gift-ideas", icon: Lightbulb },
          { title: "Gift Tracker", href: "/hub/gifts", icon: Gift },
        ],
      },
      {
        label: "Education",
        items: [
          { title: "Overview", href: "/hub/education", icon: GraduationCap },
          { title: "Grades", href: "/hub/education/grades", icon: BookOpen },
          {
            title: "Activities",
            href: "/hub/education/activities",
            icon: Trophy,
          },
          {
            title: "Certifications",
            href: "/hub/education/certifications",
            icon: Award,
          },
        ],
      },
      {
        label: "Requests",
        items: [
          {
            title: "Media Requests",
            href: "/hub/media-requests",
            icon: Clapperboard,
          },
        ],
      },
    ],
  },
  // Coming soon — visible (greyed) in the switcher, ported in later phases.
  {
    key: "finance",
    name: "Finance",
    icon: DollarSign,
    base: "/finance",
    color: "text-green-600 dark:text-green-400",
    enabled: true,
    nav: [
      {
        label: "Overview",
        items: [
          {
            title: "Dashboard",
            href: "/finance/dashboard",
            icon: LayoutDashboard,
          },
          { title: "Accounts", href: "/finance/accounts", icon: Landmark },
          {
            title: "Transactions",
            href: "/finance/transactions",
            icon: ArrowLeftRight,
          },
          { title: "Recurring", href: "/finance/recurring", icon: Repeat },
        ],
      },
      {
        label: "Planning",
        items: [
          { title: "Budgets", href: "/finance/budgets", icon: PiggyBank },
          {
            title: "Budget Planner",
            href: "/finance/budget-planner",
            icon: ClipboardList,
          },
          { title: "Categories", href: "/finance/categories", icon: Tag },
          { title: "Bills", href: "/finance/bills", icon: ReceiptText },
        ],
      },
      {
        label: "Wealth",
        items: [
          { title: "Assets", href: "/finance/assets", icon: Gem },
          { title: "Debts", href: "/finance/debts", icon: TrendingDown },
          { title: "Taxes", href: "/finance/taxes", icon: FileText },
          { title: "Reports", href: "/finance/reports", icon: BarChart3 },
        ],
      },
      {
        label: "Tools",
        items: [
          { title: "Import", href: "/finance/import", icon: Upload },
          {
            title: "Receipt Scanner",
            href: "/finance/receipts",
            icon: ScanLine,
          },
          {
            title: "Categorize",
            href: "/finance/transactions/categorize",
            icon: Wand2,
          },
          {
            title: "Smart Link",
            href: "/finance/transactions/smart-link",
            icon: Link2,
          },
          { title: "Advisor", href: "/finance/advisor", icon: Sparkles },
        ],
      },
      {
        label: "More",
        items: [
          { title: "Trips", href: "/finance/trips", icon: Route },
          { title: "Wishlists", href: "/finance/wishlist", icon: Star },
        ],
      },
    ],
  },
  {
    key: "health",
    name: "Health",
    icon: HeartPulse,
    base: "/health",
    color: "text-red-600 dark:text-red-400",
    enabled: true,
    nav: [
      {
        label: "Overview",
        items: [
          {
            title: "Dashboard",
            href: "/health/dashboard",
            icon: LayoutDashboard,
          },
          { title: "Family Tracking", href: "/health/family", icon: Users },
          {
            title: "Health Profiles",
            href: "/health/profiles",
            icon: HeartPulse,
          },
        ],
      },
      {
        label: "Care",
        items: [
          {
            title: "Appointments",
            href: "/health/appointments",
            icon: CalendarDays,
          },
          { title: "Medications", href: "/health/medications", icon: Pill },
          {
            title: "Vaccinations",
            href: "/health/vaccinations",
            icon: Syringe,
          },
          { title: "Visit Summaries", href: "/health/visits", icon: FileText },
        ],
      },
      {
        label: "Network",
        items: [
          { title: "Providers", href: "/health/providers", icon: Stethoscope },
          { title: "Insurance", href: "/health/insurance", icon: Shield },
          {
            title: "Emergency Contacts",
            href: "/health/emergency-contacts",
            icon: Phone,
          },
        ],
      },
      {
        label: "More",
        items: [
          { title: "Pets", href: "/health/pets", icon: PawPrint },
          { title: "Workouts", href: "/health/workouts", icon: Dumbbell },
          {
            title: "Medical Expenses",
            href: "/health/expenses",
            icon: DollarSign,
          },
        ],
      },
    ],
  },
  {
    key: "home",
    name: "Home Care",
    icon: Wrench,
    base: "/home-care",
    color: "text-orange-600 dark:text-orange-400",
    enabled: true,
    nav: [
      {
        label: "Overview",
        items: [
          {
            title: "Dashboard",
            href: "/home-care/dashboard",
            icon: LayoutDashboard,
          },
          {
            title: "Calendar",
            href: "/home-care/calendar",
            icon: CalendarDays,
          },
        ],
      },
      {
        label: "Home",
        items: [
          { title: "Rooms", href: "/home-care/rooms", icon: Home },
          {
            title: "Items & Appliances",
            href: "/home-care/items",
            icon: Refrigerator,
          },
          {
            title: "Warranties",
            href: "/home-care/warranties",
            icon: ShieldCheck,
          },
          { title: "Documents", href: "/home-care/documents", icon: FileText },
          {
            title: "Service Providers",
            href: "/home-care/providers",
            icon: HardHat,
          },
        ],
      },
      {
        label: "Vehicles",
        items: [
          { title: "Vehicles", href: "/home-care/vehicles", icon: Car },
          { title: "Mileage Log", href: "/home-care/mileage", icon: Gauge },
        ],
      },
      {
        label: "Maintenance",
        items: [
          {
            title: "Schedules",
            href: "/home-care/schedules",
            icon: CalendarClock,
          },
          {
            title: "Maintenance Log",
            href: "/home-care/maintenance-log",
            icon: ClipboardList,
          },
          { title: "Repairs", href: "/home-care/repairs", icon: Wrench },
        ],
      },
      {
        label: "Chores",
        items: [
          { title: "Chore Chart", href: "/home-care/chores", icon: ListChecks },
          {
            title: "Manage Chores",
            href: "/home-care/chores/manage",
            icon: Settings2,
          },
          { title: "Rewards", href: "/home-care/chores/rewards", icon: Star },
        ],
      },
      {
        label: "Emergency",
        items: [
          { title: "Overview", href: "/home-care/emergency", icon: Shield },
          {
            title: "Contacts",
            href: "/home-care/emergency/contacts",
            icon: Phone,
          },
          { title: "Plans", href: "/home-care/emergency/plans", icon: Route },
          {
            title: "Supplies",
            href: "/home-care/emergency/supplies",
            icon: Package,
          },
          {
            title: "Documents",
            href: "/home-care/emergency/documents",
            icon: FileKey,
          },
          {
            title: "Utilities",
            href: "/home-care/emergency/utilities",
            icon: Zap,
          },
        ],
      },
    ],
  },
  {
    key: "files",
    name: "Files",
    icon: HardDrive,
    base: "/files",
    color: "text-purple-600 dark:text-purple-400",
    enabled: false,
    nav: [],
  },
  {
    key: "meals",
    name: "Meals",
    icon: UtensilsCrossed,
    base: "/meals",
    color: "text-amber-600 dark:text-amber-400",
    enabled: true,
    nav: [
      {
        label: "Meals",
        items: [
          {
            title: "Dashboard",
            href: "/meals/dashboard",
            icon: LayoutDashboard,
          },
          { title: "Meal Plan", href: "/meals/mealie", icon: ChefHat },
          { title: "Recipes", href: "/meals/recipes", icon: BookOpen },
          {
            title: "What Can I Cook?",
            href: "/meals/recipes/what-can-i-cook",
            icon: UtensilsCrossed,
          },
          {
            title: "Mealie Lists",
            href: "/meals/mealie/shopping-lists",
            icon: ListChecks,
          },
        ],
      },
      {
        label: "Shopping",
        items: [
          {
            title: "Shopping Lists",
            href: "/meals/shopping-lists",
            icon: ShoppingCart,
          },
          {
            title: "Smart List",
            href: "/meals/shopping-lists/generate",
            icon: Sparkles,
          },
          { title: "Receipts", href: "/meals/receipts", icon: ScanLine },
          {
            title: "Price Compare",
            href: "/meals/price-compare",
            icon: BarChart3,
          },
          { title: "Pantry", href: "/meals/pantry", icon: Package },
        ],
      },
      {
        label: "Catalog",
        items: [
          { title: "Products", href: "/meals/products", icon: Tag },
          { title: "Stores", href: "/meals/stores", icon: Store },
        ],
      },
      {
        label: "System",
        items: [{ title: "Settings", href: "/meals/settings", icon: Settings }],
      },
    ],
  },
  {
    key: "wiki",
    name: "Wiki",
    icon: BookOpen,
    base: "/wiki",
    color: "text-teal-600 dark:text-teal-400",
    enabled: true,
    nav: [
      {
        label: "Wiki",
        items: [
          { title: "All Pages", href: "/wiki/pages", icon: BookOpen },
          { title: "Search", href: "/wiki/search", icon: Search },
          { title: "Personal", href: "/wiki/personal", icon: Lock },
          { title: "Shared", href: "/wiki/shared", icon: Share2 },
          { title: "Public", href: "/wiki/public", icon: Globe },
        ],
      },
    ],
  },
  {
    key: "travel",
    name: "Travel",
    icon: Plane,
    base: "/travel",
    color: "text-cyan-600 dark:text-cyan-400",
    enabled: true,
    nav: [
      {
        label: "Overview",
        items: [
          {
            title: "Dashboard",
            href: "/travel/dashboard",
            icon: LayoutDashboard,
          },
          { title: "Trips", href: "/travel/trips", icon: Plane },
        ],
      },
      {
        label: "Planning",
        items: [
          { title: "Itinerary", href: "/travel/itinerary", icon: CalendarDays },
          {
            title: "Reservations",
            href: "/travel/reservations",
            icon: TicketCheck,
          },
          { title: "Packing", href: "/travel/packing", icon: Luggage },
          { title: "Budget", href: "/travel/budget", icon: DollarSign },
          { title: "Contacts", href: "/travel/contacts", icon: Users },
        ],
      },
      {
        label: "Management",
        items: [
          { title: "Documents", href: "/travel/documents", icon: FileText },
        ],
      },
    ],
  },
  {
    key: "media",
    name: "Media",
    icon: Clapperboard,
    base: "/media",
    color: "text-pink-600 dark:text-pink-400",
    enabled: true,
    nav: [
      {
        label: "Library",
        items: [
          { title: "Library", href: "/media", icon: Clapperboard },
          {
            title: "Parental Controls",
            href: "/media/parental",
            icon: ShieldCheck,
            ownerOrAdmin: true,
          },
        ],
      },
    ],
  },
  // Reserved slots for two future apps.
  {
    key: "slot-1",
    name: "Soon",
    icon: Plus,
    base: "/__slot-1",
    color: "",
    enabled: false,
    placeholder: true,
    nav: [],
  },
  {
    key: "slot-2",
    name: "Soon",
    icon: Plus,
    base: "/__slot-2",
    color: "",
    enabled: false,
    placeholder: true,
    nav: [],
  },
]

export function getActiveModule(pathname: string): ModuleDef | undefined {
  return MODULES.find(
    (m) =>
      !m.placeholder &&
      (pathname === m.base || pathname.startsWith(m.base + "/"))
  )
}
