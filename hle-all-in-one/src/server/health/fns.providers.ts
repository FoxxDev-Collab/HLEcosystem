import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createProvider,
  deleteProvider,
  listProviders,
  toggleProviderActive,
} from "./providers"

const idSchema = z.object({ id: z.string().min(1) })

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const PROVIDER_TYPES = [
  "DOCTOR",
  "DENTIST",
  "OPTOMETRIST",
  "SPECIALIST",
  "HOSPITAL",
  "LAB",
  "PHARMACY",
  "THERAPIST",
  "CHIROPRACTOR",
  "VETERINARIAN",
  "OTHER",
] as const

const providerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(PROVIDER_TYPES),
  specialty: optText,
  phoneNumber: optText,
  address: optText,
  email: optText,
  website: optText,
  portalUrl: optText,
  notes: optText,
})

export const getHealthProvidersFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listProviders(context.householdId))

export const createProviderFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => providerSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createProvider(context.householdId, data)
    return { ok: true as const }
  })

export const toggleProviderActiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await toggleProviderActive(context.householdId, data.id)
    if (!toggled) return { error: "Provider not found." }
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
