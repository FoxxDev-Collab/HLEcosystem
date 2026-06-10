import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listMembers } from "@/server/households"
import {
  TRAVEL_DOCUMENT_TYPES,
  createDocument,
  deleteDocument,
  listDocuments,
  listTripOptions,
  updateDocument,
} from "./documents"

const optText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim() || null)

const optDate = z
  .string()
  .max(10)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  })

const documentSchema = z.object({
  type: z.enum(TRAVEL_DOCUMENT_TYPES),
  tripId: z.string().uuid().nullable(),
  householdMemberId: z.string().uuid().nullable(),
  displayName: optText(200),
  documentNumber: optText(120),
  issuingCountry: optText(120),
  issueDate: optDate,
  expiryDate: optDate,
  notes: optText(2000),
})

const idSchema = z.object({ id: z.string().uuid() })

export const getTravelDocumentsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [documents, trips, members] = await Promise.all([
      listDocuments(context.householdId),
      listTripOptions(context.householdId),
      listMembers(context.householdId),
    ])
    return {
      documents,
      trips,
      // Owner picker stores the membership id ("HouseholdMember"."id").
      members: members.map((m) => ({
        membershipId: m.membershipId,
        displayName: m.displayName,
      })),
    }
  })

export const createTravelDocumentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => documentSchema.parse(d))
  .handler(async ({ data, context }) =>
    createDocument(context.householdId, data)
  )

export const updateTravelDocumentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    documentSchema.extend(idSchema.shape).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data
    return updateDocument(context.householdId, id, rest)
  })

export const deleteTravelDocumentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) =>
    deleteDocument(context.householdId, data.id)
  )
