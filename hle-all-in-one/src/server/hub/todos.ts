import { sql } from "@/server/db"

export type TodoItemStatus = "PENDING" | "IN_PROGRESS" | "DONE"

// A list with item counts for the overview grid.
export type TodoListSummary = {
  id: string
  name: string
  description: string | null
  color: string | null
  totalCount: number
  doneCount: number
  updatedAt: Date
}

export type TodoListRow = {
  id: string
  name: string
  description: string | null
  color: string | null
}

export type TodoItemRow = {
  id: string
  listId: string
  title: string
  notes: string | null
  status: TodoItemStatus
  dueDate: string | null // DATE selected ::text → "YYYY-MM-DD"
  assigneeId: string | null
  sortOrder: number
  completedAt: Date | null
  createdAt: Date
}

export async function listTodoLists(householdId: string) {
  return sql<Array<TodoListSummary>>`
    SELECT l."id", l."name", l."description", l."color", l."updatedAt",
           count(i."id")::int AS "totalCount",
           (count(i."id") FILTER (WHERE i."status" = 'DONE'))::int AS "doneCount"
    FROM "TodoList" l
    LEFT JOIN "TodoItem" i ON i."listId" = l."id"
    WHERE l."householdId" = ${householdId}
    GROUP BY l."id"
    ORDER BY l."updatedAt" DESC`
}

export async function getTodoList(
  householdId: string,
  listId: string
): Promise<TodoListRow | null> {
  const rows = await sql<Array<TodoListRow>>`
    SELECT "id", "name", "description", "color"
    FROM "TodoList"
    WHERE "id" = ${listId} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

// TodoItem has no householdId — scope by joining through its TodoList.
export async function listTodoItems(householdId: string, listId: string) {
  return sql<Array<TodoItemRow>>`
    SELECT i."id", i."listId", i."title", i."notes", i."status",
           i."dueDate"::text, i."assigneeId", i."sortOrder", i."completedAt",
           i."createdAt"
    FROM "TodoItem" i
    JOIN "TodoList" l ON l."id" = i."listId"
    WHERE i."listId" = ${listId} AND l."householdId" = ${householdId}
    ORDER BY i."status" ASC, i."sortOrder" ASC, i."createdAt" DESC`
}

export async function createTodoList(
  householdId: string,
  userId: string,
  data: { name: string; description: string | null; color: string | null }
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "TodoList" ("householdId","name","description","color","createdById")
    VALUES (${householdId}, ${data.name}, ${data.description}, ${data.color}, ${userId})
    RETURNING "id"`
  return rows[0].id
}

export async function updateTodoList(
  householdId: string,
  listId: string,
  data: { name: string; description: string | null; color: string | null }
): Promise<void> {
  await sql`
    UPDATE "TodoList"
    SET "name" = ${data.name}, "description" = ${data.description},
        "color" = ${data.color}, "updatedAt" = now()
    WHERE "id" = ${listId} AND "householdId" = ${householdId}`
}

export async function deleteTodoList(
  householdId: string,
  listId: string
): Promise<void> {
  await sql`
    DELETE FROM "TodoList"
    WHERE "id" = ${listId} AND "householdId" = ${householdId}`
}

// Ownership gate + next-sortOrder + insert in one statement: the INSERT only
// happens when the target list belongs to the active household.
export async function createTodoItem(
  householdId: string,
  userId: string,
  data: {
    listId: string
    title: string
    notes: string | null
    dueDate: string | null
    assigneeId: string | null
  }
): Promise<string | null> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "TodoItem"
      ("listId","title","notes","dueDate","assigneeId","sortOrder","createdById")
    SELECT l."id", ${data.title}::text, ${data.notes}::text,
           ${data.dueDate}::date, ${data.assigneeId}::uuid,
           COALESCE((SELECT max(i."sortOrder") + 1
                     FROM "TodoItem" i WHERE i."listId" = l."id"), 0),
           ${userId}::uuid
    FROM "TodoList" l
    WHERE l."id" = ${data.listId} AND l."householdId" = ${householdId}
    RETURNING "id"`
  return rows[0]?.id ?? null
}

export async function updateTodoItem(
  householdId: string,
  itemId: string,
  data: {
    title: string
    notes: string | null
    dueDate: string | null
    assigneeId: string | null
  }
): Promise<void> {
  await sql`
    UPDATE "TodoItem" i
    SET "title" = ${data.title}, "notes" = ${data.notes},
        "dueDate" = ${data.dueDate}::date,
        "assigneeId" = ${data.assigneeId}::uuid,
        "updatedAt" = now()
    FROM "TodoList" l
    WHERE l."id" = i."listId" AND i."id" = ${itemId}
      AND l."householdId" = ${householdId}`
}

// Legacy toggle semantics: DONE → PENDING, anything else (PENDING or
// IN_PROGRESS) → DONE. completedAt is set when completing, cleared on reopen.
export async function toggleTodoItem(
  householdId: string,
  itemId: string
): Promise<void> {
  await sql`
    UPDATE "TodoItem" i
    SET "status" = CASE WHEN i."status" = 'DONE'
          THEN 'PENDING'::"TodoItemStatus" ELSE 'DONE'::"TodoItemStatus" END,
        "completedAt" = CASE WHEN i."status" = 'DONE' THEN NULL ELSE now() END,
        "updatedAt" = now()
    FROM "TodoList" l
    WHERE l."id" = i."listId" AND i."id" = ${itemId}
      AND l."householdId" = ${householdId}`
}

export async function deleteTodoItem(
  householdId: string,
  itemId: string
): Promise<void> {
  await sql`
    DELETE FROM "TodoItem" i
    USING "TodoList" l
    WHERE l."id" = i."listId" AND i."id" = ${itemId}
      AND l."householdId" = ${householdId}`
}
