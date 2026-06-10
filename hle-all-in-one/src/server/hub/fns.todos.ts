import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listMembers } from "@/server/households"
import type { MemberWithUser } from "@/lib/types"
import type { TodoItemRow } from "./todos"
import {
  createTodoItem,
  createTodoList,
  deleteTodoItem,
  deleteTodoList,
  getTodoList,
  listTodoItems,
  listTodoLists,
  toggleTodoItem,
  updateTodoItem,
  updateTodoList,
} from "./todos"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const id = z.string().regex(UUID_RE)
// Empty string from a form means NULL.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null)
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()

const listSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalText,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
})

const itemFieldsSchema = z.object({
  title: z.string().trim().min(1).max(300),
  notes: optionalText,
  dueDate: dateInput,
  assigneeId: id.nullable(),
})

// ── Lists ──

export const listTodoListsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listTodoLists(context.householdId))

export const getTodoListPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ listId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const empty = {
      list: null,
      items: [] as Array<TodoItemRow>,
      members: [] as Array<MemberWithUser>,
    }
    // The listId comes from the URL — tolerate junk instead of erroring.
    if (!UUID_RE.test(data.listId)) return empty
    const list = await getTodoList(context.householdId, data.listId)
    if (!list) return empty
    const [items, members] = await Promise.all([
      listTodoItems(context.householdId, data.listId),
      listMembers(context.householdId),
    ])
    return { list, items, members }
  })

export const createTodoListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }) => {
    const listId = await createTodoList(
      context.householdId,
      context.user.id,
      data
    )
    return { ok: true as const, id: listId }
  })

export const updateTodoListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => listSchema.extend({ listId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await updateTodoList(context.householdId, data.listId, data)
    return { ok: true as const }
  })

export const deleteTodoListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ listId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteTodoList(context.householdId, data.listId)
    return { ok: true as const }
  })

// ── Items ──

export const addTodoItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    itemFieldsSchema.extend({ listId: id }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const itemId = await createTodoItem(
      context.householdId,
      context.user.id,
      data
    )
    if (!itemId) return { error: "List not found." }
    return { ok: true as const }
  })

export const updateTodoItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    itemFieldsSchema.extend({ itemId: id }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await updateTodoItem(context.householdId, data.itemId, data)
    return { ok: true as const }
  })

export const toggleTodoItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ itemId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await toggleTodoItem(context.householdId, data.itemId)
    return { ok: true as const }
  })

export const deleteTodoItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ itemId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteTodoItem(context.householdId, data.itemId)
    return { ok: true as const }
  })
