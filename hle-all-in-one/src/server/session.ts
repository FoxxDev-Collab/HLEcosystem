import { randomBytes } from "node:crypto"
import { sql } from "./db"
import { toPublic } from "./users"
import type { SessionInfo, User, UserPublic } from "@/lib/types"

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function generateToken(): string {
  return randomBytes(48).toString("hex")
}

export async function createSession(
  userId: string,
  opts: {
    userAgent: string | null
    ipAddress: string | null
    activeHouseholdId: string | null
  }
): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  await sql`
    INSERT INTO "Session"
      ("token","userId","activeHouseholdId","expiresAt","userAgent","ipAddress")
    VALUES
      (${token}, ${userId}, ${opts.activeHouseholdId}, ${expiresAt},
       ${opts.userAgent}, ${opts.ipAddress})
  `
  return token
}

export type ValidatedSession = {
  user: UserPublic
  sessionId: string
  activeHouseholdId: string | null
}

export async function validateSession(
  token: string
): Promise<ValidatedSession | null> {
  const rows: Array<
    User & {
      sessionId: string
      activeHouseholdId: string | null
      expiresAt: Date
    }
  > = await sql`
    SELECT s."id" AS "sessionId", s."activeHouseholdId", s."expiresAt", u.*
    FROM "Session" s
    JOIN "User" u ON u."id" = s."userId"
    WHERE s."token" = ${token}
  `

  const row = rows[0]
  if (!row) return null
  if (new Date(row.expiresAt) < new Date()) {
    await sql`DELETE FROM "Session" WHERE "token" = ${token}`
    return null
  }
  if (!row.active) return null

  return {
    user: toPublic(row),
    sessionId: row.sessionId,
    activeHouseholdId: row.activeHouseholdId,
  }
}

export async function setActiveHousehold(
  token: string,
  householdId: string
): Promise<void> {
  await sql`UPDATE "Session" SET "activeHouseholdId" = ${householdId} WHERE "token" = ${token}`
}

export async function deleteSession(token: string): Promise<void> {
  await sql`DELETE FROM "Session" WHERE "token" = ${token}`
}

export async function deleteSessionById(
  id: string,
  userId: string
): Promise<void> {
  await sql`DELETE FROM "Session" WHERE "id" = ${id} AND "userId" = ${userId}`
}

export async function listUserSessions(
  userId: string,
  currentToken: string
): Promise<Array<SessionInfo>> {
  return await sql`
    SELECT "id", "userAgent", "ipAddress", "createdAt", "expiresAt",
           ("token" = ${currentToken}) AS "current"
    FROM "Session"
    WHERE "userId" = ${userId} AND "expiresAt" > now()
    ORDER BY "createdAt" DESC
  `
}
