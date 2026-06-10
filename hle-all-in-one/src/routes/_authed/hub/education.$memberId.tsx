import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  Award,
  ChevronDown,
  GraduationCap,
  Plus,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react"
import {
  createAchievementFn,
  createActivityFn,
  createCertificationFn,
  createEducationEntryFn,
  deleteAchievementFn,
  deleteActivityFn,
  deleteCertificationFn,
  deleteEducationEntryFn,
  deleteGradeReportFn,
  getMemberEducationFn,
} from "@/server/hub/fns.education"
import type {
  ActivityCategory,
  ActivityRow,
  CertificationStatus,
  DegreeType,
  EducationStatus,
} from "@/server/hub/education"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authed/hub/education/$memberId")({
  loader: ({ params }) =>
    getMemberEducationFn({ data: { memberId: params.memberId } }),
  component: MemberEducationPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const DEGREE_TYPE_LABELS: Record<DegreeType, string> = {
  HIGH_SCHOOL: "High School",
  GED: "GED",
  TRADE: "Trade/Vocational",
  CERTIFICATE: "Certificate",
  DIPLOMA: "Diploma",
  ASSOCIATE: "Associate",
  BACHELOR: "Bachelor's",
  MASTER: "Master's",
  DOCTORATE: "Doctorate",
  OTHER: "Other",
}

const EDUCATION_STATUS_LABELS: Record<EducationStatus, string> = {
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  WITHDRAWN: "Withdrawn",
  TRANSFERRED: "Transferred",
}

const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  SPORTS: "Sports",
  ARTS: "Arts",
  MUSIC: "Music",
  ACADEMIC: "Academic",
  VOLUNTEER: "Volunteer",
  CLUB: "Club",
  RELIGIOUS: "Religious",
  OTHER: "Other",
}

const CERT_STATUS_LABELS: Record<CertificationStatus, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  PENDING: "Pending",
  REVOKED: "Revoked",
}

const GRADE_TERM_LABELS: Record<string, string> = {
  QUARTER_1: "Quarter 1",
  QUARTER_2: "Quarter 2",
  QUARTER_3: "Quarter 3",
  QUARTER_4: "Quarter 4",
  SEMESTER_1: "Semester 1",
  SEMESTER_2: "Semester 2",
  TRIMESTER_1: "Trimester 1",
  TRIMESTER_2: "Trimester 2",
  TRIMESTER_3: "Trimester 3",
  SUMMER: "Summer",
  FULL_YEAR: "Full Year",
}

function str(f: FormData, key: string): string | null {
  const v = f.get(key)
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function num(f: FormData, key: string): number | null {
  const v = f.get(key)
  if (typeof v !== "string" || !v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  return Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000)
}

function CertExpiryBadge({
  expirationDate,
}: {
  expirationDate: string | null
}) {
  if (!expirationDate) return null
  const days = daysUntil(expirationDate)
  if (days <= 0) {
    return (
      <Badge className="bg-red-100 text-[9px] text-red-700 dark:bg-red-900 dark:text-red-300">
        Expired
      </Badge>
    )
  }
  const color =
    days < 30
      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
      : days < 90
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
        : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
  return <Badge className={`text-[9px] ${color}`}>{days}d left</Badge>
}

type DeleteTarget = {
  kind: "entry" | "report" | "activity" | "achievement" | "certification"
  id: string
  label: string
  description: string
}

function MemberEducationPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [addActivityOpen, setAddActivityOpen] = useState(false)
  const [addAchievementOpen, setAddAchievementOpen] = useState(false)
  const [addCertOpen, setAddCertOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Member not found</h1>
        <p className="text-sm text-muted-foreground">
          This family member doesn&apos;t exist in your household.
        </p>
        <Button variant="outline" render={<Link to="/hub/education" />}>
          <ArrowLeft className="size-4" /> Back to Education
        </Button>
      </div>
    )
  }

  const {
    member,
    entries,
    gradeReports,
    gradeItems,
    activities,
    achievements,
    certifications,
  } = data

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link to="/hub/education" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">Education Profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="min-w-0 space-y-6">
          {/* Education History */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <GraduationCap className="size-4" />
                  Education History
                </CardTitle>
                <Button size="sm" onClick={() => setAddEntryOpen(true)}>
                  <Plus className="size-3" /> Add entry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {entries.map((entry) => {
                const reports = gradeReports.filter(
                  (r) => r.educationEntryId === entry.id
                )
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-3 ${entry.isCurrent ? "" : "border-dashed"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          {entry.isCurrent && (
                            <Badge variant="default" className="text-[9px]">
                              Current
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px]">
                            {EDUCATION_STATUS_LABELS[entry.status]}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">
                          {entry.institution}
                        </p>
                        {entry.degreeType && (
                          <p className="text-xs text-muted-foreground">
                            {DEGREE_TYPE_LABELS[entry.degreeType]}
                            {entry.fieldOfStudy && ` in ${entry.fieldOfStudy}`}
                          </p>
                        )}
                        {entry.location && (
                          <p className="text-xs text-muted-foreground">
                            {entry.location}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          {(entry.startDate || entry.endDate) && (
                            <p className="text-[10px] text-muted-foreground">
                              {entry.startDate && formatDate(entry.startDate)}
                              {entry.startDate && entry.endDate && " - "}
                              {entry.endDate && formatDate(entry.endDate)}
                            </p>
                          )}
                          {entry.gpa !== null && (
                            <Badge variant="secondary" className="text-[9px]">
                              GPA: {entry.gpa}
                            </Badge>
                          )}
                        </div>
                        {entry.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete entry"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "entry",
                            id: entry.id,
                            label: entry.institution,
                            description:
                              "Grade reports for this entry are deleted too.",
                          })
                        }
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>

                    {reports.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Grade Reports
                        </p>
                        {reports.map((report) => {
                          const items = gradeItems.filter(
                            (g) => g.gradeReportId === report.id
                          )
                          return (
                            <Collapsible key={report.id}>
                              <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-xs hover:text-primary">
                                <ChevronDown className="size-3 transition-transform group-data-[panel-open]:rotate-180" />
                                {report.schoolYear} &mdash;{" "}
                                {GRADE_TERM_LABELS[report.term] ?? report.term}
                                {report.overallGpa !== null && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-1 text-[9px]"
                                  >
                                    GPA: {report.overallGpa}
                                  </Badge>
                                )}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2 ml-4 space-y-1">
                                  {items.map((grade) => (
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
                                        {grade.percentage !== null && (
                                          <span className="text-muted-foreground">
                                            {grade.percentage}%
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {report.notes && (
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                      {report.notes}
                                    </p>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="mt-1 text-destructive"
                                    onClick={() =>
                                      setDeleteTarget({
                                        kind: "report",
                                        id: report.id,
                                        label: `${report.schoolYear} ${GRADE_TERM_LABELS[report.term] ?? report.term}`,
                                        description:
                                          "All grade line items in this report are deleted too.",
                                      })
                                    }
                                  >
                                    <Trash2 className="size-2.5" /> Delete
                                    Report
                                  </Button>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {entries.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No education history recorded.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Activities */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="size-4" />
                  Activities
                </CardTitle>
                <Button size="sm" onClick={() => setAddActivityOpen(true)}>
                  <Plus className="size-3" /> Add activity
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activities.map((activity) => {
                const activityAchievements = achievements.filter(
                  (a) => a.activityId === activity.id
                )
                return (
                  <div
                    key={activity.id}
                    className={`rounded-lg border p-3 ${activity.isCurrent ? "" : "border-dashed"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          {activity.isCurrent && (
                            <Badge variant="default" className="text-[9px]">
                              Active
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px]">
                            {ACTIVITY_CATEGORY_LABELS[activity.category]}
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
                        <div className="mt-1 flex items-center gap-2">
                          {(activity.startDate || activity.endDate) && (
                            <p className="text-[10px] text-muted-foreground">
                              {activity.startDate &&
                                formatDate(activity.startDate)}
                              {activity.startDate && activity.endDate && " - "}
                              {activity.endDate && formatDate(activity.endDate)}
                            </p>
                          )}
                          {activity.cost !== null && (
                            <Badge variant="secondary" className="text-[9px]">
                              {formatCurrency(activity.cost)}
                            </Badge>
                          )}
                        </div>
                        {activity.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {activity.notes}
                          </p>
                        )}
                        {activityAchievements.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {activityAchievements.map((ach) => (
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete activity"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "activity",
                            id: activity.id,
                            label: activity.name,
                            description:
                              "Achievements stay but lose their link to this activity.",
                          })
                        }
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {activities.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No activities recorded.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Achievements */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Award className="size-4" />
                  Achievements
                  {achievements.length > 0 && (
                    <Badge variant="secondary" className="text-[9px]">
                      {achievements.length}
                    </Badge>
                  )}
                </CardTitle>
                <Button size="sm" onClick={() => setAddAchievementOpen(true)}>
                  <Plus className="size-3" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {achievements.map((ach) => (
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
                    <div className="mt-0.5 flex items-center gap-2">
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
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Delete achievement"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "achievement",
                        id: ach.id,
                        label: ach.title,
                        description: "This achievement is removed permanently.",
                      })
                    }
                  >
                    <Trash2 className="size-2.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {achievements.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No achievements yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4" />
                  Certifications
                  {certifications.length > 0 && (
                    <Badge variant="secondary" className="text-[9px]">
                      {certifications.length}
                    </Badge>
                  )}
                </CardTitle>
                <Button size="sm" onClick={() => setAddCertOpen(true)}>
                  <Plus className="size-3" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {certifications.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-start justify-between rounded-lg border p-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{cert.name}</p>
                      <CertExpiryBadge expirationDate={cert.expirationDate} />
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
                    <div className="mt-0.5 flex items-center gap-2">
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
                    {cert.renewalCost !== null && (
                      <p className="text-[10px] text-muted-foreground">
                        Renewal: {formatCurrency(cert.renewalCost)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Delete certification"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "certification",
                        id: cert.id,
                        label: cert.name,
                        description:
                          "This certification is removed permanently.",
                      })
                    }
                  >
                    <Trash2 className="size-2.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {certifications.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No certifications recorded.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {addEntryOpen && (
        <AddEducationEntryDialog
          memberId={member.id}
          onClose={() => setAddEntryOpen(false)}
          onSaved={() => {
            setAddEntryOpen(false)
            refresh()
          }}
        />
      )}
      {addActivityOpen && (
        <AddActivityDialog
          memberId={member.id}
          onClose={() => setAddActivityOpen(false)}
          onSaved={() => {
            setAddActivityOpen(false)
            refresh()
          }}
        />
      )}
      {addAchievementOpen && (
        <AddAchievementDialog
          memberId={member.id}
          activities={activities}
          onClose={() => setAddAchievementOpen(false)}
          onSaved={() => {
            setAddAchievementOpen(false)
            refresh()
          }}
        />
      )}
      {addCertOpen && (
        <AddCertificationDialog
          memberId={member.id}
          onClose={() => setAddCertOpen(false)}
          onSaved={() => {
            setAddCertOpen(false)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function DeleteDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: DeleteTarget
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    const fns = {
      entry: deleteEducationEntryFn,
      report: deleteGradeReportFn,
      activity: deleteActivityFn,
      achievement: deleteAchievementFn,
      certification: deleteCertificationFn,
    }
    try {
      const result = await fns[target.kind]({ data: { id: target.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {target.label}?</AlertDialogTitle>
          <AlertDialogDescription>{target.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AddEducationEntryDialog({
  memberId,
  onClose,
  onSaved,
}: {
  memberId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [isCurrent, setIsCurrent] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createEducationEntryFn({
        data: {
          familyMemberId: memberId,
          institution: String(f.get("institution") ?? ""),
          degreeType: (str(f, "degreeType") as DegreeType | null) ?? null,
          fieldOfStudy: str(f, "fieldOfStudy"),
          startDate: str(f, "startDate"),
          endDate: str(f, "endDate"),
          graduationDate: str(f, "graduationDate"),
          status: String(f.get("status") ?? "IN_PROGRESS") as EducationStatus,
          gpa: num(f, "gpa"),
          isCurrent,
          location: str(f, "location"),
          notes: str(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add education entry.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add education entry</DialogTitle>
          <DialogDescription>
            Record a school, program, or degree.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ee-institution">Institution *</Label>
              <Input
                id="ee-institution"
                name="institution"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee-degreeType">Degree Type</Label>
              <select
                id="ee-degreeType"
                name="degreeType"
                className={selectClass}
                defaultValue=""
              >
                <option value="">Select...</option>
                {Object.entries(DEGREE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ee-fieldOfStudy">Field of Study</Label>
              <Input id="ee-fieldOfStudy" name="fieldOfStudy" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee-location">Location</Label>
              <Input id="ee-location" name="location" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ee-startDate">Start Date</Label>
              <Input id="ee-startDate" name="startDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee-endDate">End Date</Label>
              <Input id="ee-endDate" name="endDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee-graduationDate">Graduation Date</Label>
              <Input id="ee-graduationDate" name="graduationDate" type="date" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ee-status">Status</Label>
              <select
                id="ee-status"
                name="status"
                className={selectClass}
                defaultValue="IN_PROGRESS"
              >
                {Object.entries(EDUCATION_STATUS_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee-gpa">GPA</Label>
              <Input
                id="ee-gpa"
                name="gpa"
                type="number"
                step="0.01"
                min="0"
                max="5"
              />
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ee-isCurrent"
                  checked={isCurrent}
                  onCheckedChange={(checked) => setIsCurrent(checked === true)}
                />
                <Label htmlFor="ee-isCurrent" className="font-normal">
                  Currently enrolled
                </Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ee-notes">Notes</Label>
            <Textarea id="ee-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add Education"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddActivityDialog({
  memberId,
  onClose,
  onSaved,
}: {
  memberId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [isCurrent, setIsCurrent] = useState(true)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createActivityFn({
        data: {
          familyMemberId: memberId,
          name: String(f.get("name") ?? ""),
          category: String(f.get("category") ?? "OTHER") as ActivityCategory,
          organization: str(f, "organization"),
          startDate: str(f, "startDate"),
          endDate: str(f, "endDate"),
          isCurrent,
          schedule: str(f, "schedule"),
          cost: num(f, "cost"),
          notes: str(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add activity.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
          <DialogDescription>
            Sports, clubs, music, volunteering, and more.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="act-name">Activity Name *</Label>
              <Input id="act-name" name="name" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-category">Category</Label>
              <select
                id="act-category"
                name="category"
                className={selectClass}
                defaultValue="OTHER"
              >
                {Object.entries(ACTIVITY_CATEGORY_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="act-organization">Organization</Label>
              <Input id="act-organization" name="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-schedule">Schedule</Label>
              <Input
                id="act-schedule"
                name="schedule"
                placeholder="e.g. Tue/Thu 4-5pm"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="act-startDate">Start Date</Label>
              <Input id="act-startDate" name="startDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-endDate">End Date</Label>
              <Input id="act-endDate" name="endDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-cost">Cost</Label>
              <Input
                id="act-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="act-isCurrent"
              checked={isCurrent}
              onCheckedChange={(checked) => setIsCurrent(checked === true)}
            />
            <Label htmlFor="act-isCurrent" className="font-normal">
              Currently active
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="act-notes">Notes</Label>
            <Textarea id="act-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add Activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddAchievementDialog({
  memberId,
  activities,
  onClose,
  onSaved,
}: {
  memberId: string
  activities: Array<ActivityRow>
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createAchievementFn({
        data: {
          familyMemberId: memberId,
          activityId: str(f, "activityId"),
          title: String(f.get("title") ?? ""),
          description: str(f, "description"),
          dateEarned: str(f, "dateEarned"),
          issuer: str(f, "issuer"),
          notes: str(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add achievement.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add achievement</DialogTitle>
          <DialogDescription>
            Awards, milestones, and recognitions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ach-title">Title *</Label>
            <Input id="ach-title" name="title" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ach-description">Description</Label>
            <Input id="ach-description" name="description" />
          </div>
          {activities.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="ach-activityId">Related Activity</Label>
              <select
                id="ach-activityId"
                name="activityId"
                className={selectClass}
                defaultValue=""
              >
                <option value="">None</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ach-dateEarned">Date Earned</Label>
              <Input id="ach-dateEarned" name="dateEarned" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-issuer">Issuer</Label>
              <Input id="ach-issuer" name="issuer" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ach-notes">Notes</Label>
            <Textarea id="ach-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add Achievement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddCertificationDialog({
  memberId,
  onClose,
  onSaved,
}: {
  memberId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createCertificationFn({
        data: {
          familyMemberId: memberId,
          name: String(f.get("name") ?? ""),
          issuingBody: str(f, "issuingBody"),
          credentialId: str(f, "credentialId"),
          issueDate: str(f, "issueDate"),
          expirationDate: str(f, "expirationDate"),
          status: String(f.get("status") ?? "ACTIVE") as CertificationStatus,
          renewalCost: num(f, "renewalCost"),
          url: str(f, "url"),
          notes: str(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add certification.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add certification</DialogTitle>
          <DialogDescription>
            Track credentials, licenses, and renewals.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cert-name">Certification Name *</Label>
            <Input id="cert-name" name="name" required autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cert-issuingBody">Issuing Body</Label>
              <Input id="cert-issuingBody" name="issuingBody" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-credentialId">Credential ID</Label>
              <Input id="cert-credentialId" name="credentialId" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cert-issueDate">Issue Date</Label>
              <Input id="cert-issueDate" name="issueDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-expirationDate">Expiration Date</Label>
              <Input
                id="cert-expirationDate"
                name="expirationDate"
                type="date"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cert-status">Status</Label>
              <select
                id="cert-status"
                name="status"
                className={selectClass}
                defaultValue="ACTIVE"
              >
                {Object.entries(CERT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-renewalCost">Renewal Cost</Label>
              <Input
                id="cert-renewalCost"
                name="renewalCost"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cert-url">URL</Label>
            <Input
              id="cert-url"
              name="url"
              type="url"
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cert-notes">Notes</Label>
            <Textarea id="cert-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add Certification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
