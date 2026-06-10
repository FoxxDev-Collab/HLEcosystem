import { sql } from "@/server/db"

export type MediaType = "MOVIE" | "TV_SHOW" | "MUSIC"
export type MediaRequestStatus = "REQUESTED" | "COMPLETED"

// Cross-household by design: every authenticated user sees all requests.
// Requester/commenter names come from "User" — id + name fields only, never
// password/totpSecret.
export type MediaRequestRow = {
  id: string
  requesterId: string
  requesterName: string
  mediaType: MediaType
  title: string
  artist: string | null
  year: number | null
  status: MediaRequestStatus
  notes: string | null
  createdAt: Date
}

export type MediaRequestCommentRow = {
  id: string
  requestId: string
  userId: string
  userName: string
  message: string
  createdAt: Date
}

export async function listMediaRequests() {
  return sql<Array<MediaRequestRow>>`
    SELECT r."id", r."requesterId",
           btrim(u."firstName" || ' ' || u."lastName") AS "requesterName",
           r."mediaType", r."title", r."artist", r."year", r."status",
           r."notes", r."createdAt"
    FROM "MediaRequest" r
    JOIN "User" u ON u."id" = r."requesterId"
    ORDER BY r."createdAt" DESC`
}

export async function listMediaRequestComments() {
  return sql<Array<MediaRequestCommentRow>>`
    SELECT c."id", c."requestId", c."userId",
           btrim(u."firstName" || ' ' || u."lastName") AS "userName",
           c."message", c."createdAt"
    FROM "MediaRequestComment" c
    JOIN "User" u ON u."id" = c."userId"
    ORDER BY c."createdAt" ASC`
}

export async function createMediaRequest(
  requesterId: string,
  data: {
    mediaType: MediaType
    title: string
    artist: string | null
    year: number | null
    notes: string | null
  }
): Promise<void> {
  await sql`
    INSERT INTO "MediaRequest"
      ("requesterId","mediaType","title","artist","year","notes")
    VALUES (${requesterId}, ${data.mediaType}::"MediaType", ${data.title},
            ${data.artist}, ${data.year}, ${data.notes})`
}

export async function setMediaRequestStatus(
  requestId: string,
  status: MediaRequestStatus
): Promise<void> {
  await sql`
    UPDATE "MediaRequest"
    SET "status" = ${status}::"RequestStatus", "updatedAt" = now()
    WHERE "id" = ${requestId}`
}

export async function getMediaRequestRequesterId(
  requestId: string
): Promise<string | null> {
  const rows = await sql<Array<{ requesterId: string }>>`
    SELECT "requesterId" FROM "MediaRequest" WHERE "id" = ${requestId}`
  return rows[0]?.requesterId ?? null
}

export async function deleteMediaRequest(requestId: string): Promise<void> {
  await sql`DELETE FROM "MediaRequest" WHERE "id" = ${requestId}`
}

// Inserts only if the request still exists; returns false otherwise.
export async function addMediaRequestComment(
  requestId: string,
  userId: string,
  message: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "MediaRequestComment" ("requestId","userId","message")
    SELECT r."id", ${userId}::uuid, ${message}::text
    FROM "MediaRequest" r
    WHERE r."id" = ${requestId}
    RETURNING "id"`
  return rows.length > 0
}
