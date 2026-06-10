import { Link, useLocation } from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import { MODULES, getActiveModule } from "@/lib/modules"

/**
 * The bottom-of-sidebar module switcher. Same 4-col grid as the original
 * Next.js AppSwitcher, but the items are now INTERNAL route links
 * (`module.base`) instead of cross-origin app URLs — client-side navigation,
 * no full page reload, no env-injected appUrls.
 */
export function AppSwitcher() {
  const pathname = useLocation().pathname
  const active = getActiveModule(pathname)

  return (
    <div className="grid grid-cols-4 gap-1">
      {MODULES.map((m) => {
        const Icon = m.icon

        // Reserved future-app slot: dashed, non-interactive.
        if (m.placeholder) {
          return (
            <div
              key={m.key}
              className="flex flex-col items-center gap-1 rounded-md border border-dashed border-sidebar-border/60 px-1 py-2 text-center opacity-50"
              title="Reserved for a future app"
            >
              <Icon className="size-4 text-muted-foreground/60" />
              <span className="text-[10px] leading-tight text-muted-foreground/60">
                {m.name}
              </span>
            </div>
          )
        }

        const isCurrent = m.key === active?.key
        const className = `flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors ${
          isCurrent
            ? "bg-primary/10"
            : m.enabled
              ? "cursor-pointer hover:bg-sidebar-accent"
              : "cursor-not-allowed opacity-40"
        }`
        const inner = (
          <>
            <Icon
              className={`size-4 ${isCurrent ? m.color : "text-muted-foreground"}`}
            />
            <span
              className={`text-[10px] leading-tight ${isCurrent ? "font-semibold" : "text-muted-foreground"}`}
            >
              {m.name}
            </span>
          </>
        )

        // Active module or not-yet-built module: render as a non-link tile.
        if (isCurrent || !m.enabled) {
          return (
            <div
              key={m.key}
              className={className}
              title={m.enabled ? m.name : `${m.name} — coming soon`}
            >
              {inner}
            </div>
          )
        }

        return (
          <Link
            key={m.key}
            to={`${m.base}/dashboard` as LinkProps["to"]}
            className={className}
            title={m.name}
          >
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
