import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { runMealieSync, testMealieConnection } from "./mealie"
import { getSyncState } from "./mealie-cache"
import {
  deleteMealieConfig,
  getMealieConfigStatus,
  getStoredMealieCredentials,
  upsertMealieConfig,
} from "./settings"

const credentialsSchema = z.object({
  apiUrl: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  apiToken: z.string().trim().min(1).max(2000),
})

// Connection status + cache state. The apiToken is never included — the UI
// only sees a masked "hasToken" indicator.
export const getMealsSettingsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [config, syncState] = await Promise.all([
      getMealieConfigStatus(context.householdId),
      getSyncState(context.householdId),
    ])
    return { config, syncState }
  })

// Tests the connection, then saves. A failed test still saves the config but
// marks it inactive (legacy behavior) so the URL isn't lost.
export const saveMealieConfigFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => credentialsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await testMealieConnection(data.apiUrl, data.apiToken)
    await upsertMealieConfig(
      context.householdId,
      data.apiUrl,
      data.apiToken,
      result.ok
    )
    if (!result.ok) {
      return {
        error: `Saved, but the connection test failed: ${result.error ?? "unknown error"}. The integration is inactive until it connects.`,
      }
    }
    return { ok: true as const }
  })

// Tests credentials without saving. An empty token means "test the stored
// connection" (the form shows a masked placeholder once a token is saved).
export const testMealieConnectionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        apiUrl: z
          .string()
          .trim()
          .max(500)
          .transform((v) => v.replace(/\/+$/, "")),
        apiToken: z.string().trim().max(2000),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    let { apiUrl, apiToken } = data
    if (!apiToken) {
      const stored = await getStoredMealieCredentials(context.householdId)
      if (!stored) return { error: "Enter an API token to test." }
      apiToken = stored.apiToken
      if (!apiUrl) apiUrl = stored.apiUrl
    }
    if (!apiUrl) return { error: "Enter the Mealie URL to test." }
    const result = await testMealieConnection(apiUrl, apiToken)
    if (!result.ok) {
      return { error: result.error ?? "Connection failed" }
    }
    return { ok: true as const }
  })

export const disconnectMealieFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    await deleteMealieConfig(context.householdId)
    return { ok: true as const }
  })

// "Sync Now" — forced full sync (recipes + meal plan), ignores the 30-min
// freshness window.
export const syncMealieNowFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const result = await runMealieSync(context.householdId, true)
    if ("error" in result) return { error: result.error }
    if ("skipped" in result) {
      return { error: "Mealie is not connected. Save a connection first." }
    }
    return {
      ok: true as const,
      recipes: result.recipes,
      planEntries: result.planEntries,
    }
  })

// Background sync trigger fired on page mount: skips when data is fresh
// (<30 min), so repeated navigations are free. Ported from the legacy
// POST /api/mealie/sync route.
export const syncMealieFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const result = await runMealieSync(context.householdId, false)
    if ("error" in result) return { error: result.error }
    if ("skipped" in result) {
      return { skipped: true as const, reason: result.reason }
    }
    return {
      synced: true as const,
      recipes: result.recipes,
      planEntries: result.planEntries,
    }
  })
