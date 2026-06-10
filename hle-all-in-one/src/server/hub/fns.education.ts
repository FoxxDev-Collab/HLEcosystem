import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  activityInHousehold,
  createAchievement,
  createActivity,
  createCertification,
  createEducationEntry,
  createGradeReport,
  deleteAchievement,
  deleteActivity,
  deleteCertification,
  deleteEducationEntry,
  deleteGradeReport,
  educationEntryInHousehold,
  getEducationOverview,
  getGradesPageData,
  getMemberEducation,
  listActiveMembers,
  listActivities,
  listAchievementsForActivities,
  listCertifications,
  memberInHousehold,
} from "./education"

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalDate = dateStr.nullable()
const optionalText = z
  .string()
  .max(2000)
  .nullable()
  .transform((v) => (v && v.trim() ? v.trim() : null))

const degreeTypeEnum = z.enum([
  "HIGH_SCHOOL",
  "ASSOCIATE",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "CERTIFICATE",
  "DIPLOMA",
  "GED",
  "TRADE",
  "OTHER",
])
const educationStatusEnum = z.enum([
  "IN_PROGRESS",
  "COMPLETED",
  "WITHDRAWN",
  "TRANSFERRED",
])
const gradeTermEnum = z.enum([
  "QUARTER_1",
  "QUARTER_2",
  "QUARTER_3",
  "QUARTER_4",
  "SEMESTER_1",
  "SEMESTER_2",
  "TRIMESTER_1",
  "TRIMESTER_2",
  "TRIMESTER_3",
  "SUMMER",
  "FULL_YEAR",
])
const activityCategoryEnum = z.enum([
  "SPORTS",
  "ARTS",
  "MUSIC",
  "ACADEMIC",
  "VOLUNTEER",
  "CLUB",
  "RELIGIOUS",
  "OTHER",
])
const certificationStatusEnum = z.enum([
  "ACTIVE",
  "EXPIRED",
  "PENDING",
  "REVOKED",
])

// ─── Reads ───────────────────────────────────────────────────────────────────

export const getEducationOverviewFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => getEducationOverview(context.householdId))

export const getMemberEducationFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) =>
    getMemberEducation(context.householdId, data.memberId)
  )

export const getGradesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => getGradesPageData(context.householdId))

export const getActivitiesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => ({
    members: await listActiveMembers(context.householdId),
    activities: await listActivities(context.householdId),
    achievements: await listAchievementsForActivities(context.householdId),
  }))

export const getCertificationsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => ({
    members: await listActiveMembers(context.householdId),
    certifications: await listCertifications(context.householdId),
  }))

// ─── Education entries ───────────────────────────────────────────────────────

const educationEntrySchema = z.object({
  familyMemberId: z.string().uuid(),
  institution: z.string().min(1).max(200),
  degreeType: degreeTypeEnum.nullable(),
  fieldOfStudy: optionalText,
  startDate: optionalDate,
  endDate: optionalDate,
  graduationDate: optionalDate,
  status: educationStatusEnum,
  gpa: z.number().min(0).max(5).nullable(),
  isCurrent: z.boolean(),
  location: optionalText,
  notes: optionalText,
})

export const createEducationEntryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => educationEntrySchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await memberInHousehold(data.familyMemberId, context.householdId))) {
      return { error: "Family member not found in this household." }
    }
    await createEducationEntry(data)
    return { ok: true as const }
  })

export const deleteEducationEntryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteEducationEntry(context.householdId, data.id)
    return { ok: true as const }
  })

// ─── Grade reports ───────────────────────────────────────────────────────────

const gradeReportSchema = z.object({
  educationEntryId: z.string().uuid(),
  schoolYear: z.string().min(1).max(20),
  term: gradeTermEnum,
  reportDate: optionalDate,
  overallGpa: z.number().min(0).max(5).nullable(),
  notes: optionalText,
  items: z
    .array(
      z.object({
        subject: z.string().min(1).max(120),
        grade: z.string().min(1).max(20),
        percentage: z.number().min(0).max(100).nullable(),
        credits: z.number().min(0).nullable(),
        teacher: optionalText,
        notes: optionalText,
      })
    )
    .min(1),
})

export const createGradeReportFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => gradeReportSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (
      !(await educationEntryInHousehold(
        data.educationEntryId,
        context.householdId
      ))
    ) {
      return { error: "Education entry not found in this household." }
    }
    await createGradeReport(data)
    return { ok: true as const }
  })

export const deleteGradeReportFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteGradeReport(context.householdId, data.id)
    return { ok: true as const }
  })

// ─── Activities ──────────────────────────────────────────────────────────────

const activitySchema = z.object({
  familyMemberId: z.string().uuid(),
  name: z.string().min(1).max(200),
  category: activityCategoryEnum,
  organization: optionalText,
  startDate: optionalDate,
  endDate: optionalDate,
  isCurrent: z.boolean(),
  schedule: optionalText,
  cost: z.number().min(0).nullable(),
  notes: optionalText,
})

export const createActivityFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => activitySchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await memberInHousehold(data.familyMemberId, context.householdId))) {
      return { error: "Family member not found in this household." }
    }
    await createActivity(context.householdId, data)
    return { ok: true as const }
  })

export const deleteActivityFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteActivity(context.householdId, data.id)
    return { ok: true as const }
  })

// ─── Achievements ────────────────────────────────────────────────────────────

const achievementSchema = z.object({
  familyMemberId: z.string().uuid(),
  activityId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  description: optionalText,
  dateEarned: optionalDate,
  issuer: optionalText,
  notes: optionalText,
})

export const createAchievementFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => achievementSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await memberInHousehold(data.familyMemberId, context.householdId))) {
      return { error: "Family member not found in this household." }
    }
    if (
      data.activityId &&
      !(await activityInHousehold(data.activityId, context.householdId))
    ) {
      return { error: "Activity not found in this household." }
    }
    await createAchievement(context.householdId, data)
    return { ok: true as const }
  })

export const deleteAchievementFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteAchievement(context.householdId, data.id)
    return { ok: true as const }
  })

// ─── Certifications ──────────────────────────────────────────────────────────

const certificationSchema = z.object({
  familyMemberId: z.string().uuid(),
  name: z.string().min(1).max(200),
  issuingBody: optionalText,
  credentialId: optionalText,
  issueDate: optionalDate,
  expirationDate: optionalDate,
  status: certificationStatusEnum,
  renewalCost: z.number().min(0).nullable(),
  url: z.string().url().max(2000).nullable(),
  notes: optionalText,
})

export const createCertificationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => certificationSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await memberInHousehold(data.familyMemberId, context.householdId))) {
      return { error: "Family member not found in this household." }
    }
    await createCertification(context.householdId, data)
    return { ok: true as const }
  })

export const deleteCertificationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteCertification(context.householdId, data.id)
    return { ok: true as const }
  })
