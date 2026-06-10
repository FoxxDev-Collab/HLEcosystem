import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { passwordIsValid } from "@/lib/password"
import { authMiddleware } from "./middleware"
import { deleteSessionById, listUserSessions } from "./session"
import {
  emailExists,
  getUserWithSecretById,
  setUserPassword,
  updateProfile,
  verifyPassword,
} from "./users"

const nameField = z.string().trim().min(1).max(80)
const passwordField = z
  .string()
  .max(200)
  .refine(
    passwordIsValid,
    "Password does not meet the complexity requirements."
  )

export const getMySessionsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return {
      sessions: await listUserSessions(context.user.id, context.sessionToken),
    }
  })

export const revokeSessionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteSessionById(data.id, context.user.id)
    return { ok: true as const }
  })

export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        currentPassword: z.string().min(1),
        newPassword: passwordField,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const user = await getUserWithSecretById(context.user.id)
    if (!user || !(await verifyPassword(user, data.currentPassword))) {
      return { error: "Your current password is incorrect." }
    }
    await setUserPassword(context.user.id, data.newPassword)
    return { ok: true as const }
  })

export const updateProfileFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        firstName: nameField,
        lastName: nameField,
        email: z.string().email(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    if (await emailExists(data.email, context.user.id)) {
      return { error: "Another user already uses that email." }
    }
    const user = await updateProfile(context.user.id, data)
    return { ok: true as const, user }
  })
