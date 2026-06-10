import { sql } from "@/server/db"

export type Relationship =
  | "Spouse"
  | "Partner"
  | "Parent"
  | "Child"
  | "Sibling"
  | "Grandparent"
  | "Grandchild"
  | "AuntUncle"
  | "NieceNephew"
  | "Cousin"
  | "InLaw"
  | "StepParent"
  | "StepChild"
  | "StepSibling"
  | "Godparent"
  | "Godchild"
  | "Friend"
  | "Other"

export type PreferredContactMethod = "NONE" | "PHONE" | "EMAIL" | "TEXT"

export type FamilyMemberRow = {
  id: string
  linkedUserId: string | null
  firstName: string
  lastName: string
  nickname: string | null
  relationship: Relationship | null
  relationshipNotes: string | null
  birthday: string | null
  anniversary: string | null
  phone: string | null
  email: string | null
  preferredContactMethod: PreferredContactMethod
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null
  notes: string | null
  isActive: boolean
  includeInHolidayCards: boolean
}

export type AddressRow = {
  id: string
  familyMemberId: string
  label: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string | null
  zipCode: string | null
  country: string | null
  isCurrent: boolean
  moveInDate: string | null
  moveOutDate: string | null
  notes: string | null
}

export type CareerEntryRow = {
  id: string
  familyMemberId: string
  employer: string
  title: string | null
  department: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  location: string | null
  notes: string | null
}

export type RelationRow = {
  id: string
  relationType: Relationship
  toMemberId: string
  toFirstName: string
  toLastName: string
  toHouseholdId: string
}

export type RelativeRelation = {
  memberId: string
  relationType: Relationship
}

export type CrossHouseholdRelativeRow = {
  id: string
  firstName: string
  lastName: string
  birthday: string | null
  householdName: string
}

export type MemberImportantDateRow = {
  id: string
  label: string
  date: string
  type:
    | "BIRTHDAY"
    | "ANNIVERSARY"
    | "GRADUATION"
    | "MEMORIAL"
    | "HOLIDAY"
    | "CUSTOM"
}

export type MemberGiftRow = {
  id: string
  description: string
  occasion: string | null
  status: "IDEA" | "PURCHASED" | "WRAPPED" | "GIVEN"
  estimatedCost: number | null
  actualCost: number | null
}

export type MemberGiftIdeaRow = {
  id: string
  idea: string
  source: string | null
  priority: "LOW" | "MEDIUM" | "HIGH"
  estimatedCost: number | null
}

export type FamilyMemberInput = {
  firstName: string
  lastName: string
  nickname: string | null
  relationshipNotes: string | null
  birthday: string | null
  anniversary: string | null
  phone: string | null
  email: string | null
  preferredContactMethod: PreferredContactMethod
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null
  notes: string | null
  includeInHolidayCards: boolean
}

export async function listFamilyMembers(
  householdId: string
): Promise<Array<FamilyMemberRow>> {
  return sql<Array<FamilyMemberRow>>`
    SELECT "id", "linkedUserId", "firstName", "lastName", "nickname",
           "relationship", "relationshipNotes", "birthday"::text,
           "anniversary"::text, "phone", "email", "preferredContactMethod",
           "addressLine1", "addressLine2", "city", "state", "zipCode",
           "country", "notes", "isActive", "includeInHolidayCards"
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId}
    ORDER BY "isActive" DESC, "firstName" ASC, "lastName" ASC`
}

export async function getFamilyMember(
  householdId: string,
  id: string
): Promise<FamilyMemberRow | null> {
  const rows = await sql<Array<FamilyMemberRow>>`
    SELECT "id", "linkedUserId", "firstName", "lastName", "nickname",
           "relationship", "relationshipNotes", "birthday"::text,
           "anniversary"::text, "phone", "email", "preferredContactMethod",
           "addressLine1", "addressLine2", "city", "state", "zipCode",
           "country", "notes", "isActive", "includeInHolidayCards"
    FROM "FamilyMember"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

export async function listHolidayCardMembers(
  householdId: string
): Promise<Array<FamilyMemberRow>> {
  return sql<Array<FamilyMemberRow>>`
    SELECT "id", "linkedUserId", "firstName", "lastName", "nickname",
           "relationship", "relationshipNotes", "birthday"::text,
           "anniversary"::text, "phone", "email", "preferredContactMethod",
           "addressLine1", "addressLine2", "city", "state", "zipCode",
           "country", "notes", "isActive", "includeInHolidayCards"
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId}
      AND "includeInHolidayCards" AND "isActive"
    ORDER BY "lastName" ASC, "firstName" ASC`
}

// Viewer-relative labels: relations pointing AT the viewer's own member record
// ("that person IS relationType TO me"). Authoritative over the static
// FamilyMember.relationship field.
export async function listRelativeRelationships(
  householdId: string,
  userId: string
): Promise<Array<RelativeRelation>> {
  return sql<Array<RelativeRelation>>`
    SELECT r."fromMemberId" AS "memberId", r."relationType"
    FROM "FamilyRelation" r
    JOIN "FamilyMember" self ON self."id" = r."toMemberId"
    WHERE r."householdId" = ${householdId}
      AND self."householdId" = ${householdId}
      AND self."linkedUserId" = ${userId}`
}

// Family-tree relations owned by this household may point at members of OTHER
// households (cross-household by design — same as the legacy family tree).
// Only members reachable through this household's own relations are exposed.
export async function listCrossHouseholdRelatives(
  householdId: string
): Promise<Array<CrossHouseholdRelativeRow>> {
  return sql<Array<CrossHouseholdRelativeRow>>`
    SELECT DISTINCT m."id", m."firstName", m."lastName", m."birthday"::text,
           h."name" AS "householdName"
    FROM "FamilyRelation" r
    JOIN "FamilyMember" m
      ON m."id" = r."fromMemberId" OR m."id" = r."toMemberId"
    JOIN "Household" h ON h."id" = m."householdId"
    WHERE r."householdId" = ${householdId}
      AND m."householdId" <> ${householdId}
      AND m."isActive"
    ORDER BY "householdName" ASC, m."firstName" ASC`
}

export async function listRelationsFrom(
  householdId: string,
  memberId: string
): Promise<Array<RelationRow>> {
  return sql<Array<RelationRow>>`
    SELECT r."id", r."relationType",
           t."id" AS "toMemberId", t."firstName" AS "toFirstName",
           t."lastName" AS "toLastName", t."householdId" AS "toHouseholdId"
    FROM "FamilyRelation" r
    JOIN "FamilyMember" t ON t."id" = r."toMemberId"
    WHERE r."householdId" = ${householdId} AND r."fromMemberId" = ${memberId}
    ORDER BY t."firstName" ASC`
}

// Child tables have no householdId — scope through the parent FamilyMember.
export async function listAddressesForMember(
  householdId: string,
  memberId: string
): Promise<Array<AddressRow>> {
  return sql<Array<AddressRow>>`
    SELECT a."id", a."familyMemberId", a."label", a."addressLine1",
           a."addressLine2", a."city", a."state", a."zipCode", a."country",
           a."isCurrent", a."moveInDate"::text, a."moveOutDate"::text, a."notes"
    FROM "Address" a
    JOIN "FamilyMember" m ON m."id" = a."familyMemberId"
    WHERE a."familyMemberId" = ${memberId} AND m."householdId" = ${householdId}
    ORDER BY a."isCurrent" DESC, a."moveInDate" DESC NULLS LAST`
}

export async function listCareerEntriesForMember(
  householdId: string,
  memberId: string
): Promise<Array<CareerEntryRow>> {
  return sql<Array<CareerEntryRow>>`
    SELECT c."id", c."familyMemberId", c."employer", c."title", c."department",
           c."startDate"::text, c."endDate"::text, c."isCurrent", c."location",
           c."notes"
    FROM "CareerEntry" c
    JOIN "FamilyMember" m ON m."id" = c."familyMemberId"
    WHERE c."familyMemberId" = ${memberId} AND m."householdId" = ${householdId}
    ORDER BY c."isCurrent" DESC, c."startDate" DESC NULLS LAST`
}

export async function listImportantDatesForMember(
  householdId: string,
  memberId: string
): Promise<Array<MemberImportantDateRow>> {
  return sql<Array<MemberImportantDateRow>>`
    SELECT "id", "label", "date"::text, "type"
    FROM "ImportantDate"
    WHERE "householdId" = ${householdId} AND "familyMemberId" = ${memberId}
    ORDER BY "date" ASC`
}

export async function listGiftsForMember(
  householdId: string,
  memberId: string
): Promise<Array<MemberGiftRow>> {
  return sql<Array<MemberGiftRow>>`
    SELECT "id", "description", "occasion", "status",
           "estimatedCost"::float8, "actualCost"::float8
    FROM "Gift"
    WHERE "householdId" = ${householdId} AND "familyMemberId" = ${memberId}
    ORDER BY "createdAt" DESC`
}

export async function listActiveGiftIdeasForMember(
  householdId: string,
  memberId: string
): Promise<Array<MemberGiftIdeaRow>> {
  return sql<Array<MemberGiftIdeaRow>>`
    SELECT "id", "idea", "source", "priority", "estimatedCost"::float8
    FROM "GiftIdea"
    WHERE "householdId" = ${householdId} AND "familyMemberId" = ${memberId}
      AND "status" = 'ACTIVE'
    ORDER BY "priority" DESC, "createdAt" DESC`
}

// Keeps a member's birthday/anniversary mirrored into "ImportantDate" so they
// show up on the dates page and dashboard (legacy syncMemberDates rule).
export async function syncMemberDates(
  householdId: string,
  memberId: string,
  firstName: string,
  lastName: string,
  birthday: string | null,
  anniversary: string | null
): Promise<void> {
  const configs: Array<{
    type: "BIRTHDAY" | "ANNIVERSARY"
    date: string | null
    label: string
  }> = [
    {
      type: "BIRTHDAY",
      date: birthday,
      label: `${firstName} ${lastName}'s Birthday`,
    },
    {
      type: "ANNIVERSARY",
      date: anniversary,
      label: `${firstName} ${lastName} — Wedding Anniversary`,
    },
  ]

  for (const { type, date, label } of configs) {
    const existing = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "ImportantDate"
      WHERE "householdId" = ${householdId}
        AND "familyMemberId" = ${memberId}
        AND "type" = ${type}::"ImportantDateType"
      LIMIT 1`
    const found = existing[0] ?? null

    if (date && found) {
      await sql`
        UPDATE "ImportantDate" SET "date" = ${date}, "label" = ${label}
        WHERE "id" = ${found.id} AND "householdId" = ${householdId}`
    } else if (date && !found) {
      await sql`
        INSERT INTO "ImportantDate"
          ("householdId", "familyMemberId", "label", "date", "type",
           "recurrenceType", "reminderDaysBefore")
        VALUES (${householdId}, ${memberId}, ${label}, ${date},
                ${type}::"ImportantDateType", 'ANNUAL', 14)`
    } else if (!date && found) {
      await sql`
        DELETE FROM "ImportantDate"
        WHERE "id" = ${found.id} AND "householdId" = ${householdId}`
    }
  }
}

export async function createFamilyMember(
  householdId: string,
  input: FamilyMemberInput,
  linkedUserId: string | null = null,
  relationship: Relationship | null = null
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "FamilyMember" (
      "householdId", "linkedUserId", "firstName", "lastName", "nickname",
      "relationship", "relationshipNotes", "birthday", "anniversary", "phone",
      "email", "preferredContactMethod", "addressLine1", "addressLine2",
      "city", "state", "zipCode", "country", "notes", "includeInHolidayCards"
    ) VALUES (
      ${householdId}, ${linkedUserId}, ${input.firstName}, ${input.lastName},
      ${input.nickname}, ${relationship}::"Relationship",
      ${input.relationshipNotes}, ${input.birthday}, ${input.anniversary},
      ${input.phone}, ${input.email},
      ${input.preferredContactMethod}::"PreferredContactMethod",
      ${input.addressLine1}, ${input.addressLine2}, ${input.city},
      ${input.state}, ${input.zipCode}, ${input.country}, ${input.notes},
      ${input.includeInHolidayCards}
    ) RETURNING "id"`
  return rows[0].id
}

export async function updateFamilyMember(
  householdId: string,
  id: string,
  input: FamilyMemberInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "FamilyMember" SET
      "firstName" = ${input.firstName},
      "lastName" = ${input.lastName},
      "nickname" = ${input.nickname},
      "relationshipNotes" = ${input.relationshipNotes},
      "birthday" = ${input.birthday},
      "anniversary" = ${input.anniversary},
      "phone" = ${input.phone},
      "email" = ${input.email},
      "preferredContactMethod" = ${input.preferredContactMethod}::"PreferredContactMethod",
      "addressLine1" = ${input.addressLine1},
      "addressLine2" = ${input.addressLine2},
      "city" = ${input.city},
      "state" = ${input.state},
      "zipCode" = ${input.zipCode},
      "country" = ${input.country},
      "notes" = ${input.notes},
      "includeInHolidayCards" = ${input.includeInHolidayCards},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function toggleFamilyMemberActive(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "FamilyMember"
    SET "isActive" = NOT "isActive", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteFamilyMember(
  householdId: string,
  id: string
): Promise<boolean> {
  // Auto-synced ImportantDate rows use ON DELETE SET NULL — remove them first
  // so they don't linger as orphans (legacy delete rule).
  await sql`
    DELETE FROM "ImportantDate"
    WHERE "householdId" = ${householdId} AND "familyMemberId" = ${id}
      AND "type" IN ('BIRTHDAY', 'ANNIVERSARY')`
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "FamilyMember"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export type AddressInput = {
  label: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string | null
  zipCode: string | null
  country: string | null
  isCurrent: boolean
  moveInDate: string | null
  moveOutDate: string | null
  notes: string | null
}

export async function addAddress(
  householdId: string,
  memberId: string,
  input: AddressInput
): Promise<void> {
  if (input.isCurrent) {
    // A member has at most one current address — displace the old one and
    // stamp its move-out date (legacy rule).
    await sql`
      UPDATE "Address" a
      SET "isCurrent" = false, "moveOutDate" = CURRENT_DATE
      FROM "FamilyMember" m
      WHERE m."id" = a."familyMemberId"
        AND a."familyMemberId" = ${memberId}
        AND m."householdId" = ${householdId}
        AND a."isCurrent"`
  }
  await sql`
    INSERT INTO "Address" (
      "familyMemberId", "label", "addressLine1", "addressLine2", "city",
      "state", "zipCode", "country", "isCurrent", "moveInDate", "moveOutDate",
      "notes"
    ) VALUES (
      ${memberId}, ${input.label}, ${input.addressLine1}, ${input.addressLine2},
      ${input.city}, ${input.state}, ${input.zipCode}, ${input.country},
      ${input.isCurrent}, ${input.moveInDate}, ${input.moveOutDate},
      ${input.notes}
    )`
}

export async function deleteAddress(
  householdId: string,
  addressId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Address" a
    USING "FamilyMember" m
    WHERE a."id" = ${addressId} AND m."id" = a."familyMemberId"
      AND m."householdId" = ${householdId}
    RETURNING a."id"`
  return rows.length > 0
}

export type CareerEntryInput = {
  employer: string
  title: string | null
  department: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  location: string | null
  notes: string | null
}

export async function addCareerEntry(
  householdId: string,
  memberId: string,
  input: CareerEntryInput
): Promise<void> {
  if (input.isCurrent) {
    // A member has at most one current position — close out the old one with
    // today as its end date (legacy rule).
    await sql`
      UPDATE "CareerEntry" c
      SET "isCurrent" = false, "endDate" = CURRENT_DATE
      FROM "FamilyMember" m
      WHERE m."id" = c."familyMemberId"
        AND c."familyMemberId" = ${memberId}
        AND m."householdId" = ${householdId}
        AND c."isCurrent"`
  }
  await sql`
    INSERT INTO "CareerEntry" (
      "familyMemberId", "employer", "title", "department", "startDate",
      "endDate", "isCurrent", "location", "notes"
    ) VALUES (
      ${memberId}, ${input.employer}, ${input.title}, ${input.department},
      ${input.startDate}, ${input.endDate}, ${input.isCurrent},
      ${input.location}, ${input.notes}
    )`
}

export async function deleteCareerEntry(
  householdId: string,
  careerEntryId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "CareerEntry" c
    USING "FamilyMember" m
    WHERE c."id" = ${careerEntryId} AND m."id" = c."familyMemberId"
      AND m."householdId" = ${householdId}
    RETURNING c."id"`
  return rows.length > 0
}

// Ownership re-check before mutating child rows by parent id (ADR-0005).
export async function memberBelongsToHousehold(
  householdId: string,
  memberId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FamilyMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export async function findMemberByLinkedUser(
  householdId: string,
  userId: string
): Promise<{ id: string } | null> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FamilyMember"
    WHERE "householdId" = ${householdId} AND "linkedUserId" = ${userId}`
  return rows[0] ?? null
}
