import { sql } from "@/server/db"

export type ImportantDateType =
  "BIRTHDAY" | "ANNIVERSARY" | "GRADUATION" | "MEMORIAL" | "HOLIDAY" | "CUSTOM"

export type RecurrenceType = "ONCE" | "ANNUAL"

export type ImportantDateRow = {
  id: string
  familyMemberId: string | null
  label: string
  date: string // DATE → "YYYY-MM-DD"
  type: ImportantDateType
  recurrenceType: RecurrenceType
  reminderDaysBefore: number
  notes: string | null
  memberFirstName: string | null
  memberLastName: string | null
}

type DerivedMemberDateRow = {
  familyMemberId: string
  firstName: string
  lastName: string
  date: string
  type: "BIRTHDAY" | "ANNIVERSARY"
}

export type MemberOption = {
  id: string
  firstName: string
  lastName: string
}

// Unified shape for the dates page, the dashboard upcoming list and the
// calendar: real ImportantDate rows plus read-only events derived from
// FamilyMember birthdays/anniversaries, each decorated with its next
// occurrence and a day count.
export type HubDateEvent = {
  id: string
  derived: boolean
  familyMemberId: string | null
  memberName: string | null
  label: string
  date: string
  type: ImportantDateType
  recurrenceType: RecurrenceType
  reminderDaysBefore: number | null
  notes: string | null
  nextDate: string // "YYYY-MM-DD"
  days: number
}

export type TodoDueRow = {
  id: string
  title: string
  dueDate: string
}

// ── Pure date math (mirrors legacy hle-familyhub computation exactly) ──────

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// ANNUAL dates recur: move to this year's occurrence, roll to next year if
// already passed. ONCE dates stay put.
export function nextOccurrence(
  date: string,
  recurrenceType: RecurrenceType
): Date {
  const base = parseDateOnly(date)
  if (recurrenceType === "ONCE") return base
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(base)
  next.setFullYear(today.getFullYear())
  if (next < today) {
    next.setFullYear(today.getFullYear() + 1)
  }
  return next
}

export function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function listImportantDates(
  householdId: string
): Promise<Array<ImportantDateRow>> {
  return await sql`
    SELECT d."id", d."familyMemberId", d."label", d."date"::text AS "date",
           d."type", d."recurrenceType", d."reminderDaysBefore", d."notes",
           fm."firstName" AS "memberFirstName", fm."lastName" AS "memberLastName"
    FROM "ImportantDate" d
    LEFT JOIN "FamilyMember" fm ON fm."id" = d."familyMemberId"
    WHERE d."householdId" = ${householdId}
    ORDER BY d."date" ASC
  `
}

// Birthdays/anniversaries derived from FamilyMember profiles (read-only —
// the legacy app synced these into ImportantDate from the people module; here
// we derive them at read time). Members that already have an explicit
// ImportantDate of the same type are skipped to avoid duplicates.
async function listDerivedMemberDates(
  householdId: string
): Promise<Array<DerivedMemberDateRow>> {
  return await sql`
    SELECT fm."id" AS "familyMemberId", fm."firstName", fm."lastName",
           fm."birthday"::text AS "date", 'BIRTHDAY' AS "type"
    FROM "FamilyMember" fm
    WHERE fm."householdId" = ${householdId}
      AND fm."isActive" = true
      AND fm."birthday" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ImportantDate" d
        WHERE d."householdId" = ${householdId}
          AND d."familyMemberId" = fm."id"
          AND d."type" = 'BIRTHDAY'
      )
    UNION ALL
    SELECT fm."id", fm."firstName", fm."lastName",
           fm."anniversary"::text, 'ANNIVERSARY'
    FROM "FamilyMember" fm
    WHERE fm."householdId" = ${householdId}
      AND fm."isActive" = true
      AND fm."anniversary" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ImportantDate" d
        WHERE d."householdId" = ${householdId}
          AND d."familyMemberId" = fm."id"
          AND d."type" = 'ANNIVERSARY'
      )
  `
}

// All date events for a household — explicit ImportantDate rows plus derived
// member birthdays/anniversaries — decorated and sorted soonest-first.
export async function listAllDateEvents(
  householdId: string
): Promise<Array<HubDateEvent>> {
  const [rows, derived] = await Promise.all([
    listImportantDates(householdId),
    listDerivedMemberDates(householdId),
  ])

  const events: Array<HubDateEvent> = [
    ...rows.map((d) => ({
      id: d.id,
      derived: false,
      familyMemberId: d.familyMemberId,
      memberName: d.memberFirstName
        ? `${d.memberFirstName} ${d.memberLastName}`
        : null,
      label: d.label,
      date: d.date,
      type: d.type,
      recurrenceType: d.recurrenceType,
      reminderDaysBefore: d.reminderDaysBefore,
      notes: d.notes,
      nextDate: "",
      days: 0,
    })),
    ...derived.map((d) => ({
      id: `member:${d.familyMemberId}:${d.type}`,
      derived: true,
      familyMemberId: d.familyMemberId,
      memberName: `${d.firstName} ${d.lastName}`,
      // Same labels the legacy people-module sync produced.
      label:
        d.type === "BIRTHDAY"
          ? `${d.firstName} ${d.lastName}'s Birthday`
          : `${d.firstName} ${d.lastName} — Wedding Anniversary`,
      date: d.date,
      type: d.type,
      recurrenceType: "ANNUAL" as const,
      reminderDaysBefore: null,
      notes: null,
      nextDate: "",
      days: 0,
    })),
  ]

  for (const e of events) {
    const next = nextOccurrence(e.date, e.recurrenceType)
    e.nextDate = toDateString(next)
    e.days = daysUntil(next)
  }
  return events.sort((a, b) => a.days - b.days)
}

export async function listMemberOptions(
  householdId: string
): Promise<Array<MemberOption>> {
  return await sql`
    SELECT "id", "firstName", "lastName"
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId} AND "isActive" = true
    ORDER BY "firstName" ASC
  `
}

// Read-only view of another module's tables (todos) for the calendar — the
// legacy calendar overlays open todo items that have a due date.
export async function listOpenTodoDueDates(
  householdId: string
): Promise<Array<TodoDueRow>> {
  return await sql`
    SELECT ti."id", ti."title", ti."dueDate"::text AS "dueDate"
    FROM "TodoItem" ti
    JOIN "TodoList" tl ON tl."id" = ti."listId"
    WHERE tl."householdId" = ${householdId}
      AND ti."dueDate" IS NOT NULL
      AND ti."status" <> 'DONE'
  `
}

// ── Mutations ───────────────────────────────────────────────────────────────

export type ImportantDateInput = {
  label: string
  date: string
  type: ImportantDateType
  recurrenceType: RecurrenceType
  reminderDaysBefore: number
  familyMemberId: string | null
  notes: string | null
}

// Re-verify a client-supplied member id belongs to this household before any
// write references it (ADR-0005 — never trust IDs from the client).
async function memberInHousehold(
  memberId: string,
  householdId: string
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM "FamilyMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}
    LIMIT 1
  `
  return rows.length > 0
}

export async function createImportantDate(
  householdId: string,
  input: ImportantDateInput
): Promise<{ ok: true } | { error: string }> {
  if (input.familyMemberId) {
    const owned = await memberInHousehold(input.familyMemberId, householdId)
    if (!owned) return { error: "Family member not found in this household." }
  }
  await sql`
    INSERT INTO "ImportantDate"
      ("householdId", "familyMemberId", "label", "date", "type",
       "recurrenceType", "reminderDaysBefore", "notes")
    VALUES
      (${householdId}, ${input.familyMemberId}, ${input.label}, ${input.date},
       ${input.type}, ${input.recurrenceType}, ${input.reminderDaysBefore},
       ${input.notes})
  `
  return { ok: true }
}

export async function updateImportantDate(
  householdId: string,
  id: string,
  input: ImportantDateInput
): Promise<{ ok: true } | { error: string }> {
  if (input.familyMemberId) {
    const owned = await memberInHousehold(input.familyMemberId, householdId)
    if (!owned) return { error: "Family member not found in this household." }
  }
  const rows = await sql`
    UPDATE "ImportantDate"
    SET "familyMemberId" = ${input.familyMemberId},
        "label" = ${input.label},
        "date" = ${input.date},
        "type" = ${input.type},
        "recurrenceType" = ${input.recurrenceType},
        "reminderDaysBefore" = ${input.reminderDaysBefore},
        "notes" = ${input.notes}
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"
  `
  if (rows.length === 0) return { error: "Date not found." }
  return { ok: true }
}

export async function deleteImportantDate(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    DELETE FROM "ImportantDate"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
  `
}
