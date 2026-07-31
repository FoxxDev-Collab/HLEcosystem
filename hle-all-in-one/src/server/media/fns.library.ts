import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { getLibraryCounts, getMovie, getSeries, listLibrary } from "./library"
import { getParentalProfile } from "./parental"
import { listScanRunsForHousehold } from "./scan-runs"

// Every read is filtered through the caller's parental profile (a member
// with a ParentalProfile only sees titles within their rating ceiling; a
// missing profile means unrestricted). isAdmin gates the Scan/Enrich UI —
// the scan/enrich fns re-enforce it server-side via adminMiddleware.
export const getLibraryPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const parental = await getParentalProfile(
      context.user.id,
      context.householdId
    )
    const [counts, items] = await Promise.all([
      getLibraryCounts(context.householdId, parental),
      listLibrary(context.householdId, parental),
    ])
    return {
      counts,
      items,
      isAdmin: context.user.role === "ADMIN",
      scanRuns: listScanRunsForHousehold(context.householdId),
      restricted: parental !== null,
    }
  })

const idSchema = z.object({ id: z.string().uuid() })

export const getMovieFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const parental = await getParentalProfile(
      context.user.id,
      context.householdId
    )
    return getMovie(context.householdId, data.id, parental)
  })

export const getSeriesFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const parental = await getParentalProfile(
      context.user.id,
      context.householdId
    )
    return getSeries(context.householdId, data.id, parental)
  })
