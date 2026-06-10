import { sql } from "@/server/db"

export type ItemCondition =
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "POOR"
  | "NEEDS_REPAIR"
  | "DECOMMISSIONED"

export type ItemListRow = {
  id: string
  roomId: string | null
  roomName: string | null
  name: string
  manufacturer: string | null
  model: string | null
  purchasePrice: number | null
  warrantyExpires: string | null
  warrantyNotes: string | null
  condition: ItemCondition
}

export type ItemRow = {
  id: string
  roomId: string | null
  roomName: string | null
  name: string
  description: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  purchasedFrom: string | null
  warrantyExpires: string | null
  warrantyNotes: string | null
  condition: ItemCondition
  manualUrl: string | null
  notes: string | null
  isArchived: boolean
}

export type ItemMaintenanceLogRow = {
  id: string
  title: string
  completedDate: string
  completedBy: string | null
  cost: number | null
  notes: string | null
}

export type ItemRepairRow = {
  id: string
  title: string
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  reportedDate: string
  completedBy: string | null
  providerName: string | null
  totalCost: number | null
  notes: string | null
}

export type ItemDocumentRow = {
  id: string
  name: string
  type: "MANUAL" | "WARRANTY" | "RECEIPT" | "INVOICE" | "PHOTO" | "OTHER"
}

export type ItemInput = {
  roomId: string | null
  name: string
  description: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  purchasedFrom: string | null
  warrantyExpires: string | null
  warrantyNotes: string | null
  condition: ItemCondition
  manualUrl: string | null
  notes: string | null
}

export async function listItems(
  householdId: string
): Promise<Array<ItemListRow>> {
  return sql<Array<ItemListRow>>`
    SELECT i."id", i."roomId", r."name" AS "roomName", i."name",
           i."manufacturer", i."model", i."purchasePrice"::float8,
           i."warrantyExpires"::text, i."warrantyNotes", i."condition"
    FROM "Item" i
    LEFT JOIN "Room" r ON r."id" = i."roomId"
    WHERE i."householdId" = ${householdId} AND NOT i."isArchived"
    ORDER BY i."name" ASC`
}

export async function getItem(
  householdId: string,
  id: string
): Promise<ItemRow | null> {
  const rows = await sql<Array<ItemRow>>`
    SELECT i."id", i."roomId", r."name" AS "roomName", i."name",
           i."description", i."manufacturer", i."model", i."serialNumber",
           i."purchaseDate"::text, i."purchasePrice"::float8,
           i."purchasedFrom", i."warrantyExpires"::text, i."warrantyNotes",
           i."condition", i."manualUrl", i."notes", i."isArchived"
    FROM "Item" i
    LEFT JOIN "Room" r ON r."id" = i."roomId"
    WHERE i."id" = ${id} AND i."householdId" = ${householdId}`
  return rows[0] ?? null
}

export async function listMaintenanceLogsForItem(
  householdId: string,
  itemId: string
): Promise<Array<ItemMaintenanceLogRow>> {
  return sql<Array<ItemMaintenanceLogRow>>`
    SELECT "id", "title", "completedDate"::text, "completedBy",
           "cost"::float8, "notes"
    FROM "MaintenanceLog"
    WHERE "householdId" = ${householdId} AND "itemId" = ${itemId}
    ORDER BY "completedDate" DESC
    LIMIT 10`
}

export async function listRepairsForItem(
  householdId: string,
  itemId: string
): Promise<Array<ItemRepairRow>> {
  return sql<Array<ItemRepairRow>>`
    SELECT rep."id", rep."title", rep."status", rep."reportedDate"::text,
           rep."completedBy", p."name" AS "providerName",
           rep."totalCost"::float8, rep."notes"
    FROM "Repair" rep
    LEFT JOIN "ServiceProvider" p ON p."id" = rep."providerId"
    WHERE rep."householdId" = ${householdId} AND rep."itemId" = ${itemId}
    ORDER BY rep."reportedDate" DESC
    LIMIT 10`
}

export async function listDocumentsForItem(
  householdId: string,
  itemId: string
): Promise<Array<ItemDocumentRow>> {
  return sql<Array<ItemDocumentRow>>`
    SELECT "id", "name", "type"
    FROM "Document"
    WHERE "householdId" = ${householdId} AND "itemId" = ${itemId}
    ORDER BY "createdAt" DESC`
}

export async function createItem(
  householdId: string,
  input: ItemInput
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Item" (
      "householdId", "roomId", "name", "description", "manufacturer",
      "model", "serialNumber", "purchaseDate", "purchasePrice",
      "purchasedFrom", "warrantyExpires", "warrantyNotes", "condition",
      "manualUrl", "notes"
    ) VALUES (
      ${householdId}, ${input.roomId}, ${input.name}, ${input.description},
      ${input.manufacturer}, ${input.model}, ${input.serialNumber},
      ${input.purchaseDate}, ${input.purchasePrice}, ${input.purchasedFrom},
      ${input.warrantyExpires}, ${input.warrantyNotes},
      ${input.condition}::"ItemCondition", ${input.manualUrl}, ${input.notes}
    ) RETURNING "id"`
  return rows[0].id
}

export async function updateItem(
  householdId: string,
  id: string,
  input: ItemInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Item" SET
      "roomId" = ${input.roomId},
      "name" = ${input.name},
      "description" = ${input.description},
      "manufacturer" = ${input.manufacturer},
      "model" = ${input.model},
      "serialNumber" = ${input.serialNumber},
      "purchaseDate" = ${input.purchaseDate},
      "purchasePrice" = ${input.purchasePrice},
      "purchasedFrom" = ${input.purchasedFrom},
      "warrantyExpires" = ${input.warrantyExpires},
      "warrantyNotes" = ${input.warrantyNotes},
      "condition" = ${input.condition}::"ItemCondition",
      "manualUrl" = ${input.manualUrl},
      "notes" = ${input.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function archiveItem(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Item" SET "isArchived" = true, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteItem(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Item"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}
