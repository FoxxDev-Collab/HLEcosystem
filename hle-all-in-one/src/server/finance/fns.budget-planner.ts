import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  addItem,
  createProject,
  deleteItem,
  deleteProject,
  duplicateProject,
  getAvailableFunds,
  getProject,
  listProjectItems,
  listProjects,
  toggleItemPurchased,
  updateItem,
  updateProject,
  updateProjectStatus,
} from "./budget-planner"

const PROJECT_STATUS = z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optText,
  targetDate: z.string().regex(DATE_RE).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

const itemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optText,
  quantity: z.number().int().min(1).max(100000),
  unitCost: z.number().min(0).max(99999999),
  referenceUrl: z
    .union([z.url().max(500), z.literal("")])
    .transform((v) => v || null),
})

export const getBudgetPlannerPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [projects, availableFunds] = await Promise.all([
      listProjects(context.householdId),
      getAvailableFunds(context.householdId),
    ])
    return { projects, availableFunds }
  })

export const getBudgetPlannerProjectFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const project = await getProject(context.householdId, data.id)
    if (!project) return { project: null, items: [] }
    const items = await listProjectItems(context.householdId, project.id)
    return { project, items }
  })

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => projectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id } = await createProject(context.householdId, data)
    return { newProjectId: id }
  })

export const updateProjectFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    projectSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    return updateProject(context.householdId, id, input)
  })

export const updateProjectStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), status: PROJECT_STATUS }).parse(d)
  )
  .handler(async ({ data, context }) =>
    updateProjectStatus(context.householdId, data.id, data.status)
  )

export const duplicateProjectFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    duplicateProject(context.householdId, data.id)
  )

export const deleteProjectFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteProject(context.householdId, data.id)
  )

export const addProjectItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    itemSchema.extend({ projectId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { projectId, ...input } = data
    return addItem(context.householdId, projectId, input)
  })

export const updateProjectItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    itemSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    return updateItem(context.householdId, id, input)
  })

export const toggleProjectItemPurchasedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    toggleItemPurchased(context.householdId, data.id)
  )

export const deleteProjectItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteItem(context.householdId, data.id)
  )
