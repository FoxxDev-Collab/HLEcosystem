import { sql } from "@/server/db"

export type ProviderSpecialty =
  | "HVAC"
  | "PLUMBING"
  | "ELECTRICAL"
  | "APPLIANCE_REPAIR"
  | "GENERAL_CONTRACTOR"
  | "LANDSCAPING"
  | "PEST_CONTROL"
  | "ROOFING"
  | "PAINTING"
  | "FLOORING"
  | "AUTO_MECHANIC"
  | "AUTO_BODY"
  | "AUTO_DEALER"
  | "CLEANING"
  | "LOCKSMITH"
  | "HANDYMAN"
  | "OTHER"

export type ProviderRow = {
  id: string
  name: string
  company: string | null
  specialty: ProviderSpecialty
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  rating: number | null
  notes: string | null
  isActive: boolean
  repairCount: number
}

export type ProviderInput = {
  name: string
  company: string | null
  specialty: ProviderSpecialty
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  rating: number | null
  notes: string | null
}

export async function listProviders(
  householdId: string
): Promise<Array<ProviderRow>> {
  return sql<Array<ProviderRow>>`
    SELECT p."id", p."name", p."company", p."specialty", p."phone",
           p."email", p."website", p."address", p."rating", p."notes",
           p."isActive",
           (SELECT count(*) FROM "Repair" r WHERE r."providerId" = p."id")::int
             AS "repairCount"
    FROM "ServiceProvider" p
    WHERE p."householdId" = ${householdId}
    ORDER BY p."name" ASC`
}

export async function createProvider(
  householdId: string,
  input: ProviderInput
): Promise<void> {
  await sql`
    INSERT INTO "ServiceProvider" (
      "householdId", "name", "company", "specialty", "phone", "email",
      "website", "address", "rating", "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.company},
      ${input.specialty}::"ProviderSpecialty", ${input.phone}, ${input.email},
      ${input.website}, ${input.address}, ${input.rating}, ${input.notes}
    )`
}

export async function deleteProvider(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ServiceProvider"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}
