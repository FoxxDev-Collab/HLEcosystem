// Finance budget planner (legacy budget-planner/actions.ts + pages).
// Projects with line items: lineTotal = quantity × unitCost, and the
// project's totalCost rollup is recomputed on every item mutation.
//
// SECURITY (ADR-0005): BudgetPlannerItem has no householdId — it scopes
// through its parent BudgetPlannerProject. Every mutation re-verifies
// ownership before writing; src/server/finance/budget-planner.test.ts is the
// regression test ported from the legacy actions.test.ts.
import { sql } from "@/server/db"

export type BudgetPlannerProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"

export const PROJECT_STATUSES: Array<BudgetPlannerProjectStatus> = [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]

export type ProjectRow = {
  id: string
  name: string
  description: string | null
  status: BudgetPlannerProjectStatus
  targetDate: string | null
  totalCost: number
  color: string | null
  itemCount: number
  purchasedCount: number
  purchasedCost: number
}

export type ProjectItemRow = {
  id: string
  projectId: string
  name: string
  description: string | null
  quantity: number
  unitCost: number
  lineTotal: number
  isPurchased: boolean
  referenceUrl: string | null
}

export async function listProjects(
  householdId: string
): Promise<Array<ProjectRow>> {
  return sql<Array<ProjectRow>>`
    SELECT p."id", p."name", p."description", p."status",
           p."targetDate"::text, p."totalCost"::float8, p."color",
           (SELECT count(*)::int FROM "BudgetPlannerItem" i
             WHERE i."projectId" = p."id") AS "itemCount",
           (SELECT count(*)::int FROM "BudgetPlannerItem" i
             WHERE i."projectId" = p."id" AND i."isPurchased")
             AS "purchasedCount",
           COALESCE((SELECT SUM(i."lineTotal")::float8
             FROM "BudgetPlannerItem" i
             WHERE i."projectId" = p."id" AND i."isPurchased"), 0)
             AS "purchasedCost"
    FROM "BudgetPlannerProject" p
    WHERE p."householdId" = ${householdId}
    ORDER BY p."status" ASC, p."createdAt" DESC`
}

// Available funds for the affordability summary (sum of active account
// balances — legacy budget-planner page behavior).
export async function getAvailableFunds(householdId: string): Promise<number> {
  const [row] = await sql<Array<{ total: number }>>`
    SELECT COALESCE(SUM("currentBalance")::float8, 0) AS "total"
    FROM "Account"
    WHERE "householdId" = ${householdId} AND NOT "isArchived"`
  return row.total
}

export async function getProject(
  householdId: string,
  id: string
): Promise<ProjectRow | null> {
  const [row] = await sql<Array<ProjectRow>>`
    SELECT p."id", p."name", p."description", p."status",
           p."targetDate"::text, p."totalCost"::float8, p."color",
           (SELECT count(*)::int FROM "BudgetPlannerItem" i
             WHERE i."projectId" = p."id") AS "itemCount",
           (SELECT count(*)::int FROM "BudgetPlannerItem" i
             WHERE i."projectId" = p."id" AND i."isPurchased")
             AS "purchasedCount",
           COALESCE((SELECT SUM(i."lineTotal")::float8
             FROM "BudgetPlannerItem" i
             WHERE i."projectId" = p."id" AND i."isPurchased"), 0)
             AS "purchasedCost"
    FROM "BudgetPlannerProject" p
    WHERE p."id" = ${id} AND p."householdId" = ${householdId}`
  return row ?? null
}

// Items scope through the parent project (child table, no householdId).
export async function listProjectItems(
  householdId: string,
  projectId: string
): Promise<Array<ProjectItemRow>> {
  return sql<Array<ProjectItemRow>>`
    SELECT i."id", i."projectId", i."name", i."description", i."quantity",
           i."unitCost"::float8, i."lineTotal"::float8, i."isPurchased",
           i."referenceUrl"
    FROM "BudgetPlannerItem" i
    JOIN "BudgetPlannerProject" p ON p."id" = i."projectId"
    WHERE i."projectId" = ${projectId} AND p."householdId" = ${householdId}
    ORDER BY i."sortOrder" ASC, i."createdAt" ASC`
}

export type ProjectInput = {
  name: string
  description: string | null
  targetDate: string | null
  color: string
}

export async function createProject(
  householdId: string,
  input: ProjectInput
): Promise<{ id: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO "BudgetPlannerProject" (
      "householdId", "name", "description", "targetDate", "color"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.description},
      ${input.targetDate}, ${input.color}
    ) RETURNING "id"`
  return row
}

export async function updateProject(
  householdId: string,
  id: string,
  input: ProjectInput
): Promise<{ ok: true } | { error: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "BudgetPlannerProject"
    SET "name" = ${input.name}, "description" = ${input.description},
        "targetDate" = ${input.targetDate}, "color" = ${input.color},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Project not found" }
  return { ok: true }
}

export async function updateProjectStatus(
  householdId: string,
  id: string,
  status: BudgetPlannerProjectStatus
): Promise<{ ok: true } | { error: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "BudgetPlannerProject"
    SET "status" = ${status}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Project not found" }
  return { ok: true }
}

export async function deleteProject(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  // Scoped lookup first (ADR-0005). Items cascade via FK.
  const [project] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "BudgetPlannerProject"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!project) return { error: "Project not found" }

  await sql`DELETE FROM "BudgetPlannerProject" WHERE "id" = ${project.id}`
  return { ok: true }
}

export async function duplicateProject(
  householdId: string,
  id: string
): Promise<{ newProjectId: string } | { error: string }> {
  // Foreign-project read prevention: the source must belong to the caller.
  const [source] = await sql<
    Array<{
      id: string
      name: string
      description: string | null
      color: string | null
      totalCost: number
    }>
  >`
    SELECT "id", "name", "description", "color", "totalCost"::float8
    FROM "BudgetPlannerProject"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!source) return { error: "Project not found" }

  const newProjectId = await sql.begin(async (tx) => {
    const [newProject] = await tx<Array<{ id: string }>>`
      INSERT INTO "BudgetPlannerProject" (
        "householdId", "name", "description", "color", "totalCost", "status"
      ) VALUES (
        ${householdId}, ${`${source.name} (Copy)`}, ${source.description},
        ${source.color}, ${source.totalCost}, 'PLANNING'
      ) RETURNING "id"`
    await tx`
      INSERT INTO "BudgetPlannerItem" (
        "projectId", "name", "description", "quantity", "unitCost",
        "lineTotal", "sortOrder", "referenceUrl"
      )
      SELECT ${newProject.id}, "name", "description", "quantity", "unitCost",
             "lineTotal", "sortOrder", "referenceUrl"
      FROM "BudgetPlannerItem"
      WHERE "projectId" = ${source.id}`
    return newProject.id
  })
  return { newProjectId }
}

// Recompute the project's totalCost rollup (after every item mutation).
async function recalcProjectTotal(
  tx: typeof sql,
  projectId: string
): Promise<void> {
  await tx`
    UPDATE "BudgetPlannerProject"
    SET "totalCost" = COALESCE((
          SELECT SUM("lineTotal") FROM "BudgetPlannerItem"
          WHERE "projectId" = ${projectId}), 0),
        "updatedAt" = now()
    WHERE "id" = ${projectId}`
}

export type ProjectItemInput = {
  name: string
  description: string | null
  quantity: number
  unitCost: number
  referenceUrl: string | null
}

export async function addItem(
  householdId: string,
  projectId: string,
  input: ProjectItemInput
): Promise<{ ok: true } | { error: string }> {
  // Ownership check (ADR-0005): the project must belong to this household.
  const [project] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "BudgetPlannerProject"
    WHERE "id" = ${projectId} AND "householdId" = ${householdId}`
  if (!project) return { error: "Project not found" }

  const lineTotal = input.quantity * input.unitCost
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO "BudgetPlannerItem" (
        "projectId", "name", "description", "quantity", "unitCost",
        "lineTotal", "referenceUrl"
      ) VALUES (
        ${project.id}, ${input.name}, ${input.description},
        ${input.quantity}, ${input.unitCost}, ${lineTotal},
        ${input.referenceUrl}
      )`
    await recalcProjectTotal(tx, project.id)
  })
  return { ok: true }
}

export async function updateItem(
  householdId: string,
  id: string,
  input: ProjectItemInput
): Promise<{ ok: true } | { error: string }> {
  const [existing] = await sql<Array<{ id: string; projectId: string }>>`
    SELECT i."id", i."projectId"
    FROM "BudgetPlannerItem" i
    JOIN "BudgetPlannerProject" p ON p."id" = i."projectId"
    WHERE i."id" = ${id} AND p."householdId" = ${householdId}`
  if (!existing) return { error: "Item not found" }

  const lineTotal = input.quantity * input.unitCost
  await sql.begin(async (tx) => {
    await tx`
      UPDATE "BudgetPlannerItem"
      SET "name" = ${input.name}, "description" = ${input.description},
          "quantity" = ${input.quantity}, "unitCost" = ${input.unitCost},
          "lineTotal" = ${lineTotal}, "referenceUrl" = ${input.referenceUrl},
          "updatedAt" = now()
      WHERE "id" = ${existing.id}`
    await recalcProjectTotal(tx, existing.projectId)
  })
  return { ok: true }
}

export async function toggleItemPurchased(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const [existing] = await sql<Array<{ id: string; isPurchased: boolean }>>`
    SELECT i."id", i."isPurchased"
    FROM "BudgetPlannerItem" i
    JOIN "BudgetPlannerProject" p ON p."id" = i."projectId"
    WHERE i."id" = ${id} AND p."householdId" = ${householdId}`
  if (!existing) return { error: "Item not found" }

  await sql`
    UPDATE "BudgetPlannerItem"
    SET "isPurchased" = ${!existing.isPurchased}, "updatedAt" = now()
    WHERE "id" = ${existing.id}`
  return { ok: true }
}

export async function deleteItem(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const [existing] = await sql<Array<{ id: string; projectId: string }>>`
    SELECT i."id", i."projectId"
    FROM "BudgetPlannerItem" i
    JOIN "BudgetPlannerProject" p ON p."id" = i."projectId"
    WHERE i."id" = ${id} AND p."householdId" = ${householdId}`
  if (!existing) return { error: "Item not found" }

  await sql.begin(async (tx) => {
    await tx`DELETE FROM "BudgetPlannerItem" WHERE "id" = ${existing.id}`
    await recalcProjectTotal(tx, existing.projectId)
  })
  return { ok: true }
}
