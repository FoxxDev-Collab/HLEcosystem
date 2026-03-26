import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatCurrency } from "@/lib/format";
import { Trophy, Plus, Trash2, Award } from "lucide-react";
import {
  addActivityAction,
  deleteActivityAction,
} from "../actions";

const ACTIVITY_CATEGORIES = [
  { value: "SPORTS", label: "Sports" },
  { value: "ARTS", label: "Arts" },
  { value: "MUSIC", label: "Music" },
  { value: "ACADEMIC", label: "Academic" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "CLUB", label: "Club" },
  { value: "RELIGIOUS", label: "Religious" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  SPORTS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  ARTS: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  MUSIC: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ACADEMIC: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  VOLUNTEER: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  CLUB: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  RELIGIOUS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { member: filterMemberId, category: filterCategory } =
    await searchParams;

  const members = await prisma.familyMember.findMany({
    where: { householdId, isActive: true },
    orderBy: { firstName: "asc" },
  });

  const where: Record<string, unknown> = { householdId };
  if (filterMemberId) where.familyMemberId = filterMemberId;
  if (filterCategory) where.category = filterCategory;

  const activities = await prisma.activity.findMany({
    where,
    include: {
      familyMember: { select: { firstName: true, lastName: true, id: true } },
      achievements: true,
    },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
  });

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
        <p className="text-muted-foreground text-sm">
          {activities.length} activit{activities.length !== 1 ? "ies" : "y"} across the family.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <form className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Member</Label>
              <select
                name="member"
                defaultValue={filterMemberId ?? ""}
                className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <select
                name="category"
                defaultValue={filterCategory ?? ""}
                className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Categories</option>
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="secondary" className="h-8">
              Filter
            </Button>
            {(filterMemberId || filterCategory) && (
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                formAction="/education/activities"
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: activity list */}
        <div className="space-y-3">
          {activities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Trophy className="size-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No activities found.
                </p>
              </CardContent>
            </Card>
          ) : (
            activities.map((activity) => (
              <Card
                key={activity.id}
                className={activity.isCurrent ? "" : "opacity-70"}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          className={`text-[9px] ${CATEGORY_COLORS[activity.category] ?? CATEGORY_COLORS.OTHER}`}
                        >
                          {ACTIVITY_CATEGORIES.find(
                            (c) => c.value === activity.category
                          )?.label ?? activity.category}
                        </Badge>
                        {activity.isCurrent && (
                          <Badge variant="default" className="text-[9px]">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-semibold">{activity.name}</p>
                      <Link
                        href={`/education/${activity.familyMember.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {activity.familyMember.firstName}{" "}
                        {activity.familyMember.lastName}
                      </Link>
                      {activity.organization && (
                        <p className="text-xs text-muted-foreground">
                          {activity.organization}
                        </p>
                      )}
                      {activity.schedule && (
                        <p className="text-xs text-muted-foreground">
                          {activity.schedule}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {(activity.startDate || activity.endDate) && (
                          <p className="text-[10px] text-muted-foreground">
                            {activity.startDate &&
                              formatDate(activity.startDate)}
                            {activity.startDate &&
                              activity.endDate &&
                              " - "}
                            {activity.endDate &&
                              formatDate(activity.endDate)}
                          </p>
                        )}
                        {activity.cost && (
                          <Badge variant="secondary" className="text-[9px]">
                            {formatCurrency(activity.cost.toString())}
                          </Badge>
                        )}
                      </div>
                      {activity.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.notes}
                        </p>
                      )}
                      {activity.achievements.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {activity.achievements.map((ach) => (
                            <Badge
                              key={ach.id}
                              variant="outline"
                              className="text-[9px]"
                            >
                              <Award className="size-2.5 mr-0.5" />
                              {ach.title}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <form action={deleteActivityAction}>
                      <input type="hidden" name="id" value={activity.id} />
                      <input
                        type="hidden"
                        name="familyMemberId"
                        value={activity.familyMemberId}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right: add form */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Plus className="size-4" />
                Add Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addActivityAction} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Family Member *</Label>
                  <select
                    name="familyMemberId"
                    required
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Activity Name *</Label>
                    <Input name="name" required className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <select
                      name="category"
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {ACTIVITY_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Organization</Label>
                    <Input name="organization" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Schedule</Label>
                    <Input
                      name="schedule"
                      placeholder="e.g. Tue/Thu 4-5pm"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      name="startDate"
                      type="date"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Date</Label>
                    <Input
                      name="endDate"
                      type="date"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cost</Label>
                    <Input
                      name="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="new-act-isCurrent"
                    name="isCurrent"
                    defaultChecked
                  />
                  <Label
                    htmlFor="new-act-isCurrent"
                    className="text-xs font-normal"
                  >
                    Currently active
                  </Label>
                </div>
                <Textarea
                  name="notes"
                  placeholder="Notes"
                  rows={2}
                  className="text-sm"
                />
                <Button type="submit" className="w-full h-9">
                  <Plus className="size-4 mr-1.5" />
                  Add Activity
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
