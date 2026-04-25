import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldOff, ShieldX, ChevronRight } from "lucide-react";

function warrantyStatus(expires: Date | null): "expired" | "expiring" | "active" | "unknown" {
  if (!expires) return "unknown";
  const now = new Date();
  const days = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= 90) return "expiring";
  return "active";
}

function daysUntil(expires: Date | null): number | null {
  if (!expires) return null;
  return Math.ceil((expires.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

export default async function WarrantiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const items = await prisma.item.findMany({
    where: { householdId, isArchived: false },
    include: { room: { select: { name: true } } },
    orderBy: { warrantyExpires: "asc" },
  });

  const withWarranty = items.filter((i) => i.warrantyExpires !== null);
  const noWarranty = items.filter((i) => i.warrantyExpires === null);

  const expired = withWarranty.filter((i) => warrantyStatus(i.warrantyExpires) === "expired");
  const expiring = withWarranty.filter((i) => warrantyStatus(i.warrantyExpires) === "expiring");
  const active = withWarranty.filter((i) => warrantyStatus(i.warrantyExpires) === "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Warranty Tracker</h1>
        <p className="text-muted-foreground">
          {withWarranty.length} item{withWarranty.length !== 1 ? "s" : ""} with warranty data · {noWarranty.length} untracked
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-3">
        <Card className={expiring.length > 0 ? "border-yellow-300 dark:border-yellow-700" : ""}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Expiring Soon</span>
              <ShieldAlert className={`size-3.5 ${expiring.length > 0 ? "text-yellow-600" : "text-muted-foreground/50"}`} />
            </div>
            <div className={`text-2xl font-bold ${expiring.length > 0 ? "text-yellow-700 dark:text-yellow-400" : ""}`}>{expiring.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">within 90 days</p>
          </CardContent>
        </Card>
        <Card className={expired.length > 0 ? "border-red-200 dark:border-red-800" : ""}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Expired</span>
              <ShieldX className={`size-3.5 ${expired.length > 0 ? "text-red-500" : "text-muted-foreground/50"}`} />
            </div>
            <div className={`text-2xl font-bold ${expired.length > 0 ? "text-red-600" : ""}`}>{expired.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">past expiry</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Active</span>
              <ShieldCheck className="size-3.5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{active.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">in warranty</p>
          </CardContent>
        </Card>
      </div>

      {withWarranty.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldOff className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No warranty data recorded. Add warranty info from an item&apos;s detail page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Expiring Soon */}
          {expiring.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5 mb-3">
                <ShieldAlert className="size-3.5" /> Expiring Within 90 Days
              </h2>
              <div className="space-y-2">
                {expiring.map((item) => {
                  const days = daysUntil(item.warrantyExpires);
                  return (
                    <Link key={item.id} href={`/items/${item.id}`}>
                      <div className="flex items-center gap-4 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800/40 bg-yellow-50/50 dark:bg-yellow-950/10 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-colors">
                        <ShieldAlert className="size-4 text-yellow-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.room?.name && `${item.room.name} · `}
                            {item.manufacturer && `${item.manufacturer} · `}
                            Expires {formatDate(item.warrantyExpires)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700 dark:text-yellow-400">
                            {days === 0 ? "Today" : `${days}d left`}
                          </Badge>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground/30 shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Expired */}
          {expired.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-3">
                <ShieldX className="size-3.5" /> Expired
              </h2>
              <div className="space-y-2">
                {expired.map((item) => (
                  <Link key={item.id} href={`/items/${item.id}`}>
                    <div className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors opacity-75">
                      <ShieldX className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.room?.name && `${item.room.name} · `}
                          {item.manufacturer && `${item.manufacturer} · `}
                          Expired {formatDate(item.warrantyExpires)}
                        </p>
                      </div>
                      {item.purchasePrice && (
                        <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(item.purchasePrice)}</span>
                      )}
                      <ChevronRight className="size-3.5 text-muted-foreground/30 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Active */}
          {active.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-green-700 dark:text-green-400 flex items-center gap-1.5 mb-3">
                <ShieldCheck className="size-3.5" /> Active Warranties
              </h2>
              <div className="space-y-2">
                {active.map((item) => {
                  const days = daysUntil(item.warrantyExpires);
                  return (
                    <Link key={item.id} href={`/items/${item.id}`}>
                      <div className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-card hover:bg-muted/30 transition-colors">
                        <ShieldCheck className="size-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.room?.name && `${item.room.name} · `}
                            {item.manufacturer && `${item.manufacturer} · `}
                            Expires {formatDate(item.warrantyExpires)}
                          </p>
                          {item.warrantyNotes && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">{item.warrantyNotes}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right space-y-1">
                          {days !== null && (
                            <p className="text-xs text-muted-foreground">{days}d remaining</p>
                          )}
                          {item.purchasePrice && (
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.purchasePrice)}</p>
                          )}
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground/30 shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* No warranty data */}
      {noWarranty.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-3">
            <ShieldOff className="size-3.5" /> No Warranty Data ({noWarranty.length})
          </h2>
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <div className="divide-y divide-border/20">
              {noWarranty.slice(0, 10).map((item) => (
                <Link key={item.id} href={`/items/${item.id}`}>
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <div>
                      <span className="text-sm">{item.name}</span>
                      {item.room?.name && <span className="text-xs text-muted-foreground ml-2">{item.room.name}</span>}
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground/30" />
                  </div>
                </Link>
              ))}
              {noWarranty.length > 10 && (
                <div className="px-4 py-2.5 text-xs text-muted-foreground">
                  +{noWarranty.length - 10} more — add warranty info from each item&apos;s page
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
