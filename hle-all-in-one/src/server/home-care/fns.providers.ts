import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { createProvider, deleteProvider, listProviders } from "./providers"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optRating = z
  .string()
  .max(2)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^[1-5]$/.test(v), {
    message: "Rating must be 1-5",
  })
  .transform((v) => (v === null ? null : parseInt(v, 10)))

const providerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: optText,
  specialty: z.enum([
    "HVAC",
    "PLUMBING",
    "ELECTRICAL",
    "APPLIANCE_REPAIR",
    "GENERAL_CONTRACTOR",
    "LANDSCAPING",
    "PEST_CONTROL",
    "ROOFING",
    "PAINTING",
    "FLOORING",
    "AUTO_MECHANIC",
    "AUTO_BODY",
    "AUTO_DEALER",
    "CLEANING",
    "LOCKSMITH",
    "HANDYMAN",
    "OTHER",
  ]),
  phone: optText,
  email: optText,
  website: optText,
  address: optText,
  rating: optRating,
  notes: optText,
})

const idSchema = z.object({ id: z.string().min(1) })

export const getProvidersPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listProviders(context.householdId))

export const createProviderFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => providerSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createProvider(context.householdId, data)
    return { ok: true as const }
  })

export const deleteProviderFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteProvider(context.householdId, data.id)
    if (!deleted) return { error: "Provider not found." }
    return { ok: true as const }
  })
