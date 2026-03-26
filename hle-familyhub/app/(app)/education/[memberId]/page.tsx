import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import {
  ArrowLeft,
  GraduationCap,
  Trophy,
  Award,
  ShieldCheck,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import {
  addEducationEntryAction,
  updateEducationEntryAction,
  deleteEducationEntryAction,
  addActivityAction,
  updateActivityAction,
  deleteActivityAction,
  addAchievementAction,
  deleteAchievementAction,
  addCertificationAction,
  updateCertificationAction,
  deleteCertificationAction,
  deleteGradeReportAction,
} from "../actions";

const DEGREE_TYPES = [
  { value: "", label: "Select..." },
  { value: "HIGH_SCHOOL", label: "High School" },
  { value: "GED", label: "GED" },
  { value: "TRADE", label: "Trade/Vocational" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "DIPLOMA", label: "Diploma" },
  { value: "ASSOCIATE", label: "Associate" },
  { value: "BACHELOR", label: "Bachelor's" },
  { value: "MASTER", label: "Master's" },
  { value: "DOCTORATE", label: "Doctorate" },
  { value: "OTHER", label: "Other" },
];

const EDUCATION_STATUSES = [
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "TRANSFERRED", label: "Transferred" },
];

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

const CERT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "PENDING", label: "Pending" },
  { value: "REVOKED", label: "Revoked" },
];

function formatDateInput(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

function certExpiryBadge(expirationDate: Date | null) {
  if (!expirationDate) return null;
  const now = new Date();
  const expiry = new Date(expirationDate);
  const daysUntil = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil <= 0) {
    return (
      <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        Expired
      </Badge>
    );
  } else if (daysUntil < 30) {
    return (
      <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        {daysUntil}d left
      </Badge>
    );
  } else if (daysUntil < 90) {
    return (
      <Badge className="text-[9px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
        {daysUntil}d left
      </Badge>
    );
  } else {
    return (
      <Badge className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        {daysUntil}d left
      </Badge>
    );
  }
}

export default async function MemberEducationPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, householdId },
    include: {
      educationEntries: {
        orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
        include: {
          gradeReports: {
            orderBy: [{ schoolYear: "desc" }, { createdAt: "desc" }],
            include: {
              grades: { orderBy: { subject: "asc" } },
            },
          },
        },
      },
      activities: {
        where: { householdId },
        orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
        include: { achievements: true },
      },
      achievements: {
        where: { householdId },
        orderBy: { dateEarned: "desc" },
      },
      certifications: {
        where: { householdId },
        orderBy: [{ status: "asc" }, { expirationDate: "asc" }],
      },
    },
  });

  if (!member) notFound();

  // Get all activities for the achievement dropdown
  const memberActivities = member.activities;

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/education">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">Education Profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          {/* Education History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="size-4" />
                Education History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {member.educationEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-3 ${entry.isCurrent ? "" : "border-dashed"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.isCurrent && (
                          <Badge
                            variant="default"
                            className="text-[9px]"
                          >
                            Current
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px]">
                          {EDUCATION_STATUSES.find(
                            (s) => s.value === entry.status
                          )?.label ?? entry.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {entry.institution}
                      </p>
                      {entry.degreeType && (
                        <p className="text-xs text-muted-foreground">
                          {DEGREE_TYPES.find(
                            (d) => d.value === entry.degreeType
                          )?.label ?? entry.degreeType}
                          {entry.fieldOfStudy && ` in ${entry.fieldOfStudy}`}
                        </p>
                      )}
                      {entry.location && (
                        <p className="text-xs text-muted-foreground">
                          {entry.location}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {(entry.startDate || entry.endDate) && (
                          <p className="text-[10px] text-muted-foreground">
                            {entry.startDate && formatDate(entry.startDate)}
                            {entry.startDate && entry.endDate && " - "}
                            {entry.endDate && formatDate(entry.endDate)}
                          </p>
                        )}
                        {entry.gpa && (
                          <Badge
                            variant="secondary"
                            className="text-[9px]"
                          >
                            GPA: {entry.gpa.toString()}
                          </Badge>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <form action={deleteEducationEntryAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input
                        type="hidden"
                        name="familyMemberId"
                        value={member.id}
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

                  {/* Grade Reports */}
                  {entry.gradeReports.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Grade Reports
                      </p>
                      {entry.gradeReports.map((report) => (
                        <details key={report.id} className="group">
                          <summary className="cursor-pointer text-xs hover:text-primary flex items-center gap-1">
                            <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                            {report.schoolYear} &mdash;{" "}
                            {report.term.replace("_", " ")}
                            {report.overallGpa && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] ml-1"
                              >
                                GPA: {report.overallGpa.toString()}
                              </Badge>
                            )}
                          </summary>
                          <div className="mt-2 ml-4 space-y-1">
                            {report.grades.map((grade) => (
                              <div
                                key={grade.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span>{grade.subject}</span>
                                  {grade.teacher && (
                                    <span className="text-muted-foreground">
                                      ({grade.teacher})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {grade.grade}
                                  </span>
                                  {grade.percentage && (
                                    <span className="text-muted-foreground">
                                      {grade.percentage.toString()}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {report.notes && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {report.notes}
                              </p>
                            )}
                            <form
                              action={deleteGradeReportAction}
                              className="mt-1"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={report.id}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] text-destructive px-2"
                              >
                                <Trash2 className="size-2.5 mr-1" /> Delete
                                Report
                              </Button>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {member.educationEntries.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No education history recorded.
                </p>
              )}

              {/* Add education form */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="size-3" /> Add education entry
                </summary>
                <form
                  action={addEducationEntryAction}
                  className="mt-3 space-y-3 rounded-lg border p-3"
                >
                  <input
                    type="hidden"
                    name="familyMemberId"
                    value={member.id}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Institution *</Label>
                      <Input
                        name="institution"
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Degree Type</Label>
                      <select
                        name="degreeType"
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {DEGREE_TYPES.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Field of Study</Label>
                      <Input
                        name="fieldOfStudy"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Input name="location" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
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
                      <Label className="text-xs">Graduation Date</Label>
                      <Input
                        name="graduationDate"
                        type="date"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <select
                        name="status"
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {EDUCATION_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">GPA</Label>
                      <Input
                        name="gpa"
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox id="edu-isCurrent" name="isCurrent" />
                        <Label
                          htmlFor="edu-isCurrent"
                          className="text-xs font-normal"
                        >
                          Currently enrolled
                        </Label>
                      </div>
                    </div>
                  </div>
                  <Textarea
                    name="notes"
                    placeholder="Notes"
                    rows={1}
                    className="text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    <Plus className="size-3 mr-1" /> Add Education
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>

          {/* Activities */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="size-4" />
                Activities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {member.activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`rounded-lg border p-3 ${activity.isCurrent ? "" : "border-dashed"}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {activity.isCurrent && (
                          <Badge
                            variant="default"
                            className="text-[9px]"
                          >
                            Active
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px]">
                          {ACTIVITY_CATEGORIES.find(
                            (c) => c.value === activity.category
                          )?.label ?? activity.category}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{activity.name}</p>
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
                          <Badge
                            variant="secondary"
                            className="text-[9px]"
                          >
                            {formatCurrency(activity.cost.toString())}
                          </Badge>
                        )}
                      </div>
                      {activity.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.notes}
                        </p>
                      )}
                      {/* Activity achievements */}
                      {activity.achievements.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {activity.achievements.map((ach) => (
                            <div
                              key={ach.id}
                              className="flex items-center gap-1.5 text-[10px]"
                            >
                              <Award className="size-2.5 text-yellow-500" />
                              <span>{ach.title}</span>
                              {ach.dateEarned && (
                                <span className="text-muted-foreground">
                                  ({formatDate(ach.dateEarned)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <form action={deleteActivityAction}>
                      <input type="hidden" name="id" value={activity.id} />
                      <input
                        type="hidden"
                        name="familyMemberId"
                        value={member.id}
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
                </div>
              ))}

              {member.activities.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No activities recorded.
                </p>
              )}

              {/* Add activity form */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="size-3" /> Add activity
                </summary>
                <form
                  action={addActivityAction}
                  className="mt-3 space-y-3 rounded-lg border p-3"
                >
                  <input
                    type="hidden"
                    name="familyMemberId"
                    value={member.id}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Organization</Label>
                      <Input
                        name="organization"
                        className="h-8 text-sm"
                      />
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
                  <div className="grid gap-2 sm:grid-cols-3">
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
                      id="act-isCurrent"
                      name="isCurrent"
                      defaultChecked
                    />
                    <Label
                      htmlFor="act-isCurrent"
                      className="text-xs font-normal"
                    >
                      Currently active
                    </Label>
                  </div>
                  <Textarea
                    name="notes"
                    placeholder="Notes"
                    rows={1}
                    className="text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    <Plus className="size-3 mr-1" /> Add Activity
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Achievements */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Award className="size-4" />
                Achievements
                {member.achievements.length > 0 && (
                  <Badge variant="secondary" className="text-[9px]">
                    {member.achievements.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="flex items-start justify-between rounded-lg border p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{ach.title}</p>
                    {ach.description && (
                      <p className="text-xs text-muted-foreground">
                        {ach.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {ach.dateEarned && (
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(ach.dateEarned)}
                        </p>
                      )}
                      {ach.issuer && (
                        <p className="text-[10px] text-muted-foreground">
                          by {ach.issuer}
                        </p>
                      )}
                    </div>
                  </div>
                  <form action={deleteAchievementAction}>
                    <input type="hidden" name="id" value={ach.id} />
                    <input
                      type="hidden"
                      name="familyMemberId"
                      value={member.id}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-destructive"
                    >
                      <Trash2 className="size-2.5" />
                    </Button>
                  </form>
                </div>
              ))}

              {member.achievements.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No achievements yet.
                </p>
              )}

              <details className="group">
                <summary className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="size-3" /> Add achievement
                </summary>
                <form
                  action={addAchievementAction}
                  className="mt-3 space-y-3 rounded-lg border p-3"
                >
                  <input
                    type="hidden"
                    name="familyMemberId"
                    value={member.id}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs">Title *</Label>
                    <Input name="title" required className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      name="description"
                      className="h-8 text-sm"
                    />
                  </div>
                  {memberActivities.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Related Activity</Label>
                      <select
                        name="activityId"
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">None</option>
                        {memberActivities.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Date Earned</Label>
                      <Input
                        name="dateEarned"
                        type="date"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Issuer</Label>
                      <Input name="issuer" className="h-8 text-sm" />
                    </div>
                  </div>
                  <Textarea
                    name="notes"
                    placeholder="Notes"
                    rows={1}
                    className="text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    <Plus className="size-3 mr-1" /> Add Achievement
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Certifications
                {member.certifications.length > 0 && (
                  <Badge variant="secondary" className="text-[9px]">
                    {member.certifications.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.certifications.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-start justify-between rounded-lg border p-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{cert.name}</p>
                      {certExpiryBadge(cert.expirationDate)}
                    </div>
                    {cert.issuingBody && (
                      <p className="text-xs text-muted-foreground">
                        {cert.issuingBody}
                      </p>
                    )}
                    {cert.credentialId && (
                      <p className="text-[10px] text-muted-foreground">
                        ID: {cert.credentialId}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {cert.issueDate && (
                        <p className="text-[10px] text-muted-foreground">
                          Issued: {formatDate(cert.issueDate)}
                        </p>
                      )}
                      {cert.expirationDate && (
                        <p className="text-[10px] text-muted-foreground">
                          Expires: {formatDate(cert.expirationDate)}
                        </p>
                      )}
                    </div>
                    {cert.renewalCost && (
                      <p className="text-[10px] text-muted-foreground">
                        Renewal: {formatCurrency(cert.renewalCost.toString())}
                      </p>
                    )}
                  </div>
                  <form action={deleteCertificationAction}>
                    <input type="hidden" name="id" value={cert.id} />
                    <input
                      type="hidden"
                      name="familyMemberId"
                      value={member.id}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-destructive"
                    >
                      <Trash2 className="size-2.5" />
                    </Button>
                  </form>
                </div>
              ))}

              {member.certifications.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No certifications recorded.
                </p>
              )}

              <details className="group">
                <summary className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="size-3" /> Add certification
                </summary>
                <form
                  action={addCertificationAction}
                  className="mt-3 space-y-3 rounded-lg border p-3"
                >
                  <input
                    type="hidden"
                    name="familyMemberId"
                    value={member.id}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs">Certification Name *</Label>
                    <Input name="name" required className="h-8 text-sm" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Issuing Body</Label>
                      <Input
                        name="issuingBody"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Credential ID</Label>
                      <Input
                        name="credentialId"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Issue Date</Label>
                      <Input
                        name="issueDate"
                        type="date"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiration Date</Label>
                      <Input
                        name="expirationDate"
                        type="date"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <select
                        name="status"
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {CERT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Renewal Cost</Label>
                      <Input
                        name="renewalCost"
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">URL</Label>
                    <Input
                      name="url"
                      type="url"
                      placeholder="https://..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <Textarea
                    name="notes"
                    placeholder="Notes"
                    rows={1}
                    className="text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    <Plus className="size-3 mr-1" /> Add Certification
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
