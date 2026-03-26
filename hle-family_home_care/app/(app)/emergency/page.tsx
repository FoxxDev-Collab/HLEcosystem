import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Phone,
  Route,
  Package,
  FileKey,
  Zap,
  AlertTriangle,
} from "lucide-react";

export default async function EmergencyOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    contactCount,
    planCount,
    kitCount,
    expiringSupplies,
    plansNeedingReview,
    utilityCount,
    documentCount,
  ] = await Promise.all([
    prisma.emergencyContact.count({ where: { householdId } }),
    prisma.emergencyPlan.count({ where: { householdId } }),
    prisma.emergencySupplyKit.count({ where: { householdId } }),
    prisma.emergencySupply.findMany({
      where: {
        kit: { householdId },
        expirationDate: { lte: thirtyDaysFromNow },
      },
      include: { kit: true },
      orderBy: { expirationDate: "asc" },
    }),
    prisma.emergencyPlan.findMany({
      where: {
        householdId,
        OR: [
          { lastReviewed: null },
          { lastReviewed: { lt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) } },
        ],
      },
      orderBy: { lastReviewed: "asc" },
    }),
    prisma.utilityShutoff.count({ where: { householdId } }),
    prisma.importantDocumentLocation.count({ where: { householdId } }),
  ]);

  const expiredSupplies = expiringSupplies.filter(
    (s) => s.expirationDate && s.expirationDate <= now
  );
  const soonExpiringSupplies = expiringSupplies.filter(
    (s) => s.expirationDate && s.expirationDate > now
  );

  const hasAlerts =
    expiredSupplies.length > 0 ||
    soonExpiringSupplies.length > 0 ||
    plansNeedingReview.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Emergency Preparedness</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/emergency/contacts">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Phone className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contactCount}</p>
                  <p className="text-sm text-muted-foreground">Emergency Contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/emergency/plans">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <Route className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{planCount}</p>
                  <p className="text-sm text-muted-foreground">Emergency Plans</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/emergency/supplies">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <Package className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kitCount}</p>
                  <p className="text-sm text-muted-foreground">Supply Kits</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/emergency/supplies">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  expiringSupplies.length > 0
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{expiringSupplies.length}</p>
                  <p className="text-sm text-muted-foreground">Expiring Supplies</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="size-5" />
              Attention Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expiredSupplies.length > 0 && (
              <div className="flex items-start gap-2">
                <Badge variant="destructive">{expiredSupplies.length} Expired</Badge>
                <span className="text-sm text-amber-900 dark:text-amber-100">
                  {expiredSupplies.map((s) => `${s.name} (${s.kit.name})`).join(", ")}
                </span>
              </div>
            )}
            {soonExpiringSupplies.length > 0 && (
              <div className="flex items-start gap-2">
                <Badge className="bg-yellow-100 text-yellow-800">{soonExpiringSupplies.length} Expiring Soon</Badge>
                <span className="text-sm text-amber-900 dark:text-amber-100">
                  {soonExpiringSupplies.map((s) => `${s.name} (${formatDate(s.expirationDate)})`).join(", ")}
                </span>
              </div>
            )}
            {plansNeedingReview.length > 0 && (
              <div className="flex items-start gap-2">
                <Badge className="bg-orange-100 text-orange-800">{plansNeedingReview.length} Need Review</Badge>
                <span className="text-sm text-amber-900 dark:text-amber-100">
                  {plansNeedingReview.map((p) => p.title).join(", ")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/emergency/contacts">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <Phone className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Emergency Contacts</p>
                <p className="text-sm text-muted-foreground">Neighbors, utilities, services</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/emergency/plans">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <Route className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Emergency Plans</p>
                <p className="text-sm text-muted-foreground">Fire, flood, evacuation procedures</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/emergency/supplies">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <Package className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Supply Kits</p>
                <p className="text-sm text-muted-foreground">Track emergency supplies and expiration</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/emergency/documents">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <FileKey className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Important Documents</p>
                <p className="text-sm text-muted-foreground">Know where critical documents are</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/emergency/utilities">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <Zap className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Utility Shutoffs</p>
                <p className="text-sm text-muted-foreground">Gas, water, electric shutoff locations</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-dashed opacity-60">
          <CardContent className="flex items-center gap-3 pt-6">
            <Shield className="size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Stay Prepared</p>
              <p className="text-sm text-muted-foreground">Review plans regularly, check supplies</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
