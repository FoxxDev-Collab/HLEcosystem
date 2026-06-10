import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  addTaxDocument,
  createTaxYear,
  deleteTaxDocument,
  deleteTaxYear,
  getTaxYear,
  listTaxDocuments,
  listTaxYears,
  markTaxFiled,
  removeTaxDocumentFile,
  toggleOwedPaid,
  toggleRefundReceived,
  toggleTaxDocumentReceived,
  updateTaxRefund,
  updateTaxYearDetails,
} from "./taxes"

const FILING_STATUS = z.enum([
  "SINGLE",
  "MARRIED_FILING_JOINTLY",
  "MARRIED_FILING_SEPARATELY",
  "HEAD_OF_HOUSEHOLD",
  "QUALIFYING_WIDOWER",
])

const TAX_DOCUMENT_TYPE = z.enum([
  "W2",
  "FORM_1099_INT",
  "FORM_1099_DIV",
  "FORM_1099_NEC",
  "FORM_1098",
  "FORM_1099_B",
  "FORM_1099_R",
  "K1",
  "FORM_1099_SA",
  "FORM_5498_SA",
  "OTHER",
])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optMoney = z.number().nonnegative().max(99999999).nullable()

export const getTaxYearsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const taxYears = await listTaxYears(context.householdId)
    return { taxYears }
  })

export const getTaxYearDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const taxYear = await getTaxYear(context.householdId, data.id)
    if (!taxYear) return { taxYear: null, documents: [] }
    const documents = await listTaxDocuments(context.householdId, taxYear.id)
    return { taxYear, documents }
  })

export const createTaxYearFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        year: z.number().int().min(1970).max(2100),
        federalFilingStatus: FILING_STATUS.nullable(),
        state: z
          .string()
          .max(40)
          .transform((v) => v.trim() || null),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    createTaxYear(context.householdId, data)
  )

export const updateTaxYearFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        federalFilingStatus: FILING_STATUS.nullable(),
        state: z
          .string()
          .max(40)
          .transform((v) => v.trim() || null),
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    await updateTaxYearDetails(context.householdId, id, input)
    return { ok: true as const }
  })

export const updateTaxRefundFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        federalRefund: optMoney,
        stateRefund: optMoney,
        federalOwed: optMoney,
        stateOwed: optMoney,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    await updateTaxRefund(context.householdId, id, input)
    return { ok: true as const }
  })

export const markTaxFiledFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().min(1), kind: z.enum(["federal", "state"]) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await markTaxFiled(context.householdId, data.id, data.kind)
    return { ok: true as const }
  })

export const toggleRefundReceivedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await toggleRefundReceived(context.householdId, data.id)
    return { ok: true as const }
  })

export const toggleOwedPaidFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().min(1), kind: z.enum(["federal", "state"]) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await toggleOwedPaid(context.householdId, data.id, data.kind)
    return { ok: true as const }
  })

export const deleteTaxYearFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteTaxYear(context.householdId, data.id)
  )

export const addTaxDocumentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        taxYearId: z.string().min(1),
        documentType: TAX_DOCUMENT_TYPE,
        issuer: z.string().trim().min(1).max(200),
        description: optText,
        grossAmount: optMoney,
        federalWithheld: optMoney,
        stateWithheld: optMoney,
        socialSecurityWithheld: optMoney,
        medicareWithheld: optMoney,
        expectedDate: z.string().regex(DATE_RE).nullable(),
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { taxYearId, ...input } = data
    return addTaxDocument(context.householdId, taxYearId, input)
  })

export const deleteTaxDocumentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteTaxDocument(context.householdId, data.id)
  )

export const toggleTaxDocumentReceivedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await toggleTaxDocumentReceived(context.householdId, data.id)
    return { ok: true as const }
  })

export const removeTaxDocumentFileFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ documentId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) =>
    removeTaxDocumentFile(context.householdId, data.documentId)
  )
