import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { BookOpen, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteGradeReportAction } from "../actions";
import { GradeReportForm } from "./grade-report-form";

export default async function GradesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const members = await prisma.familyMember.findMany({
    where: { householdId, isActive: true },
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
    },
    orderBy: { firstName: "asc" },
  });

  // Build member/entry options for the form
  const memberOptions = members
    .filter((m) => m.educationEntries.length > 0)
    .map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      entries: m.educationEntries.map((e) => ({
        id: e.id,
        label: `${e.institution}${e.degreeType ? ` (${e.degreeType.replace("_", " ")})` : ""}`,
      })),
    }));

  // Flatten all reports for display
  const allReports = members.flatMap((m) =>
    m.educationEntries.flatMap((e) =>
      e.gradeReports.map((r) => ({
        ...r,
        memberName: `${m.firstName} ${m.lastName}`,
        memberId: m.id,
        institution: e.institution,
      }))
    )
  );

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grade Reports</h1>
        <p className="text-muted-foreground text-sm">
          Enter and view grade reports for family members.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: existing reports */}
        <div className="space-y-4">
          {allReports.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="size-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No grade reports yet. Use the form to add one.
                </p>
              </CardContent>
            </Card>
          ) : (
            allReports.map((report) => (
              <Card key={report.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {report.memberName} &mdash; {report.institution}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[9px]">
                          {report.schoolYear}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px]">
                          {report.term.replace("_", " ")}
                        </Badge>
                        {report.overallGpa && (
                          <Badge variant="secondary" className="text-[9px]">
                            GPA: {report.overallGpa.toString()}
                          </Badge>
                        )}
                        {report.reportDate && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(report.reportDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={deleteGradeReportAction}>
                      <input type="hidden" name="id" value={report.id} />
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
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_60px_60px] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider pb-1 border-b">
                      <span>Subject</span>
                      <span className="text-right">Grade</span>
                      <span className="text-right">%</span>
                    </div>
                    {report.grades.map((grade) => (
                      <div
                        key={grade.id}
                        className="grid grid-cols-[1fr_60px_60px] gap-2 text-sm py-0.5"
                      >
                        <div>
                          <span>{grade.subject}</span>
                          {grade.teacher && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({grade.teacher})
                            </span>
                          )}
                        </div>
                        <span className="text-right font-medium">
                          {grade.grade}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {grade.percentage
                            ? `${grade.percentage.toString()}%`
                            : "\u2014"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {report.notes && (
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                      {report.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right: add form */}
        <div>
          {memberOptions.length > 0 ? (
            <GradeReportForm memberOptions={memberOptions} />
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
    </div>
  );
}
