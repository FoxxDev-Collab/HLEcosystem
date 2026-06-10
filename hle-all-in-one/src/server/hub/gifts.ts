import { sql } from "@/server/db"

export type GiftStatus = "IDEA" | "PURCHASED" | "WRAPPED" | "GIVEN"
export type GiftIdeaStatus = "ACTIVE" | "PURCHASED" | "NOT_INTERESTED"
export type GiftIdeaPriority = "LOW" | "MEDIUM" | "HIGH"

// Recipient picker rows — active household members only (legacy parity).
export type GiftRecipientRow = {
  id: string
  firstName: string
  lastName: string
  nickname: string | null
}

export type GiftRow = {
  id: string
  familyMemberId: string
  recipientFirstName: string
  recipientLastName: string
  description: string
  giftDate: string | null
  occasion: string | null
  status: GiftStatus
  estimatedCost: number | null
  actualCost: number | null
  rating: number | null
  notes: string | null
  createdAt: Date
}

export type GiftIdeaRow = {
  id: string
  familyMemberId: string | null
  recipientFirstName: string | null
  recipientLastName: string | null
  idea: string
  dateCaptured: string
  source: string | null
  priority: GiftIdeaPriority
  status: GiftIdeaStatus
  estimatedCost: number | null
  url: string | null
  notes: string | null
  createdAt: Date
}

export type GiftInput = {
  familyMemberId: string
  description: string
  giftDate: string | null
  occasion: string | null
  status: GiftStatus
  estimatedCost: number | null
  actualCost: number | null
  rating: number | null
  notes: string | null
}

export type GiftIdeaInput = {
  familyMemberId: string | null
  idea: string
  source: string | null
  priority: GiftIdeaPriority
  estimatedCost: number | null
  url: string | null
  notes: string | null
}

export async function listGiftRecipients(
  householdId: string
): Promise<Array<GiftRecipientRow>> {
  return sql<Array<GiftRecipientRow>>`
    SELECT "id", "firstName", "lastName", "nickname"
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId} AND "isActive" = true
    ORDER BY "firstName" ASC, "lastName" ASC`
}

// Ownership re-check for recipient ids coming from the client (ADR-0005):
// never trust a familyMemberId from form data.
async function memberBelongsToHousehold(
  familyMemberId: string,
  householdId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FamilyMember"
    WHERE "id" = ${familyMemberId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export async function listGifts(householdId: string): Promise<Array<GiftRow>> {
  return sql<Array<GiftRow>>`
    SELECT g."id", g."familyMemberId",
           fm."firstName" AS "recipientFirstName",
           fm."lastName" AS "recipientLastName",
           g."description", g."giftDate"::text, g."occasion", g."status",
           g."estimatedCost"::float8, g."actualCost"::float8, g."rating",
           g."notes", g."createdAt"
    FROM "Gift" g
    JOIN "FamilyMember" fm ON fm."id" = g."familyMemberId"
    WHERE g."householdId" = ${householdId}
    ORDER BY g."createdAt" DESC`
}

export async function createGift(
  householdId: string,
  data: GiftInput
): Promise<{ ok: true } | { error: string }> {
  if (!(await memberBelongsToHousehold(data.familyMemberId, householdId))) {
    return { error: "Family member not found in this household." }
  }
  await sql`
    INSERT INTO "Gift"
      ("householdId", "familyMemberId", "description", "giftDate", "occasion",
       "status", "estimatedCost", "actualCost", "rating", "notes")
    VALUES
      (${householdId}, ${data.familyMemberId}, ${data.description},
       ${data.giftDate}, ${data.occasion}, ${data.status}::"GiftStatus",
       ${data.estimatedCost}, ${data.actualCost}, ${data.rating}, ${data.notes})`
  return { ok: true }
}

export async function updateGift(
  householdId: string,
  id: string,
  data: GiftInput
): Promise<{ ok: true } | { error: string }> {
  if (!(await memberBelongsToHousehold(data.familyMemberId, householdId))) {
    return { error: "Family member not found in this household." }
  }
  await sql`
    UPDATE "Gift" SET
      "familyMemberId" = ${data.familyMemberId},
      "description" = ${data.description},
      "giftDate" = ${data.giftDate},
      "occasion" = ${data.occasion},
      "status" = ${data.status}::"GiftStatus",
      "estimatedCost" = ${data.estimatedCost},
      "actualCost" = ${data.actualCost},
      "rating" = ${data.rating},
      "notes" = ${data.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return { ok: true }
}

export async function updateGiftStatus(
  householdId: string,
  id: string,
  status: GiftStatus
): Promise<void> {
  await sql`
    UPDATE "Gift" SET "status" = ${status}::"GiftStatus", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function deleteGift(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    DELETE FROM "Gift"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function listGiftIdeas(
  householdId: string
): Promise<Array<GiftIdeaRow>> {
  // Enum ordering matches the legacy Prisma sort: status ASC puts ACTIVE
  // first (declaration order), priority DESC puts HIGH first.
  return sql<Array<GiftIdeaRow>>`
    SELECT gi."id", gi."familyMemberId",
           fm."firstName" AS "recipientFirstName",
           fm."lastName" AS "recipientLastName",
           gi."idea", gi."dateCaptured"::text, gi."source", gi."priority",
           gi."status", gi."estimatedCost"::float8, gi."url", gi."notes",
           gi."createdAt"
    FROM "GiftIdea" gi
    LEFT JOIN "FamilyMember" fm ON fm."id" = gi."familyMemberId"
    WHERE gi."householdId" = ${householdId}
    ORDER BY gi."status" ASC, gi."priority" DESC, gi."createdAt" DESC`
}

export async function createGiftIdea(
  householdId: string,
  data: GiftIdeaInput
): Promise<{ ok: true } | { error: string }> {
  if (
    data.familyMemberId &&
    !(await memberBelongsToHousehold(data.familyMemberId, householdId))
  ) {
    return { error: "Family member not found in this household." }
  }
  await sql`
    INSERT INTO "GiftIdea"
      ("householdId", "familyMemberId", "idea", "source", "priority",
       "estimatedCost", "url", "notes")
    VALUES
      (${householdId}, ${data.familyMemberId}, ${data.idea}, ${data.source},
       ${data.priority}::"GiftIdeaPriority", ${data.estimatedCost},
       ${data.url}, ${data.notes})`
  return { ok: true }
}

export async function updateGiftIdea(
  householdId: string,
  id: string,
  data: GiftIdeaInput
): Promise<{ ok: true } | { error: string }> {
  if (
    data.familyMemberId &&
    !(await memberBelongsToHousehold(data.familyMemberId, householdId))
  ) {
    return { error: "Family member not found in this household." }
  }
  await sql`
    UPDATE "GiftIdea" SET
      "familyMemberId" = ${data.familyMemberId},
      "idea" = ${data.idea},
      "source" = ${data.source},
      "priority" = ${data.priority}::"GiftIdeaPriority",
      "estimatedCost" = ${data.estimatedCost},
      "url" = ${data.url},
      "notes" = ${data.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return { ok: true }
}

export async function updateGiftIdeaStatus(
  householdId: string,
  id: string,
  status: GiftIdeaStatus
): Promise<void> {
  await sql`
    UPDATE "GiftIdea"
    SET "status" = ${status}::"GiftIdeaStatus", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function deleteGiftIdea(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    DELETE FROM "GiftIdea"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

// Promote an idea to the gift tracker: creates a PURCHASED Gift carrying the
// idea's recipient, cost and notes, then removes the idea (legacy behavior).
export async function convertIdeaToGift(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  return sql.begin(async (tx) => {
    const rows = await tx<
      Array<{
        familyMemberId: string | null
        idea: string
        estimatedCost: number | null
        notes: string | null
      }>
    >`
      SELECT "familyMemberId", "idea", "estimatedCost"::float8, "notes"
      FROM "GiftIdea"
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
    const ideaRow = rows[0]
    if (!ideaRow) {
      return { error: "Gift idea not found." }
    }
    if (!ideaRow.familyMemberId) {
      return { error: "Assign a family member before converting to a gift." }
    }
    await tx`
      INSERT INTO "Gift"
        ("householdId", "familyMemberId", "description", "status",
         "estimatedCost", "notes")
      VALUES
        (${householdId}, ${ideaRow.familyMemberId}, ${ideaRow.idea},
         'PURCHASED', ${ideaRow.estimatedCost}, ${ideaRow.notes})`
    await tx`
      DELETE FROM "GiftIdea"
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
    return { ok: true as const }
  })
}
