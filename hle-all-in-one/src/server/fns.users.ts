import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { passwordIsValid } from "@/lib/password"
import { adminMiddleware } from "./middleware"
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
    return { users: await listUsers(), counts: await userCounts() }
  })

const createSchema = z.object({
  email: z.string().email(),
  firstName: nameField,
  lastName: nameField,
  password: passwordField,
  role: roleSchema,
})

export const createUserFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    if (await emailExists(data.email)) {
      return { error: "A user with that email already exists." }
    }
    const user = await createUser(data)
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
    return { ok: true as const, user }
  })

export const setUserPasswordFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), password: passwordField }).parse(d)
  )
  .handler(async ({ data }) => {
    await setUserPassword(data.id, data.password)
    return { ok: true as const }
  })

export const deleteUserFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id === context.user.id) {
      return { error: "You cannot delete your own account." }
    }
    await deleteUser(data.id)
    return { ok: true as const }
  })
