import { sql } from "@/server/db"

// ─── Enum types (match PG enums in migrations/0003_hub.sql) ─────────────────

export type DegreeType =
  | "HIGH_SCHOOL"
  | "ASSOCIATE"
  | "BACHELOR"
  | "MASTER"
  | "DOCTORATE"
  | "CERTIFICATE"
  | "DIPLOMA"
  | "GED"
  | "TRADE"
  | "OTHER"

export type EducationStatus =
  "IN_PROGRESS" | "COMPLETED" | "WITHDRAWN" | "TRANSFERRED"

export type GradeTerm =
  | "QUARTER_1"
  | "QUARTER_2"
  | "QUARTER_3"
  | "QUARTER_4"
  | "SEMESTER_1"
  | "SEMESTER_2"
  | "TRIMESTER_1"
  | "TRIMESTER_2"
  | "TRIMESTER_3"
  | "SUMMER"
  | "FULL_YEAR"

export type ActivityCategory =
  | "SPORTS"
  | "ARTS"
  | "MUSIC"
  | "ACADEMIC"
  | "VOLUNTEER"
  | "CLUB"
  | "RELIGIOUS"
  | "OTHER"

export type CertificationStatus = "ACTIVE" | "EXPIRED" | "PENDING" | "REVOKED"

// ─── Row types ───────────────────────────────────────────────────────────────

export type MemberLite = {
  id: string
  firstName: string
  lastName: string
}

export type EducationEntryRow = {
  id: string
  familyMemberId: string
  institution: string
  degreeType: DegreeType | null
  fieldOfStudy: string | null
  startDate: string | null
  endDate: string | null
  graduationDate: string | null
  status: EducationStatus
  gpa: number | null
  isCurrent: boolean
  location: string | null
  notes: string | null
}

export type GradeReportRow = {
  id: string
  educationEntryId: string
  schoolYear: string
  term: GradeTerm
  reportDate: string | null
  overallGpa: number | null
  notes: string | null
}

export type GradeItemRow = {
  id: string
  gradeReportId: string
  subject: string
  grade: string
  percentage: number | null
  credits: number | null
  teacher: string | null
  notes: string | null
}

export type ActivityRow = {
  id: string
  familyMemberId: string
  name: string
  category: ActivityCategory
  organization: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  schedule: string | null
  cost: number | null
  notes: string | null
}

export type AchievementRow = {
  id: string
  familyMemberId: string
  activityId: string | null
  title: string
  description: string | null
  dateEarned: string | null
  issuer: string | null
  notes: string | null
}

export type CertificationRow = {
  id: string
  familyMemberId: string
  name: string
  issuingBody: string | null
  credentialId: string | null
  issueDate: string | null
  expirationDate: string | null
  status: CertificationStatus
  renewalCost: number | null
  url: string | null
  notes: string | null
}

// ─── Member picker / tenancy helpers ─────────────────────────────────────────

export async function listActiveMembers(
  householdId: string
): Promise<Array<MemberLite>> {
  return sql<Array<MemberLite>>`
    SELECT "id", "firstName", "lastName"
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "firstName", "lastName"`
}

// ADR-0005: re-verify the member actually belongs to this household before
// any write that references a familyMemberId from the client.
export async function memberInHousehold(
  memberId: string,
  householdId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FamilyMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// ─── Overview (education index) ──────────────────────────────────────────────

export type EducationOverviewMember = MemberLite & {
  currentInstitution: string | null
  activityCount: number
  achievementCount: number
  activeCertCount: number
}

export type ExpiringCertRow = {
  id: string
  name: string
  expirationDate: string
  firstName: string
  lastName: string
}

export async function getEducationOverview(householdId: string) {
  const members = await sql<Array<EducationOverviewMember>>`
    SELECT fm."id", fm."firstName", fm."lastName",
           ce."institution" AS "currentInstitution",
           (SELECT count(*)::int FROM "Activity" a
            WHERE a."familyMemberId" = fm."id"
              AND a."householdId" = ${householdId} AND a."isCurrent") AS "activityCount",
           (SELECT count(*)::int FROM "Achievement" ah
            WHERE ah."familyMemberId" = fm."id"
              AND ah."householdId" = ${householdId}) AS "achievementCount",
           (SELECT count(*)::int FROM "Certification" c
            WHERE c."familyMemberId" = fm."id"
              AND c."householdId" = ${householdId}
              AND c."status" = 'ACTIVE') AS "activeCertCount"
    FROM "FamilyMember" fm
    LEFT JOIN LATERAL (
      SELECT e."institution" FROM "EducationEntry" e
      WHERE e."familyMemberId" = fm."id" AND e."isCurrent"
      ORDER BY e."startDate" DESC NULLS LAST
      LIMIT 1
    ) ce ON true
    WHERE fm."householdId" = ${householdId} AND fm."isActive"
    ORDER BY fm."firstName", fm."lastName"`

  const expiringCerts = await sql<Array<ExpiringCertRow>>`
    SELECT c."id", c."name", c."expirationDate"::text,
           fm."firstName", fm."lastName"
    FROM "Certification" c
    JOIN "FamilyMember" fm ON fm."id" = c."familyMemberId"
      AND fm."householdId" = ${householdId}
    WHERE c."householdId" = ${householdId}
      AND c."status" = 'ACTIVE'
      AND c."expirationDate" IS NOT NULL
      AND c."expirationDate" <= CURRENT_DATE + 30
    ORDER BY c."expirationDate"`

  return { members, expiringCerts }
}

// ─── Member education detail ─────────────────────────────────────────────────

export async function getMemberEducation(
  householdId: string,
  memberId: string
) {
  const memberRows = await sql<Array<MemberLite>>`
    SELECT "id", "firstName", "lastName"
    FROM "FamilyMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}`
  const member = memberRows[0]
  if (!member) return null

  // memberId is verified above, so scoping through it is household-safe.
  const entries = await sql<Array<EducationEntryRow>>`
    SELECT "id", "familyMemberId", "institution", "degreeType", "fieldOfStudy",
           "startDate"::text, "endDate"::text, "graduationDate"::text,
           "status", "gpa"::float8, "isCurrent", "location", "notes"
    FROM "EducationEntry"
    WHERE "familyMemberId" = ${memberId}
    ORDER BY "isCurrent" DESC, "startDate" DESC NULLS LAST`

  const gradeReports = await sql<Array<GradeReportRow>>`
    SELECT r."id", r."educationEntryId", r."schoolYear", r."term",
           r."reportDate"::text, r."overallGpa"::float8, r."notes"
    FROM "GradeReport" r
    JOIN "EducationEntry" e ON e."id" = r."educationEntryId"
    WHERE e."familyMemberId" = ${memberId}
    ORDER BY r."schoolYear" DESC, r."createdAt" DESC`

  const gradeItems = await sql<Array<GradeItemRow>>`
    SELECT gi."id", gi."gradeReportId", gi."subject", gi."grade",
           gi."percentage"::float8, gi."credits"::float8, gi."teacher", gi."notes"
    FROM "GradeItem" gi
    JOIN "GradeReport" r ON r."id" = gi."gradeReportId"
    JOIN "EducationEntry" e ON e."id" = r."educationEntryId"
    WHERE e."familyMemberId" = ${memberId}
    ORDER BY gi."subject"`

  const activities = await sql<Array<ActivityRow>>`
    SELECT "id", "familyMemberId", "name", "category", "organization",
           "startDate"::text, "endDate"::text, "isCurrent", "schedule",
           "cost"::float8, "notes"
    FROM "Activity"
    WHERE "familyMemberId" = ${memberId} AND "householdId" = ${householdId}
    ORDER BY "isCurrent" DESC, "startDate" DESC NULLS LAST`

  const achievements = await sql<Array<AchievementRow>>`
    SELECT "id", "familyMemberId", "activityId", "title", "description",
           "dateEarned"::text, "issuer", "notes"
    FROM "Achievement"
    WHERE "familyMemberId" = ${memberId} AND "householdId" = ${householdId}
    ORDER BY "dateEarned" DESC NULLS LAST`

  const certifications = await sql<Array<CertificationRow>>`
    SELECT "id", "familyMemberId", "name", "issuingBody", "credentialId",
           "issueDate"::text, "expirationDate"::text, "status",
           "renewalCost"::float8, "url", "notes"
    FROM "Certification"
    WHERE "familyMemberId" = ${memberId} AND "householdId" = ${householdId}
    ORDER BY "status", "expirationDate" ASC NULLS LAST`

  return {
    member,
    entries,
    gradeReports,
    gradeItems,
    activities,
    achievements,
    certifications,
  }
}

// ─── Education entries ───────────────────────────────────────────────────────

export type EducationEntryInput = {
  familyMemberId: string
  institution: string
  degreeType: DegreeType | null
  fieldOfStudy: string | null
  startDate: string | null
  endDate: string | null
  graduationDate: string | null
  status: EducationStatus
  gpa: number | null
  isCurrent: boolean
  location: string | null
  notes: string | null
}

export async function createEducationEntry(input: EducationEntryInput) {
  await sql`
    INSERT INTO "EducationEntry"
      ("familyMemberId", "institution", "degreeType", "fieldOfStudy",
       "startDate", "endDate", "graduationDate", "status", "gpa",
       "isCurrent", "location", "notes")
    VALUES
      (${input.familyMemberId}, ${input.institution},
       ${input.degreeType}::"DegreeType", ${input.fieldOfStudy},
       ${input.startDate}, ${input.endDate}, ${input.graduationDate},
       ${input.status}::"EducationStatus", ${input.gpa},
       ${input.isCurrent}, ${input.location}, ${input.notes})`
}

// No householdId on "EducationEntry" — scope the DELETE itself by joining
// through the parent "FamilyMember" (PORTING.md invariant 2). Cascade removes
// grade reports and grade items.
export async function deleteEducationEntry(householdId: string, id: string) {
  await sql`
    DELETE FROM "EducationEntry" e
    USING "FamilyMember" fm
    WHERE e."id" = ${id}
      AND fm."id" = e."familyMemberId"
      AND fm."householdId" = ${householdId}`
}

// ─── Grade reports ───────────────────────────────────────────────────────────

export type GradeItemInput = {
  subject: string
  grade: string
  percentage: number | null
  credits: number | null
  teacher: string | null
  notes: string | null
}

export type GradeReportInput = {
  educationEntryId: string
  schoolYear: string
  term: GradeTerm
  reportDate: string | null
  overallGpa: number | null
  notes: string | null
  items: Array<GradeItemInput>
}

export async function educationEntryInHousehold(
  entryId: string,
  householdId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT e."id"
    FROM "EducationEntry" e
    JOIN "FamilyMember" fm ON fm."id" = e."familyMemberId"
    WHERE e."id" = ${entryId} AND fm."householdId" = ${householdId}`
  return rows.length > 0
}

export async function createGradeReport(input: GradeReportInput) {
  await sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO "GradeReport"
        ("educationEntryId", "schoolYear", "term", "reportDate",
         "overallGpa", "notes")
      VALUES
        (${input.educationEntryId}, ${input.schoolYear},
         ${input.term}::"GradeTerm", ${input.reportDate},
         ${input.overallGpa}, ${input.notes})
      RETURNING "id"`
    const reportId: string = rows[0].id
    for (const item of input.items) {
      await tx`
        INSERT INTO "GradeItem"
          ("gradeReportId", "subject", "grade", "percentage", "credits",
           "teacher", "notes")
        VALUES
          (${reportId}, ${item.subject}, ${item.grade}, ${item.percentage},
           ${item.credits}, ${item.teacher}, ${item.notes})`
    }
  })
}

// Scope through EducationEntry → FamilyMember; cascade removes grade items.
export async function deleteGradeReport(householdId: string, id: string) {
  await sql`
    DELETE FROM "GradeReport" r
    USING "EducationEntry" e, "FamilyMember" fm
    WHERE r."id" = ${id}
      AND e."id" = r."educationEntryId"
      AND fm."id" = e."familyMemberId"
      AND fm."householdId" = ${householdId}`
}

// ─── Grades page data ────────────────────────────────────────────────────────

export type EntryOptionRow = {
  memberId: string
  firstName: string
  lastName: string
  entryId: string
  institution: string
  degreeType: DegreeType | null
}

export type GradeReportWithMemberRow = GradeReportRow & {
  memberId: string
  firstName: string
  lastName: string
  institution: string
}

export async function getGradesPageData(householdId: string) {
  const entryOptions = await sql<Array<EntryOptionRow>>`
    SELECT fm."id" AS "memberId", fm."firstName", fm."lastName",
           e."id" AS "entryId", e."institution", e."degreeType"
    FROM "FamilyMember" fm
    JOIN "EducationEntry" e ON e."familyMemberId" = fm."id"
    WHERE fm."householdId" = ${householdId} AND fm."isActive"
    ORDER BY fm."firstName", fm."lastName",
             e."isCurrent" DESC, e."startDate" DESC NULLS LAST`

  const reports = await sql<Array<GradeReportWithMemberRow>>`
    SELECT r."id", r."educationEntryId", r."schoolYear", r."term",
           r."reportDate"::text, r."overallGpa"::float8, r."notes",
           fm."id" AS "memberId", fm."firstName", fm."lastName",
           e."institution"
    FROM "GradeReport" r
    JOIN "EducationEntry" e ON e."id" = r."educationEntryId"
    JOIN "FamilyMember" fm ON fm."id" = e."familyMemberId"
    WHERE fm."householdId" = ${householdId}
    ORDER BY r."schoolYear" DESC, r."createdAt" DESC`

  const items = await sql<Array<GradeItemRow>>`
    SELECT gi."id", gi."gradeReportId", gi."subject", gi."grade",
           gi."percentage"::float8, gi."credits"::float8, gi."teacher", gi."notes"
    FROM "GradeItem" gi
    JOIN "GradeReport" r ON r."id" = gi."gradeReportId"
    JOIN "EducationEntry" e ON e."id" = r."educationEntryId"
    JOIN "FamilyMember" fm ON fm."id" = e."familyMemberId"
    WHERE fm."householdId" = ${householdId}
    ORDER BY gi."subject"`

  return { entryOptions, reports, items }
}

// ─── Activities ──────────────────────────────────────────────────────────────

export type ActivityWithMemberRow = ActivityRow & {
  firstName: string
  lastName: string
}

export async function listActivities(
  householdId: string
): Promise<Array<ActivityWithMemberRow>> {
  return sql<Array<ActivityWithMemberRow>>`
    SELECT a."id", a."familyMemberId", a."name", a."category", a."organization",
           a."startDate"::text, a."endDate"::text, a."isCurrent", a."schedule",
           a."cost"::float8, a."notes",
           fm."firstName", fm."lastName"
    FROM "Activity" a
    JOIN "FamilyMember" fm ON fm."id" = a."familyMemberId"
    WHERE a."householdId" = ${householdId}
    ORDER BY a."isCurrent" DESC, a."startDate" DESC NULLS LAST`
}

export async function listAchievementsForActivities(
  householdId: string
): Promise<Array<AchievementRow>> {
  return sql<Array<AchievementRow>>`
    SELECT "id", "familyMemberId", "activityId", "title", "description",
           "dateEarned"::text, "issuer", "notes"
    FROM "Achievement"
    WHERE "householdId" = ${householdId} AND "activityId" IS NOT NULL
    ORDER BY "dateEarned" DESC NULLS LAST`
}

export type ActivityInput = {
  familyMemberId: string
  name: string
  category: ActivityCategory
  organization: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  schedule: string | null
  cost: number | null
  notes: string | null
}

export async function createActivity(
  householdId: string,
  input: ActivityInput
) {
  await sql`
    INSERT INTO "Activity"
      ("householdId", "familyMemberId", "name", "category", "organization",
       "startDate", "endDate", "isCurrent", "schedule", "cost", "notes")
    VALUES
      (${householdId}, ${input.familyMemberId}, ${input.name},
       ${input.category}::"ActivityCategory", ${input.organization},
       ${input.startDate}, ${input.endDate}, ${input.isCurrent},
       ${input.schedule}, ${input.cost}, ${input.notes})`
}

export async function deleteActivity(householdId: string, id: string) {
  await sql`
    DELETE FROM "Activity"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

// ─── Achievements ────────────────────────────────────────────────────────────

export type AchievementInput = {
  familyMemberId: string
  activityId: string | null
  title: string
  description: string | null
  dateEarned: string | null
  issuer: string | null
  notes: string | null
}

export async function activityInHousehold(
  activityId: string,
  householdId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Activity"
    WHERE "id" = ${activityId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export async function createAchievement(
  householdId: string,
  input: AchievementInput
) {
  await sql`
    INSERT INTO "Achievement"
      ("householdId", "familyMemberId", "activityId", "title", "description",
       "dateEarned", "issuer", "notes")
    VALUES
      (${householdId}, ${input.familyMemberId}, ${input.activityId},
       ${input.title}, ${input.description}, ${input.dateEarned},
       ${input.issuer}, ${input.notes})`
}

export async function deleteAchievement(householdId: string, id: string) {
  await sql`
    DELETE FROM "Achievement"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

// ─── Certifications ──────────────────────────────────────────────────────────

export type CertificationWithMemberRow = CertificationRow & {
  firstName: string
  lastName: string
}

export async function listCertifications(
  householdId: string
): Promise<Array<CertificationWithMemberRow>> {
  return sql<Array<CertificationWithMemberRow>>`
    SELECT c."id", c."familyMemberId", c."name", c."issuingBody",
           c."credentialId", c."issueDate"::text, c."expirationDate"::text,
           c."status", c."renewalCost"::float8, c."url", c."notes",
           fm."firstName", fm."lastName"
    FROM "Certification" c
    JOIN "FamilyMember" fm ON fm."id" = c."familyMemberId"
    WHERE c."householdId" = ${householdId}
    ORDER BY c."status", c."expirationDate" ASC NULLS LAST`
}

export type CertificationInput = {
  familyMemberId: string
  name: string
  issuingBody: string | null
  credentialId: string | null
  issueDate: string | null
  expirationDate: string | null
  status: CertificationStatus
  renewalCost: number | null
  url: string | null
  notes: string | null
}

export async function createCertification(
  householdId: string,
  input: CertificationInput
) {
  await sql`
    INSERT INTO "Certification"
      ("householdId", "familyMemberId", "name", "issuingBody", "credentialId",
       "issueDate", "expirationDate", "status", "renewalCost", "url", "notes")
    VALUES
      (${householdId}, ${input.familyMemberId}, ${input.name},
       ${input.issuingBody}, ${input.credentialId}, ${input.issueDate},
       ${input.expirationDate}, ${input.status}::"CertificationStatus",
       ${input.renewalCost}, ${input.url}, ${input.notes})`
}

export async function deleteCertification(householdId: string, id: string) {
  await sql`
    DELETE FROM "Certification"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}
