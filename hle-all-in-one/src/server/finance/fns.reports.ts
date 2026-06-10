import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { exportTransactionsCsv, getReportData } from "./reports"

const yearSchema = z.number().int().min(1970).max(2100)

export const getReportDataFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        year: yearSchema,
        month: z.number().int().min(1).max(12).nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    getReportData(context.householdId, data.year, data.month)
  )

export const exportTransactionsCsvFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ year: yearSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const csv = await exportTransactionsCsv(context.householdId, data.year)
    return { csv }
  })
