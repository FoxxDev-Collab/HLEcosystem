"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { addGradeReportAction } from "../actions";

const GRADE_TERMS = [
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
];

type MemberOption = {
  id: string;
  name: string;
  entries: { id: string; label: string }[];
};

export function GradeReportForm({
  memberOptions,
}: {
  memberOptions: MemberOption[];
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(
    memberOptions[0]?.id ?? ""
  );
  const [gradeRows, setGradeRows] = useState([
    { subject: "", grade: "", percentage: "", credits: "", teacher: "", notes: "" },
  ]);

  const selectedMember = memberOptions.find((m) => m.id === selectedMemberId);
  const entries = selectedMember?.entries ?? [];

  function addRow() {
    setGradeRows((prev) => [
      ...prev,
      { subject: "", grade: "", percentage: "", credits: "", teacher: "", notes: "" },
    ]);
  }

  function removeRow(index: number) {
    setGradeRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: string, value: string) {
    setGradeRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="size-4" />
          New Grade Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={addGradeReportAction} className="space-y-3">
          {/* Member selector */}
          <div className="space-y-1">
            <Label className="text-xs">Family Member *</Label>
            <select
              name="familyMemberId"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Education entry selector */}
          <div className="space-y-1">
            <Label className="text-xs">Education Entry *</Label>
            <select
              name="educationEntryId"
              required
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {entries.length === 0 ? (
                <option value="">No education entries</option>
              ) : (
                entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid gap-2 grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">School Year *</Label>
              <Input
                name="schoolYear"
                placeholder="2025-2026"
                required
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Term *</Label>
              <select
                name="term"
                required
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {GRADE_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Report Date</Label>
              <Input
                name="reportDate"
                type="date"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Overall GPA</Label>
              <Input
                name="overallGpa"
                type="number"
                step="0.01"
                min="0"
                max="5"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Dynamic grade rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Subjects</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={addRow}
              >
                <Plus className="size-3 mr-1" /> Add Subject
              </Button>
            </div>

            {gradeRows.map((row, index) => (
              <div key={index} className="rounded-lg border p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Subject {index + 1}
                  </span>
                  {gradeRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-destructive"
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 className="size-2.5" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <Input
                    name={`subject_${index}`}
                    placeholder="Subject *"
                    required
                    value={row.subject}
                    onChange={(e) =>
                      updateRow(index, "subject", e.target.value)
                    }
                    className="h-7 text-xs"
                  />
                  <Input
                    name={`grade_${index}`}
                    placeholder="Grade (A, B+, etc.) *"
                    required
                    value={row.grade}
                    onChange={(e) =>
                      updateRow(index, "grade", e.target.value)
                    }
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid gap-2 grid-cols-3">
                  <Input
                    name={`percentage_${index}`}
                    placeholder="%"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={row.percentage}
                    onChange={(e) =>
                      updateRow(index, "percentage", e.target.value)
                    }
                    className="h-7 text-xs"
                  />
                  <Input
                    name={`credits_${index}`}
                    placeholder="Credits"
                    type="number"
                    step="0.5"
                    min="0"
                    value={row.credits}
                    onChange={(e) =>
                      updateRow(index, "credits", e.target.value)
                    }
                    className="h-7 text-xs"
                  />
                  <Input
                    name={`teacher_${index}`}
                    placeholder="Teacher"
                    value={row.teacher}
                    onChange={(e) =>
                      updateRow(index, "teacher", e.target.value)
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <Textarea
            name="reportNotes"
            placeholder="Report notes"
            rows={1}
            className="text-sm"
          />

          <Button type="submit" size="sm" className="w-full h-9">
            <BookOpen className="size-3 mr-1.5" />
            Save Grade Report
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
