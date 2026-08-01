import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { passwordIsValid } from "@/lib/password"
import { adminMiddleware } from "./middleware"
import { requestMeta } from "./auth"
import { audit } from "./audit"
import { listAllHouseholds } from "./households"
import { deleteAllUserSessions, deleteOtherUserSessions } from "./session"
import {
  createUser,
  deleteUser,
  emailExists,
  listUsers,
  setUserPassword,
  updateUser,
  userCounts,
} from "./users"

const roleSchema = z.enum(["ADMIN", "MEMBER"])
const nameField = z.string().trim().min(1).max(80)
const passwordField = z
  .string()
  .max(200)
  .refine(
    passwordIsValid,
    "Password does not meet the complexity requirements."
  )

export const listUsersFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    return {
      users: await listUsers(),
      counts: await userCounts(),
      households: await listAllHouseholds(),
    }
  })

const createSchema = z.object({
  email: z.string().email(),
  firstName: nameField,
  lastName: nameField,
  password: passwordField,
  role: roleSchema,
  // Optional initial household placement — without it the new account exists
  // but belongs nowhere, and every module redirects it to /setup.
  householdId: z.string().min(1).optional(),
  householdRole: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
})

export const createUserFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (await emailExists(data.email)) {
      return { error: "A user with that email already exists." }
    }
    if (data.householdId) {
      const known = await listAllHouseholds()
      if (!known.some((h) => h.id === data.householdId)) {
        return { error: "That household no longer exists." }
      }
    }
    const user = await createUser(
      {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        role: data.role,
      },
      data.householdId
        ? { householdId: data.householdId, role: data.householdRole }
        : undefined
    )
    await audit("admin.user.create", {
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      targetType: "User",
      targetId: user.id,
      householdId: data.householdId ?? null,
      detail: { email: data.email, role: data.role },
      ...requestMeta(),
    })
    return { ok: true as const, user }
  })

const updateSchema = z.object({
  id: z.string().min(1),
  firstName: nameField,
  lastName: nameField,
  email: z.string().email(),
  role: roleSchema,
  active: z.boolean(),
})

export const updateUserFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (await emailExists(data.email, data.id)) {
      return { error: "Another user already uses that email." }
    }
    if (
      data.id === context.user.id &&
      (data.role !== "ADMIN" || !data.active)
    ) {
      return { error: "You cannot remove your own admin access." }
    }
    const user = await updateUser(data.id, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      role: data.role,
      active: data.active,
    })
    await audit("admin.user.update", {
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      targetType: "User",
      targetId: data.id,
      detail: { email: data.email, role: data.role, active: data.active },
      ...requestMeta(),
    })
    return { ok: true as const, user }
  })

export const setUserPasswordFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), password: passwordField }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await setUserPassword(data.id, data.password)
    // An admin reset revokes ALL of the target's sessions — the reset exists
    // precisely because the account may be compromised or handed over. When
    // the admin resets their own account this way, keep the session doing
    // the resetting so they aren't logged out mid-action.
    if (data.id === context.user.id) {
      await deleteOtherUserSessions(data.id, context.sessionToken)
    } else {
      await deleteAllUserSessions(data.id)
    }
    await audit("admin.user.password_reset", {
      actorUserId: context.user.id,
      actorEmail: context.user.email,
      targetType: "User",
      targetId: data.id,
      ...requestMeta(),
    })
    return { ok: true as const }
  })

export const deleteUserFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id === context.user.id) {
      return { error: "You cannot delete your own account." }
    }
    // deleteUser refuses when the user is the last OWNER of a household that
    // still has members (see users.ts).
    const result = await deleteUser(data.id)
    if (!("error" in result)) {
      await audit("admin.user.delete", {
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        targetType: "User",
        targetId: data.id,
        ...requestMeta(),
      })
    }
    return result
  })
