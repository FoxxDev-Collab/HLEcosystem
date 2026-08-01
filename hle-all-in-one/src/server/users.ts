import { sql } from "./db"
import type { HouseholdRole, Role, User, UserPublic } from "@/lib/types"

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
  password: string
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
  email: string
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

// When `membership` is given, the user and their HouseholdMember row are
// created in one transaction — a failed membership insert (e.g. household
// deleted concurrently; FK is the backstop) rolls back the user too, so an
// admin never ends up with a half-provisioned account.
export async function createUser(
  data: {
    email: string
    firstName: string
    lastName: string
    password: string
    role: Role
  },
  membership?: { householdId: string; role: HouseholdRole }
): Promise<UserPublic> {
  const hashed = await hashPassword(data.password)
  const displayName = `${data.firstName} ${data.lastName}`.trim()
  const row = await sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO "User" ("email","firstName","lastName","password","role","active")
      VALUES (${data.email}, ${data.firstName}, ${data.lastName}, ${hashed},
              ${data.role}::"Role", true)
      RETURNING *
    `
    if (membership) {
      await tx`
        INSERT INTO "HouseholdMember" ("householdId","userId","displayName","role")
        VALUES (${membership.householdId}, ${rows[0].id}, ${displayName},
                ${membership.role}::"HouseholdRole")
      `
    }
    return rows[0]
  })
  return toPublic(row)
}

export async function updateUser(
  id: string,
  data: {
    firstName: string
    lastName: string
    email: string
    role: Role
    active: boolean
  }
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
  data: { firstName: string; lastName: string; email: string }
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
  password: string
): Promise<void> {
  const hashed = await hashPassword(password)
  await sql`UPDATE "User" SET "password" = ${hashed}, "updatedAt" = now() WHERE "id" = ${id}`
}

// HouseholdMember cascades on user delete — refuse when this user is the
// only OWNER of a household that still has other members, which would leave
// it permanently unmanageable (adding/removing members requires an OWNER;
// same invariant as removeMember in households.ts).
export async function deleteUser(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const orphaned = await sql<Array<{ name: string }>>`
    SELECT h."name"
    FROM "HouseholdMember" hm
    JOIN "Household" h ON h."id" = hm."householdId"
    WHERE hm."userId" = ${id} AND hm."role" = 'OWNER'
      AND NOT EXISTS (
        SELECT 1 FROM "HouseholdMember" o
        WHERE o."householdId" = hm."householdId"
          AND o."role" = 'OWNER' AND o."userId" <> ${id}
      )
      AND EXISTS (
        SELECT 1 FROM "HouseholdMember" m
        WHERE m."householdId" = hm."householdId"
          AND m."userId" <> ${id}
      )
    LIMIT 1`
  if (orphaned.length > 0) {
    return {
      error: `This user is the only owner of "${orphaned[0].name}", which still has members. Add another owner there first.`,
    }
  }
  await sql`DELETE FROM "User" WHERE "id" = ${id}`
  return { ok: true }
}

export async function emailExists(
  email: string,
  excludeId?: string
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
