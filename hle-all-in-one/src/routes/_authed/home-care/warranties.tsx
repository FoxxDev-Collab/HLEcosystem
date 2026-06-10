import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  ShieldX,
} from "lucide-react"
import { getItemsPageFn } from "@/server/home-care/fns.items"
import type { ItemListRow } from "@/server/home-care/items"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/home-care/warranties")({
  loader: () => getItemsPageFn(),
  component: WarrantiesPage,
})

// "YYYY-MM-DD" → whole days from now (local time, matching legacy math).
function daysUntil(expires: string): number {
  const [y, m, d] = expires.split("-").map(Number)
  const target = new Date(y, m - 1, d)
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function warrantyStatus(
  expires: string | null
): "expired" | "expiring" | "active" | "unknown" {
  if (!expires) return "unknown"
  const days = daysUntil(expires)
  if (days < 0) return "expired"
  if (days <= 90) return "expiring"
  return "active"
}

function WarrantiesPage() {
  const { items } = Route.useLoaderData()

  const withWarranty = items
    .filter((i) => i.warrantyExpires !== null)
    .sort((a, b) =>
      (a.warrantyExpires ?? "").localeCompare(b.warrantyExpires ?? "")
    )
  const noWarranty = items.filter((i) => i.warrantyExpires === null)

  const expired = withWarranty.filter(
    (i) => warrantyStatus(i.warrantyExpires) === "expired"
  )
  const expiring = withWarranty.filter(
    (i) => warrantyStatus(i.warrantyExpires) === "expiring"
  )
  const active = withWarranty.filter(
    (i) => warrantyStatus(i.warrantyExpires) === "active"
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Warranty Tracker</h1>
        <p className="text-sm text-muted-foreground">
          {withWarranty.length} item{withWarranty.length !== 1 ? "s" : ""} with
          warranty data · {noWarranty.length} untracked
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card
          className={
            expiring.length > 0
              ? "border-yellow-300 dark:border-yellow-700"
              : ""
          }
        >
          <CardContent className="px-4 pt-4 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Expiring Soon
              </span>
              <ShieldAlert
                className={`size-3.5 ${
                  expiring.length > 0
                    ? "text-yellow-600"
                    : "text-muted-foreground/50"
                }`}
              />
            </div>
            <div
              className={`text-2xl font-bold ${
                expiring.length > 0
                  ? "text-yellow-700 dark:text-yellow-400"
                  : ""
              }`}
            >
              {expiring.length}
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              within 90 days
            </p>
          </CardContent>
        </Card>
        <Card
          className={
            expired.length > 0 ? "border-red-200 dark:border-red-800" : ""
          }
        >
          <CardContent className="px-4 pt-4 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Expired
              </span>
              <ShieldX
                className={`size-3.5 ${
                  expired.length > 0
                    ? "text-red-500"
                    : "text-muted-foreground/50"
                }`}
              />
            </div>
            <div
              className={`text-2xl font-bold ${
                expired.length > 0 ? "text-red-600" : ""
              }`}
            >
              {expired.length}
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              past expiry
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 pt-4 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Active
              </span>
              <ShieldCheck className="size-3.5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {active.length}
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              in warranty
            </p>
          </CardContent>
        </Card>
      </div>

      {withWarranty.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldOff className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No warranty data recorded. Add warranty info from an item&apos;s
              detail page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {expiring.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-yellow-700 uppercase dark:text-yellow-400">
                <ShieldAlert className="size-3.5" /> Expiring Within 90 Days
              </h2>
              <div className="space-y-2">
                {expiring.map((item) => {
                  const days = daysUntil(item.warrantyExpires ?? "")
                  return (
                    <Link
                      key={item.id}
                      to="/home-care/items/$id"
                      params={{ id: item.id }}
                    >
                      <div className="flex items-center gap-4 rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 transition-colors hover:bg-yellow-50 dark:border-yellow-800/40 dark:bg-yellow-950/10 dark:hover:bg-yellow-950/20">
                        <ShieldAlert className="size-4 shrink-0 text-yellow-600" />
                        <ItemSummary item={item} verb="Expires" />
                        <div className="shrink-0 text-right">
                          <Badge
                            variant="outline"
                            className="border-yellow-400 text-[10px] text-yellow-700 dark:text-yellow-400"
                          >
                            {days === 0 ? "Today" : `${days}d left`}
                          </Badge>
                        </div>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {expired.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-red-600 uppercase dark:text-red-400">
                <ShieldX className="size-3.5" /> Expired
              </h2>
              <div className="space-y-2">
                {expired.map((item) => (
                  <Link
                    key={item.id}
                    to="/home-care/items/$id"
                    params={{ id: item.id }}
                  >
                    <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-muted/20 p-3 opacity-75 transition-colors hover:bg-muted/40">
                      <ShieldX className="size-4 shrink-0 text-muted-foreground" />
                      <ItemSummary item={item} verb="Expired" />
                      {item.purchasePrice !== null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatCurrency(item.purchasePrice)}
                        </span>
                      )}
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {active.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-green-700 uppercase dark:text-green-400">
                <ShieldCheck className="size-3.5" /> Active Warranties
              </h2>
              <div className="space-y-2">
                {active.map((item) => {
                  const days = daysUntil(item.warrantyExpires ?? "")
                  return (
                    <Link
                      key={item.id}
                      to="/home-care/items/$id"
                      params={{ id: item.id }}
                    >
                      <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-card p-3 transition-colors hover:bg-muted/30">
                        <ShieldCheck className="size-4 shrink-0 text-green-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.roomName && `${item.roomName} · `}
                            {item.manufacturer && `${item.manufacturer} · `}
                            Expires {formatDate(item.warrantyExpires)}
                          </p>
                          {item.warrantyNotes && (
                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                              {item.warrantyNotes}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 space-y-1 text-right">
                          <p className="text-xs text-muted-foreground">
                            {days}d remaining
                          </p>
                          {item.purchasePrice !== null && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(item.purchasePrice)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {noWarranty.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            <ShieldOff className="size-3.5" /> No Warranty Data (
            {noWarranty.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-border/30">
            <div className="divide-y divide-border/20">
              {noWarranty.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  to="/home-care/items/$id"
                  params={{ id: item.id }}
                >
                  <div className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/30">
                    <div>
                      <span className="text-sm">{item.name}</span>
                      {item.roomName && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.roomName}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground/30" />
                  </div>
                </Link>
              ))}
              {noWarranty.length > 10 && (
                <div className="px-4 py-2.5 text-xs text-muted-foreground">
                  +{noWarranty.length - 10} more — add warranty info from each
                  item&apos;s page
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function ItemSummary({
  item,
  verb,
}: {
  item: ItemListRow
  verb: "Expires" | "Expired"
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{item.name}</p>
      <p className="text-xs text-muted-foreground">
        {item.roomName && `${item.roomName} · `}
        {item.manufacturer && `${item.manufacturer} · `}
        {verb} {formatDate(item.warrantyExpires)}
      </p>
    </div>
  )
}
