import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Route, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import {
  createEmergencyPlanAction,
  markPlanReviewedAction,
  deleteEmergencyPlanAction,
} from "../actions";

const PLAN_TYPES = [
  "FIRE",
  "FLOOD",
  "EARTHQUAKE",
  "TORNADO",
  "HURRICANE",
  "POWER_OUTAGE",
  "MEDICAL",
  "INTRUDER",
  "EVACUATION",
  "CUSTOM",
];

const TYPE_COLORS: Record<string, string> = {
  FIRE: "bg-red-100 text-red-800",
  FLOOD: "bg-blue-100 text-blue-800",
  EARTHQUAKE: "bg-amber-100 text-amber-800",
  TORNADO: "bg-gray-100 text-gray-800",
  HURRICANE: "bg-cyan-100 text-cyan-800",
  POWER_OUTAGE: "bg-yellow-100 text-yellow-800",
  MEDICAL: "bg-green-100 text-green-800",
  INTRUDER: "bg-purple-100 text-purple-800",
  EVACUATION: "bg-orange-100 text-orange-800",
  CUSTOM: "bg-gray-100 text-gray-800",
};

function needsReview(lastReviewed: Date | null): boolean {
  if (!lastReviewed) return true;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return lastReviewed < sixMonthsAgo;
}

export default async function EmergencyPlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const plans = await prisma.emergencyPlan.findMany({
    where: { householdId },
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Emergency Plans</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createEmergencyPlanAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Plan Title</Label>
              <Input name="title" placeholder="e.g. House Fire Escape Plan" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue="FIRE">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input name="description" placeholder="Brief overview" />
            </div>
            <div className="space-y-1">
              <Label>Review Frequency (months)</Label>
              <Input name="reviewFrequencyMonths" type="number" min="1" placeholder="6" />
            </div>
            <Button type="submit">
              <Plus className="size-4 mr-2" />Create Plan
            </Button>
          </form>
        </CardContent>
      </Card>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Route className="size-10 mx-auto mb-3 opacity-40" />
            <p>No emergency plans yet. Create plans for fire, flood, and other scenarios.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const reviewNeeded = needsReview(plan.lastReviewed);
            return (
              <Card key={plan.id} className={reviewNeeded ? "border-amber-300" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Link href={`/emergency/plans/${plan.id}`} className="hover:underline">
                        <CardTitle className="text-lg">{plan.title}</CardTitle>
                      </Link>
                      <Badge className={TYPE_COLORS[plan.type]}>
                        {plan.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <form action={deleteEmergencyPlanAction}>
                        <input type="hidden" name="id" value={plan.id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                          <Trash2 className="size-3.5 text-red-500" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {reviewNeeded ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="size-3.5" />
                          {plan.lastReviewed ? `Last reviewed ${formatDate(plan.lastReviewed)}` : "Never reviewed"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="size-3.5" />
                          Reviewed {formatDate(plan.lastReviewed)}
                        </span>
                      )}
                    </div>
                    <form action={markPlanReviewedAction}>
                      <input type="hidden" name="id" value={plan.id} />
                      <Button type="submit" variant="outline" size="sm">
                        <CheckCircle2 className="size-3.5 mr-1" />Mark Reviewed
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
