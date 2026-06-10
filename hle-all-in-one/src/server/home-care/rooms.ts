import { sql } from "@/server/db"

export type RoomRow = {
  id: string
  name: string
  description: string | null
  floor: string | null
  sortOrder: number
  itemCount: number
}

export type RoomOption = {
  id: string
  name: string
}

export type RoomInput = {
  name: string
  description: string | null
  floor: string | null
}

export async function listRooms(householdId: string): Promise<Array<RoomRow>> {
  return sql<Array<RoomRow>>`
    SELECT r."id", r."name", r."description", r."floor", r."sortOrder",
           (SELECT count(*) FROM "Item" i WHERE i."roomId" = r."id")::int
             AS "itemCount"
    FROM "Room" r
    WHERE r."householdId" = ${householdId}
    ORDER BY r."sortOrder" ASC, r."name" ASC`
}

export async function listRoomOptions(
  householdId: string
): Promise<Array<RoomOption>> {
  return sql<Array<RoomOption>>`
    SELECT "id", "name"
    FROM "Room"
    WHERE "householdId" = ${householdId}
    ORDER BY "name" ASC`
}

export async function createRoom(
  householdId: string,
  input: RoomInput
): Promise<void> {
  await sql`
    INSERT INTO "Room" ("householdId", "name", "description", "floor")
    VALUES (${householdId}, ${input.name}, ${input.description},
            ${input.floor})`
}

export async function updateRoom(
  householdId: string,
  id: string,
  input: RoomInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Room" SET
      "name" = ${input.name},
      "description" = ${input.description},
      "floor" = ${input.floor},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteRoom(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Room"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Ownership re-check before referencing a room id from form data (ADR-0005).
export async function roomBelongsToHousehold(
  householdId: string,
  roomId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Room"
    WHERE "id" = ${roomId} AND "householdId" = ${householdId}`
  return rows.length > 0
}
