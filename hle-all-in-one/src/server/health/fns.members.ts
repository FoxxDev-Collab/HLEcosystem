import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  disableHealthTracking,
  enableHealthTracking,
  getHealthMember,
  listActiveMedicationsForMember,
  listEmergencyContactsForMember,
  listHealthMembersWithStats,
  listHubMembers,
  listRecentVaccinationsForMember,
  listScheduledAppointmentsForMember,
  syncMemberFromHub,
} from "./members"
import { getLatestProfileRecord } from "./profiles"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const idSchema = z.object({ id: z.string().min(1) })

// ─── Family tracking page ───────────────────────────────

export const getHealthFamilyPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [hubMembers, healthMembers] = await Promise.all([
      listHubMembers(context.householdId),
      listHealthMembersWithStats(context.householdId),
    ])
    return { hubMembers, healthMembers }
  })

// ─── Member detail page ─────────────────────────────────

export const getHealthMemberDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const member = await getHealthMember(context.householdId, data.id)
    if (!member) return null
    const [
      latestProfile,
      medications,
      appointments,
      vaccinations,
      emergencyContacts,
    ] = await Promise.all([
      getLatestProfileRecord(context.householdId, member.id),
      listActiveMedicationsForMember(context.householdId, member.id),
      listScheduledAppointmentsForMember(context.householdId, member.id),
      listRecentVaccinationsForMember(context.householdId, member.id),
      listEmergencyContactsForMember(context.householdId, member.id),
    ])
    return {
      member,
      latestProfile,
      medications,
      appointments,
      vaccinations,
      emergencyContacts,
    }
  })

// ─── Lifecycle mutations ────────────────────────────────

export const enableHealthTrackingFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ familyMemberId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) =>
    enableHealthTracking(context.householdId, data.familyMemberId)
  )

export const disableHealthTrackingFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) =>
    disableHealthTracking(context.householdId, data.id)
  )

export const syncMemberFromHubFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) =>
    syncMemberFromHub(context.householdId, data.id)
  )
