import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  updateEmergencyPlanAction,
  markPlanReviewedAction,
  deleteEmergencyPlanAction,
} from "../../actions";

const PLAN_TYPES = [
  "FIRE", "FLOOD", "EARTHQUAKE", "TORNADO", "HURRICANE",
  "POWER_OUTAGE", "MEDICAL", "INTRUDER", "EVACUATION", "CUSTOM",
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

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { id } = await params;

  const plan = await prisma.emergencyPlan.findFirst({
    where: { id, householdId },
  });

  if (!plan) notFound();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const reviewNeeded = !plan.lastReviewed || plan.lastReviewed < sixMonthsAgo;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/emergency/plans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{plan.title}</h1>
          <Badge className={TYPE_COLORS[plan.type]}>{plan.type.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      {/* Review Status */}
      <Card className={reviewNeeded ? "border-amber-300" : "border-green-300"}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {reviewNeeded ? (
                <span className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="size-4" />
                  {plan.lastReviewed
                    ? `Last reviewed ${formatDate(plan.lastReviewed)} -- review recommended`
                    : "This plan has never been reviewed"}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="size-4" />
                  Last reviewed {formatDate(plan.lastReviewed)}
                </span>
              )}
            </div>
            <form action={markPlanReviewedAction}>
              <input type="hidden" name="id" value={plan.id} />
              <Button type="submit" variant={reviewNeeded ? "default" : "outline"} size="sm">
                <CheckCircle2 className="size-3.5 mr-1" />Mark as Reviewed
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Plan Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{plan.description}</p>
              </div>
            )}
            {plan.meetingPoint && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Meeting Point</p>
                <p className="text-sm whitespace-pre-wrap">{plan.meetingPoint}</p>
              </div>
            )}
            {plan.evacuationRoute && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Evacuation Route</p>
                <p className="text-sm whitespace-pre-wrap">{plan.evacuationRoute}</p>
              </div>
            )}
            {plan.procedures && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Procedures</p>
                <p className="text-sm whitespace-pre-wrap">{plan.procedures}</p>
              </div>
            )}
            {plan.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap italic">{plan.notes}</p>
              </div>
            )}
            {!plan.description && !plan.meetingPoint && !plan.evacuationRoute && !plan.procedures && !plan.notes && (
              <p className="text-sm text-muted-foreground">No details added yet. Use the edit form to add plan details.</p>
            )}
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateEmergencyPlanAction} className="space-y-4">
              <input type="hidden" name="id" value={plan.id} />
              <div className="space-y-1">
                <Label>Title</Label>
                <Input name="title" defaultValue={plan.title} required />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select name="type" defaultValue={plan.type}>
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
                <Textarea name="description" defaultValue={plan.description || ""} rows={3} />
              </div>
              <div className="space-y-1">
                <Label>Meeting Point</Label>
                <Input name="meetingPoint" defaultValue={plan.meetingPoint || ""} placeholder="e.g. Front yard by mailbox" />
              </div>
              <div className="space-y-1">
                <Label>Evacuation Route</Label>
                <Textarea name="evacuationRoute" defaultValue={plan.evacuationRoute || ""} rows={2} placeholder="Describe exit routes" />
              </div>
              <div className="space-y-1">
                <Label>Procedures</Label>
                <Textarea name="procedures" defaultValue={plan.procedures || ""} rows={4} placeholder="Step-by-step instructions" />
              </div>
              <div className="space-y-1">
                <Label>Review Frequency (months)</Label>
                <Input name="reviewFrequencyMonths" type="number" min="1" defaultValue={plan.reviewFrequencyMonths || ""} placeholder="6" />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea name="notes" defaultValue={plan.notes || ""} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save Changes</Button>
                <form action={deleteEmergencyPlanAction}>
                  <input type="hidden" name="id" value={plan.id} />
                  <Button type="submit" variant="destructive" size="default">
                    <Trash2 className="size-3.5 mr-1" />Delete Plan
                  </Button>
                </form>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
