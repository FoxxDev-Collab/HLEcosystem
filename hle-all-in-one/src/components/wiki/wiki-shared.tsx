// Shared wiki UI bits: visibility badge map, relative-date / reading-time
// helpers (legacy lib/format.ts) and the page list row used by the
// index/personal/public workspace pages.
import { Link } from "@tanstack/react-router"
import {
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Lock,
  MessageSquare,
  Pin,
  Share2,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { PageListItem, PageVisibility } from "@/server/wiki/pages"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"

export const VIS: Record<
  PageVisibility,
  { icon: LucideIcon; label: string; color: string }
> = {
  PRIVATE: {
    icon: Lock,
    label: "Private",
    color: "bg-muted text-muted-foreground",
  },
  HOUSEHOLD: {
    icon: Users,
    label: "Household",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  },
  SHARED: {
    icon: Share2,
    label: "Shared",
    color:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  },
  PUBLIC: {
    icon: Globe,
    label: "Public",
    color:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
}

export function formatDateRelative(
  date: Date | string | null | undefined
): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(d)
}

export function estimateReadingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 200))
  return `${minutes} min read`
}

export function VisibilityBadge({
  visibility,
}: {
  visibility: PageVisibility
}) {
  const v = VIS[visibility]
  const Icon = v.icon
  return (
    <Badge className={`${v.color} border-0 text-[10px] font-medium`}>
      <Icon className="mr-1 size-2.5" />
      {v.label}
    </Badge>
  )
}

// List row matching the legacy PageRow. `actions` renders trailing controls
// (e.g. the manage dropdown on the index page).
export function PageRow({
  page,
  showVisibility = true,
  actions,
}: {
  page: PageListItem
  showVisibility?: boolean
  actions?: React.ReactNode
}) {
  return (
    <div className="group flex items-center gap-4 rounded-lg border border-border/40 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      <Link
        to="/wiki/pages/$id"
        params={{ id: page.id }}
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{page.title}</p>
          {page.pinned && <Pin className="size-3 shrink-0 text-amber-500" />}
        </div>
        {page.contentText && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {page.contentText.substring(0, 100)}
          </p>
        )}
      </Link>
      {page.childCount > 0 && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {page.childCount} sub
        </Badge>
      )}
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {page.tags.slice(0, 2).map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px]">
            {t}
          </Badge>
        ))}
      </div>
      <div className="hidden shrink-0 items-center gap-3 text-[11px] text-muted-foreground md:flex">
        {showVisibility && <VisibilityBadge visibility={page.visibility} />}
        {page.wordCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Clock className="size-2.5" />
            {estimateReadingTime(page.wordCount)}
          </span>
        )}
        {page.commentCount > 0 && (
          <span className="flex items-center gap-0.5">
            <MessageSquare className="size-2.5" />
            {page.commentCount}
          </span>
        )}
      </div>
      <div className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">
        <div className="truncate">{page.updatedByName ?? "Unknown"}</div>
        <div>{formatDateRelative(page.updatedAt)}</div>
      </div>
      {actions ?? (
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
      )}
    </div>
  )
}
