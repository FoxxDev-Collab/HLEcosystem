import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { BookOpen, Plus, Trash2 } from "lucide-react"
import {
  createGradeReportFn,
  deleteGradeReportFn,
  getGradesPageFn,
} from "@/server/hub/fns.education"
import type { EntryOptionRow, GradeTerm } from "@/server/hub/education"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/hub/education/grades")({
  loader: () => getGradesPageFn(),
  component: GradesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const GRADE_TERMS: Array<{ value: GradeTerm; label: string }> = [
  { value: "QUARTER_1", label: "Quarter 1" },
  { value: "QUARTER_2", label: "Quarter 2" },
  { value: "QUARTER_3", label: "Quarter 3" },
  { value: "QUARTER_4", label: "Quarter 4" },
  { value: "SEMESTER_1", label: "Semester 1" },
  { value: "SEMESTER_2", label: "Semester 2" },
  { value: "TRIMESTER_1", label: "Trimester 1" },
  { value: "TRIMESTER_2", label: "Trimester 2" },
  { value: "TRIMESTER_3", label: "Trimester 3" },
  { value: "SUMMER", label: "Summer" },
  { value: "FULL_YEAR", label: "Full Year" },
]

function termLabel(term: GradeTerm): string {
  return GRADE_TERMS.find((t) => t.value === term)?.label ?? term
}

type MemberOption = {
  id: string
  name: string
  entries: Array<{ id: string; label: string }>
}

function buildMemberOptions(rows: Array<EntryOptionRow>): Array<MemberOption> {
  const byMember = new Map<string, MemberOption>()
  for (const row of rows) {
    let member = byMember.get(row.memberId)
    if (!member) {
      member = {
        id: row.memberId,
        name: `${row.firstName} ${row.lastName}`,
        entries: [],
      }
      byMember.set(row.memberId, member)
    }
    member.entries.push({
      id: row.entryId,
      label: `${row.institution}${row.degreeType ? ` (${row.degreeType.replace(/_/g, " ")})` : ""}`,
    })
  }
  return Array.from(byMember.values())
}

function GradesPage() {
  const { entryOptions, reports, items } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    label: string
  } | null>(null)

  const memberOptions = buildMemberOptions(entryOptions)

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Grade Reports</h1>
        <p className="text-sm text-muted-foreground">
          Enter and view grade reports for family members.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left: existing reports */}
        <div className="space-y-4">
          {reports.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No grade reports yet. Use the form to add one.
                </p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => {
              const grades = items.filter((g) => g.gradeReportId === report.id)
              return (
                <Card key={report.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          <Link
                            to="/hub/education/$memberId"
                            params={{ memberId: report.memberId }}
                            className="hover:underline"
                          >
                            {report.firstName} {report.lastName}
                          </Link>{" "}
                          &mdash; {report.institution}
                        </CardTitle>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px]">
                            {report.schoolYear}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px]">
                            {termLabel(report.term)}
                          </Badge>
                          {report.overallGpa !== null && (
                            <Badge variant="secondary" className="text-[9px]">
                              GPA: {report.overallGpa}
                            </Badge>
                          )}
                          {report.reportDate && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(report.reportDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete report"
                        onClick={() =>
                          setDeleteTarget({
                            id: report.id,
                            label: `${report.firstName}'s ${report.schoolYear} ${termLabel(report.term)} report`,
                          })
                        }
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_60px_60px] gap-2 border-b pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                        <span>Subject</span>
                        <span className="text-right">Grade</span>
                        <span className="text-right">%</span>
                      </div>
                      {grades.map((grade) => (
                        <div
                          key={grade.id}
                          className="grid grid-cols-[1fr_60px_60px] gap-2 py-0.5 text-sm"
                        >
                          <div>
                            <span>{grade.subject}</span>
                            {grade.teacher && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                ({grade.teacher})
                              </span>
                            )}
                          </div>
                          <span className="text-right font-medium">
                            {grade.grade}
                          </span>
                          <span className="text-right text-muted-foreground">
                            {grade.percentage !== null
                              ? `${grade.percentage}%`
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {report.notes && (
                      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        {report.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Right: add form */}
        <div>
          {memberOptions.length > 0 ? (
            <GradeReportForm memberOptions={memberOptions} onSaved={refresh} />
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Add education entries to family members before creating grade
                  reports.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {deleteTarget && (
        <DeleteReportDialog
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

type GradeRow = {
  subject: string
  grade: string
  percentage: string
  credits: string
  teacher: string
  notes: string
}

const emptyRow: GradeRow = {
  subject: "",
  grade: "",
  percentage: "",
  credits: "",
  teacher: "",
  notes: "",
}

function GradeReportForm({
  memberOptions,
  onSaved,
}: {
  memberOptions: Array<MemberOption>
  onSaved: () => void
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(
    memberOptions[0]?.id ?? ""
  )
  const [gradeRows, setGradeRows] = useState<Array<GradeRow>>([{ ...emptyRow }])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const selectedMember = memberOptions.find((m) => m.id === selectedMemberId)
  const entries = selectedMember?.entries ?? []

  function addRow() {
    setGradeRows((prev) => [...prev, { ...emptyRow }])
  }

  function removeRow(index: number) {
    setGradeRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: keyof GradeRow, value: string) {
    setGradeRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const f = new FormData(form)
    // Legacy rule: only rows with both a subject and a grade are saved, and
    // at least one is required.
    const items = gradeRows
      .filter((row) => row.subject.trim() && row.grade.trim())
      .map((row) => ({
        subject: row.subject.trim(),
        grade: row.grade.trim(),
        percentage: row.percentage.trim() ? Number(row.percentage) : null,
        credits: row.credits.trim() ? Number(row.credits) : null,
        teacher: row.teacher.trim() || null,
        notes: row.notes.trim() || null,
      }))
    if (items.length === 0) {
      setError("Add at least one subject with a grade.")
      return
    }
    setPending(true)
    try {
      const reportDate = f.get("reportDate")
      const overallGpa = f.get("overallGpa")
      const notes = f.get("reportNotes")
      const result = await createGradeReportFn({
        data: {
          educationEntryId: String(f.get("educationEntryId") ?? ""),
          schoolYear: String(f.get("schoolYear") ?? ""),
          term: String(f.get("term") ?? "QUARTER_1") as GradeTerm,
          reportDate:
            typeof reportDate === "string" && reportDate ? reportDate : null,
          overallGpa:
            typeof overallGpa === "string" && overallGpa.trim()
              ? Number(overallGpa)
              : null,
          notes:
            typeof notes === "string" && notes.trim() ? notes.trim() : null,
          items,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setGradeRows([{ ...emptyRow }])
      setPending(false)
      onSaved()
    } catch {
      setError("Could not save grade report.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" />
          New Grade Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="gr-member">Family Member *</Label>
            <select
              id="gr-member"
              className={selectClass}
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gr-entry">Education Entry *</Label>
            <select
              id="gr-entry"
              name="educationEntryId"
              required
              className={selectClass}
            >
              {entries.length === 0 ? (
                <option value="">No education entries</option>
              ) : (
                entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="gr-schoolYear">School Year *</Label>
              <Input
                id="gr-schoolYear"
                name="schoolYear"
                placeholder="2025-2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gr-term">Term *</Label>
              <select id="gr-term" name="term" required className={selectClass}>
                {GRADE_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="gr-reportDate">Report Date</Label>
              <Input id="gr-reportDate" name="reportDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gr-overallGpa">Overall GPA</Label>
              <Input
                id="gr-overallGpa"
                name="overallGpa"
                type="number"
                step="0.01"
                min="0"
                max="5"
              />
            </div>
          </div>

          {/* Dynamic grade rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subjects</Label>
              <Button type="button" variant="ghost" size="xs" onClick={addRow}>
                <Plus className="size-3" /> Add Subject
              </Button>
            </div>

            {gradeRows.map((row, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Subject {index + 1}
                  </span>
                  {gradeRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      title="Remove subject"
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 className="size-2.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Subject *"
                    value={row.subject}
                    onChange={(e) =>
                      updateRow(index, "subject", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Grade (A, B+, etc.) *"
                    value={row.grade}
                    onChange={(e) => updateRow(index, "grade", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="%"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={row.percentage}
                    onChange={(e) =>
                      updateRow(index, "percentage", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Credits"
                    type="number"
                    step="0.5"
                    min="0"
                    value={row.credits}
                    onChange={(e) =>
                      updateRow(index, "credits", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Teacher"
                    value={row.teacher}
                    onChange={(e) =>
                      updateRow(index, "teacher", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <Textarea name="reportNotes" placeholder="Report notes" rows={2} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            <BookOpen className="size-3" />
            {pending ? "Saving…" : "Save Grade Report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteReportDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: { id: string; label: string }
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteGradeReportFn({ data: { id: target.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete report.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {target.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            All grade line items in this report are deleted too.
          </AlertDialogDescription>
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
