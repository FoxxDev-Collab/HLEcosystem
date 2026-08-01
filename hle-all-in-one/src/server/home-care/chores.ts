import { sql } from "@/server/db"

export type ChoreFrequency =
  "DAILY" | "WEEKLY" | "BI_WEEKLY" | "MONTHLY" | "CUSTOM_DAYS"

export type RotationMode = "NONE" | "ROUND_ROBIN" | "WEEKLY_ROTATION"

export type ChoreCompletionStatus =
  "PENDING" | "COMPLETED" | "SKIPPED" | "MISSED"

export type ChoreRow = {
  id: string
  title: string
  description: string | null
  roomId: string | null
  roomName: string | null
  frequency: ChoreFrequency
  customIntervalDays: number | null
  rotationMode: RotationMode
  pointValue: number
  estimatedMinutes: number | null
  isActive: boolean
}

export type ChoreAssignmentRow = {
  id: string
  choreId: string
  assigneeId: string
  assigneeName: string
  sortOrder: number
  isActive: boolean
}

export type ChoreCompletionRow = {
  id: string
  choreId: string
  completedById: string | null // NULL = unassigned (legacy sentinel "unassigned")
  completedByName: string
  dueDate: string
  completedDate: string | null
  status: ChoreCompletionStatus
  pointsEarned: number
  notes: string | null
}

export type RewardRow = {
  id: string
  title: string
  description: string | null
  pointCost: number
  isActive: boolean
}

export type RedemptionRow = {
  id: string
  rewardId: string
  rewardTitle: string
  redeemedById: string | null
  redeemedByName: string
  pointsSpent: number
  redeemedAt: Date
}

export type RoomOption = {
  id: string
  name: string
}

export type ChoreInput = {
  title: string
  description: string | null
  roomId: string | null
  frequency: ChoreFrequency
  customIntervalDays: number | null
  rotationMode: RotationMode
  pointValue: number
  estimatedMinutes: number | null
}

// ─── Date helpers (DATE columns travel as "YYYY-MM-DD" strings) ─────────────

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d + days)
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${dt.getFullYear()}-${mm}-${dd}`
}

// Week number since Jan 1 of the due date's year (legacy WEEKLY_ROTATION rule).
function weekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  const due = new Date(y, m - 1, d)
  const startOfYear = new Date(y, 0, 1)
  return Math.floor(
    (due.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)
  )
}

// ─── Rooms (picker options — Room CRUD is owned by the rooms feature) ────────

export async function listRoomOptions(
  householdId: string
): Promise<Array<RoomOption>> {
  return sql<Array<RoomOption>>`
    SELECT "id", "name" FROM "Room"
    WHERE "householdId" = ${householdId}
    ORDER BY "name" ASC`
}

// ─── Chores ──────────────────────────────────────────────────────────────────

export async function listChores(
  householdId: string
): Promise<Array<ChoreRow>> {
  return sql<Array<ChoreRow>>`
    SELECT c."id", c."title", c."description", c."roomId",
           r."name" AS "roomName", c."frequency", c."customIntervalDays",
           c."rotationMode", c."pointValue", c."estimatedMinutes", c."isActive"
    FROM "Chore" c
    LEFT JOIN "Room" r ON r."id" = c."roomId"
    WHERE c."householdId" = ${householdId}
    ORDER BY c."isActive" DESC, c."title" ASC`
}

export async function listActiveChores(
  householdId: string
): Promise<Array<ChoreRow>> {
  return sql<Array<ChoreRow>>`
    SELECT c."id", c."title", c."description", c."roomId",
           r."name" AS "roomName", c."frequency", c."customIntervalDays",
           c."rotationMode", c."pointValue", c."estimatedMinutes", c."isActive"
    FROM "Chore" c
    LEFT JOIN "Room" r ON r."id" = c."roomId"
    WHERE c."householdId" = ${householdId} AND c."isActive"
    ORDER BY c."title" ASC`
}

export async function choreBelongsToHousehold(
  householdId: string,
  choreId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Chore"
    WHERE "id" = ${choreId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export async function createChore(
  householdId: string,
  input: ChoreInput,
  assignees: Array<{ assigneeId: string; assigneeName: string }>
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Chore" (
      "householdId", "title", "description", "roomId", "frequency",
      "customIntervalDays", "rotationMode", "pointValue", "estimatedMinutes"
    ) VALUES (
      ${householdId}, ${input.title}, ${input.description}, ${input.roomId},
      ${input.frequency}::"ChoreFrequency", ${input.customIntervalDays},
      ${input.rotationMode}::"RotationMode", ${input.pointValue},
      ${input.estimatedMinutes}
    ) RETURNING "id"`
  const choreId = rows[0].id
  for (let i = 0; i < assignees.length; i++) {
    await sql`
      INSERT INTO "ChoreAssignment"
        ("choreId", "assigneeId", "assigneeName", "sortOrder")
      VALUES (${choreId}, ${assignees[i].assigneeId},
              ${assignees[i].assigneeName}, ${i})`
  }
  return choreId
}

export async function deleteChore(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Chore"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function toggleChoreActive(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Chore"
    SET "isActive" = NOT "isActive", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// ─── Assignments (child of Chore — scoped through the parent) ───────────────

export async function listAssignmentsForHousehold(
  householdId: string
): Promise<Array<ChoreAssignmentRow>> {
  return sql<Array<ChoreAssignmentRow>>`
    SELECT a."id", a."choreId", a."assigneeId", a."assigneeName",
           a."sortOrder", a."isActive"
    FROM "ChoreAssignment" a
    JOIN "Chore" c ON c."id" = a."choreId"
    WHERE c."householdId" = ${householdId}
    ORDER BY a."sortOrder" ASC`
}

export async function listActiveAssignments(
  householdId: string,
  choreId: string
): Promise<Array<ChoreAssignmentRow>> {
  return sql<Array<ChoreAssignmentRow>>`
    SELECT a."id", a."choreId", a."assigneeId", a."assigneeName",
           a."sortOrder", a."isActive"
    FROM "ChoreAssignment" a
    JOIN "Chore" c ON c."id" = a."choreId"
    WHERE a."choreId" = ${choreId} AND c."householdId" = ${householdId}
      AND a."isActive"
    ORDER BY a."sortOrder" ASC`
}

export async function addChoreAssignment(
  householdId: string,
  choreId: string,
  assigneeId: string,
  assigneeName: string
): Promise<void> {
  const [{ next }] = await sql<Array<{ next: number }>>`
    SELECT COALESCE(MAX(a."sortOrder"), -1) + 1 AS "next"
    FROM "ChoreAssignment" a
    JOIN "Chore" c ON c."id" = a."choreId"
    WHERE a."choreId" = ${choreId} AND c."householdId" = ${householdId}`
  await sql`
    INSERT INTO "ChoreAssignment"
      ("choreId", "assigneeId", "assigneeName", "sortOrder")
    VALUES (${choreId}, ${assigneeId}, ${assigneeName}, ${next})`
}

export async function removeChoreAssignment(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ChoreAssignment" a
    USING "Chore" c
    WHERE a."id" = ${id} AND c."id" = a."choreId"
      AND c."householdId" = ${householdId}
    RETURNING a."id"`
  return rows.length > 0
}

// ─── Completions ─────────────────────────────────────────────────────────────

export async function listCompletionsBetween(
  householdId: string,
  start: string,
  end: string
): Promise<Array<ChoreCompletionRow>> {
  return sql<Array<ChoreCompletionRow>>`
    SELECT "id", "choreId", "completedById", "completedByName",
           "dueDate"::text, "completedDate"::text, "status", "pointsEarned",
           "notes"
    FROM "ChoreCompletion"
    WHERE "householdId" = ${householdId}
      AND "dueDate" >= ${start} AND "dueDate" <= ${end}
    ORDER BY "dueDate" ASC`
}

// Creates PENDING completions for every active chore's occurrences in the
// week starting at weekStart (a Monday). DAILY chores get one per day; other
// frequencies get one at the start of the week. Assignee is chosen by the
// chore's rotation mode (legacy generateWeekChoresAction rules).
export async function generateWeekChores(
  householdId: string,
  weekStart: string
): Promise<void> {
  const chores = await sql<
    Array<{ id: string; frequency: ChoreFrequency; rotationMode: RotationMode }>
  >`
    SELECT "id", "frequency", "rotationMode"
    FROM "Chore"
    WHERE "householdId" = ${householdId} AND "isActive"`

  for (const chore of chores) {
    const assignments = await listActiveAssignments(householdId, chore.id)
    const occurrences =
      chore.frequency === "DAILY"
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : [weekStart]

    for (const dueDate of occurrences) {
      const existing = await sql<Array<{ id: string }>>`
        SELECT "id" FROM "ChoreCompletion"
        WHERE "choreId" = ${chore.id} AND "householdId" = ${householdId}
          AND "dueDate" = ${dueDate}
        LIMIT 1`
      if (existing.length > 0) continue

      let assigneeId: string | null = null
      let assigneeName = "Unassigned"
      if (assignments.length > 0) {
        if (chore.rotationMode === "ROUND_ROBIN" && assignments.length > 1) {
          // Next in line by occurrence index (total completions so far).
          const [{ n }] = await sql<Array<{ n: number }>>`
            SELECT count(*)::int AS "n" FROM "ChoreCompletion"
            WHERE "choreId" = ${chore.id} AND "householdId" = ${householdId}`
          const a = assignments[n % assignments.length]
          assigneeId = a.assigneeId
          assigneeName = a.assigneeName
        } else if (chore.rotationMode === "WEEKLY_ROTATION") {
          const a = assignments[weekNumber(dueDate) % assignments.length]
          assigneeId = a.assigneeId
          assigneeName = a.assigneeName
        } else {
          assigneeId = assignments[0].assigneeId
          assigneeName = assignments[0].assigneeName
        }
      }

      await sql`
        INSERT INTO "ChoreCompletion"
          ("householdId", "choreId", "completedById", "completedByName",
           "dueDate", "status")
        VALUES (${householdId}, ${chore.id}, ${assigneeId}, ${assigneeName},
                ${dueDate}, 'PENDING')`
    }
  }
}

// Marks a completion COMPLETED, awards the chore's point value, and — when the
// chore rotates — re-targets future PENDING completions to the next assignee.
export async function completeChore(
  householdId: string,
  completionId: string,
  notes: string | null
): Promise<boolean> {
  const rows = await sql<
    Array<{
      choreId: string
      completedById: string | null
      dueDate: string
      pointValue: number
      rotationMode: RotationMode
    }>
  >`
    SELECT c."choreId", c."completedById", c."dueDate"::text,
           ch."pointValue", ch."rotationMode"
    FROM "ChoreCompletion" c
    JOIN "Chore" ch ON ch."id" = c."choreId"
    WHERE c."id" = ${completionId} AND c."householdId" = ${householdId}`
  const completion = rows[0]
  if (!completion) return false

  await sql`
    UPDATE "ChoreCompletion"
    SET "status" = 'COMPLETED', "completedDate" = CURRENT_DATE,
        "pointsEarned" = ${completion.pointValue}, "notes" = ${notes}
    WHERE "id" = ${completionId} AND "householdId" = ${householdId}`

  if (completion.rotationMode !== "NONE") {
    const assignments = await listActiveAssignments(
      householdId,
      completion.choreId
    )
    if (assignments.length > 1) {
      const currentIndex = assignments.findIndex(
        (a) => a.assigneeId === completion.completedById
      )
      if (currentIndex >= 0) {
        const next = assignments[(currentIndex + 1) % assignments.length]
        await sql`
          UPDATE "ChoreCompletion"
          SET "completedById" = ${next.assigneeId},
              "completedByName" = ${next.assigneeName}
          WHERE "choreId" = ${completion.choreId}
            AND "householdId" = ${householdId}
            AND "status" = 'PENDING'
            AND "dueDate" > ${completion.dueDate}`
      }
    }
  }
  return true
}

export async function skipChore(
  householdId: string,
  completionId: string,
  notes: string | null
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "ChoreCompletion"
    SET "status" = 'SKIPPED', "notes" = ${notes}
    WHERE "id" = ${completionId} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// ─── Points ──────────────────────────────────────────────────────────────────

export async function listEarnedPoints(
  householdId: string
): Promise<Array<{ completedById: string | null; earned: number }>> {
  return sql<Array<{ completedById: string | null; earned: number }>>`
    SELECT "completedById", COALESCE(SUM("pointsEarned"), 0)::int AS "earned"
    FROM "ChoreCompletion"
    WHERE "householdId" = ${householdId} AND "status" = 'COMPLETED'
    GROUP BY "completedById"`
}

export async function listSpentPoints(
  householdId: string
): Promise<Array<{ redeemedById: string | null; spent: number }>> {
  return sql<Array<{ redeemedById: string | null; spent: number }>>`
    SELECT "redeemedById", COALESCE(SUM("pointsSpent"), 0)::int AS "spent"
    FROM "RewardRedemption"
    WHERE "householdId" = ${householdId}
    GROUP BY "redeemedById"`
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export async function listRewards(
  householdId: string
): Promise<Array<RewardRow>> {
  return sql<Array<RewardRow>>`
    SELECT "id", "title", "description", "pointCost", "isActive"
    FROM "ChoreReward"
    WHERE "householdId" = ${householdId}
    ORDER BY "isActive" DESC, "pointCost" ASC`
}

export async function listRedemptions(
  householdId: string
): Promise<Array<RedemptionRow>> {
  return sql<Array<RedemptionRow>>`
    SELECT rd."id", rd."rewardId", rw."title" AS "rewardTitle",
           rd."redeemedById", rd."redeemedByName", rd."pointsSpent",
           rd."redeemedAt"
    FROM "RewardRedemption" rd
    JOIN "ChoreReward" rw ON rw."id" = rd."rewardId"
    WHERE rd."householdId" = ${householdId}
    ORDER BY rd."redeemedAt" DESC
    LIMIT 50`
}

export async function createReward(
  householdId: string,
  title: string,
  description: string | null,
  pointCost: number
): Promise<void> {
  await sql`
    INSERT INTO "ChoreReward" ("householdId", "title", "description", "pointCost")
    VALUES (${householdId}, ${title}, ${description}, ${pointCost})`
}

export async function deleteReward(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ChoreReward"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Balance = Σ pointsEarned (COMPLETED) − Σ pointsSpent. Returns an error
// message when the member can't afford the reward, null on success.
export async function redeemReward(
  householdId: string,
  rewardId: string,
  redeemedById: string,
  redeemedByName: string
): Promise<string | null> {
  const rewards = await sql<Array<{ id: string; pointCost: number }>>`
    SELECT "id", "pointCost" FROM "ChoreReward"
    WHERE "id" = ${rewardId} AND "householdId" = ${householdId} AND "isActive"`
  const reward = rewards[0]
  if (!reward) return "Reward not found"

  const [{ earned }] = await sql<Array<{ earned: number }>>`
    SELECT COALESCE(SUM("pointsEarned"), 0)::int AS "earned"
    FROM "ChoreCompletion"
    WHERE "householdId" = ${householdId}
      AND "completedById" = ${redeemedById} AND "status" = 'COMPLETED'`
  const [{ spent }] = await sql<Array<{ spent: number }>>`
    SELECT COALESCE(SUM("pointsSpent"), 0)::int AS "spent"
    FROM "RewardRedemption"
    WHERE "householdId" = ${householdId} AND "redeemedById" = ${redeemedById}`

  const balance = earned - spent
  if (balance < reward.pointCost) {
    return `Not enough points. Balance: ${balance}, Cost: ${reward.pointCost}`
  }

  await sql`
    INSERT INTO "RewardRedemption"
      ("householdId", "rewardId", "redeemedById", "redeemedByName", "pointsSpent")
    VALUES (${householdId}, ${rewardId}, ${redeemedById}, ${redeemedByName},
            ${reward.pointCost})`
  return null
}
