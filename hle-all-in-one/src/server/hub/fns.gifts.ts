import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  convertIdeaToGift,
  createGift,
  createGiftIdea,
  deleteGift,
  deleteGiftIdea,
  listGiftIdeas,
  listGiftRecipients,
  listGifts,
  updateGift,
  updateGiftIdea,
  updateGiftIdeaStatus,
  updateGiftStatus,
} from "./gifts"

const giftStatusSchema = z.enum(["IDEA", "PURCHASED", "WRAPPED", "GIVEN"])
const ideaStatusSchema = z.enum(["ACTIVE", "PURCHASED", "NOT_INTERESTED"])
const ideaPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"])

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null))

const giftSchema = z.object({
  familyMemberId: z.string().uuid(),
  description: z.string().min(1).max(500),
  giftDate: dateString.nullable(),
  occasion: optionalText(200),
  status: giftStatusSchema,
  estimatedCost: z.number().min(0).nullable(),
  actualCost: z.number().min(0).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: optionalText(2000),
})

const ideaSchema = z.object({
  familyMemberId: z.string().uuid().nullable(),
  idea: z.string().min(1).max(500),
  source: optionalText(200),
  priority: ideaPrioritySchema,
  estimatedCost: z.number().min(0).nullable(),
  url: z.string().url().max(2000).nullable(),
  notes: optionalText(2000),
})

const idSchema = z.object({ id: z.string().uuid() })

// ---------------------------------------------------------------- Gifts

export const getGiftsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [gifts, members] = await Promise.all([
      listGifts(context.householdId),
      listGiftRecipients(context.householdId),
    ])
    return { gifts, members }
  })

export const createGiftFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => giftSchema.parse(d))
  .handler(async ({ data, context }) => createGift(context.householdId, data))

export const updateGiftFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => giftSchema.extend(idSchema.shape).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data
    return updateGift(context.householdId, id, rest)
  })

export const updateGiftStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    idSchema.extend({ status: giftStatusSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await updateGiftStatus(context.householdId, data.id, data.status)
    return { ok: true as const }
  })

export const deleteGiftFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await deleteGift(context.householdId, data.id)
    return { ok: true as const }
  })

// ----------------------------------------------------------- Gift ideas

export const getGiftIdeasPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [ideas, members] = await Promise.all([
      listGiftIdeas(context.householdId),
      listGiftRecipients(context.householdId),
    ])
    return { ideas, members }
  })

export const createGiftIdeaFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => ideaSchema.parse(d))
  .handler(async ({ data, context }) =>
    createGiftIdea(context.householdId, data)
  )

export const updateGiftIdeaFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => ideaSchema.extend(idSchema.shape).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data
    return updateGiftIdea(context.householdId, id, rest)
  })

export const updateGiftIdeaStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    idSchema.extend({ status: ideaStatusSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await updateGiftIdeaStatus(context.householdId, data.id, data.status)
    return { ok: true as const }
  })

export const convertIdeaToGiftFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) =>
    convertIdeaToGift(context.householdId, data.id)
  )

export const deleteGiftIdeaFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await deleteGiftIdea(context.householdId, data.id)
    return { ok: true as const }
  })
