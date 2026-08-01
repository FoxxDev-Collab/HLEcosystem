// Server fns for the first-run setup wizard (/setup). Deliberately
// unauthenticated — there is no one to authenticate yet — but constrained
// three ways: only while the User table is empty (atomic guard in
// createFirstAdmin), only with the boot-printed setup token, and fully
// audited. See docs/adr/0006-first-run-setup-wizard.md in the repo root.
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { passwordIsValid } from "@/lib/password"
import { requestMeta, writeSessionCookie } from "./auth"
import { audit } from "./audit"
import { createSession } from "./session"
import { createFirstAdmin, isSetupNeeded } from "./setup"
import { printSetupTokenOnce, setupTokenMatches } from "./setup-token"

// Public read: leaks only "is this instance initialized", which the login
// page needs anyway to route first-boot visitors into the wizard.
export const getSetupStatusFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const needsSetup = await isSetupNeeded()
    if (needsSetup) printSetupTokenOnce()
    return { needsSetup }
  }
)

const nameField = z.string().trim().min(1).max(80)

const setupSchema = z.object({
  token: z.string().min(1).max(200),
  email: z.string().email(),
  firstName: nameField,
  lastName: nameField,
  password: z
    .string()
    .max(200)
    .refine(
      passwordIsValid,
      "Password does not meet the complexity requirements."
    ),
  householdName: z.string().trim().min(1).max(120),
})

export const completeSetupFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setupSchema.parse(d))
  .handler(async ({ data }) => {
    const meta = requestMeta()
    if (!(await isSetupNeeded())) {
      return { error: "Setup has already been completed." }
    }
    if (!setupTokenMatches(data.token)) {
      await audit("setup.token_rejected", {
        actorEmail: data.email,
        ...meta,
      })
      return { error: "Invalid setup token — check the server logs." }
    }

    const passwordHash = await Bun.password.hash(data.password, {
      algorithm: "bcrypt",
      cost: 12,
    })
    const created = await createFirstAdmin({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      householdName: data.householdName,
    })
    if (!created) {
      return { error: "Setup has already been completed." }
    }

    // Straight into the app as the new admin — no second login step.
    const sessionToken = await createSession(created.userId, {
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      activeHouseholdId: created.householdId,
    })
    writeSessionCookie(sessionToken)
    await audit("setup.complete", {
      actorUserId: created.userId,
      actorEmail: data.email,
      householdId: created.householdId,
      ...meta,
    })
    return { ok: true as const }
  })
