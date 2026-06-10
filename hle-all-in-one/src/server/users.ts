import { sql } from "./db"
import type { Role, User, UserPublic } from "@/lib/types"

// Strip secrets and derive the display name before a row leaves the server.
export function toPublic(u: User): UserPublic {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    avatar: u.avatar,
    role: u.role,
    active: u.active,
    totpEnabled: u.totpEnabled,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    name: `${u.firstName} ${u.lastName}`.trim(),
  }
}

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 })
}

export async function verifyPassword(
  user: User,
  password: string,
): Promise<boolean> {
  if (!user.password) return false
  return Bun.password.verify(password, user.password)
}

export async function listUsers(): Promise<Array<UserPublic>> {
  return await sql`
    SELECT "id","email","firstName","lastName",
           btrim("firstName" || ' ' || "lastName") AS "name",
           "avatar","role","active","totpEnabled","createdAt","updatedAt"
    FROM "User"
    ORDER BY "lastName" ASC, "firstName" ASC
  `
}

export async function getUserPublic(id: string): Promise<UserPublic | null> {
  const rows = await sql`
    SELECT "id","email","firstName","lastName",
           btrim("firstName" || ' ' || "lastName") AS "name",
           "avatar","role","active","totpEnabled","createdAt","updatedAt"
    FROM "User" WHERE "id" = ${id}
  `
  return rows[0] ?? null
}

// Full row incl. password — only for auth (login / password change).
export async function getUserWithSecretByEmail(
  email: string,
): Promise<User | null> {
  const rows = await sql`
    SELECT * FROM "User" WHERE lower("email") = lower(${email})
  `
  return rows[0] ?? null
}

export async function getUserWithSecretById(id: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM "User" WHERE "id" = ${id}`
  return rows[0] ?? null
}

export async function createUser(data: {
  email: string
  firstName: string
  lastName: string
  password: string
  role: Role
}): Promise<UserPublic> {
  const hashed = await hashPassword(data.password)
  const rows = await sql`
    INSERT INTO "User" ("email","firstName","lastName","password","role","active")
    VALUES (${data.email}, ${data.firstName}, ${data.lastName}, ${hashed},
            ${data.role}::"Role", true)
    RETURNING *
  `
  return toPublic(rows[0])
}

export async function updateUser(
  id: string,
  data: {
    firstName: string
    lastName: string
    email: string
    role: Role
    active: boolean
  },
): Promise<UserPublic> {
  const rows = await sql`
    UPDATE "User"
    SET "firstName" = ${data.firstName},
        "lastName" = ${data.lastName},
        "email" = ${data.email},
        "role" = ${data.role}::"Role",
        "active" = ${data.active},
        "updatedAt" = now()
    WHERE "id" = ${id}
    RETURNING *
  `
  return toPublic(rows[0])
}

export async function updateProfile(
  id: string,
  data: { firstName: string; lastName: string; email: string },
): Promise<UserPublic> {
  const rows = await sql`
    UPDATE "User"
    SET "firstName" = ${data.firstName},
        "lastName" = ${data.lastName},
        "email" = ${data.email},
        "updatedAt" = now()
    WHERE "id" = ${id}
    RETURNING *
  `
  return toPublic(rows[0])
}

export async function setUserPassword(
  id: string,
  password: string,
): Promise<void> {
  const hashed = await hashPassword(password)
  await sql`UPDATE "User" SET "password" = ${hashed}, "updatedAt" = now() WHERE "id" = ${id}`
}

export async function deleteUser(id: string): Promise<void> {
  await sql`DELETE FROM "User" WHERE "id" = ${id}`
}

export async function emailExists(
  email: string,
  excludeId?: string,
): Promise<boolean> {
  // Note: no `"id" <> ${excludeId ?? ""}` — comparing a uuid column to an
  // empty string errors. Only add the exclusion when an id is actually given.
  const rows = excludeId
    ? await sql`
        SELECT 1 FROM "User"
        WHERE lower("email") = lower(${email}) AND "id" <> ${excludeId}
        LIMIT 1
      `
    : await sql`
        SELECT 1 FROM "User" WHERE lower("email") = lower(${email}) LIMIT 1
      `
  return rows.length > 0
}

export async function userCounts(): Promise<{
  total: number
  active: number
  admins: number
}> {
  const rows = await sql`
    SELECT
      count(*)::int AS "total",
      count(*) FILTER (WHERE "active")::int AS "active",
      count(*) FILTER (WHERE "role" = 'ADMIN')::int AS "admins"
    FROM "User"
  `
  return rows[0]
}
