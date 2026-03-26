"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type {
  DegreeType,
  EducationStatus,
  GradeTerm,
  ActivityCategory,
  CertificationStatus,
} from "@prisma/client";

// ─── Education Entry Actions ────────────────────────────

export async function addEducationEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const familyMemberId = formData.get("familyMemberId") as string;
  const institution = formData.get("institution") as string;
  if (!familyMemberId || !institution) return;

  // Verify member belongs to household
  const member = await prisma.familyMember.findFirst({
    where: { id: familyMemberId, householdId },
  });
  if (!member) return;

  const isCurrent = formData.get("isCurrent") === "on";

  await prisma.educationEntry.create({
    data: {
      familyMemberId,
      institution,
      degreeType: (formData.get("degreeType") as DegreeType) || null,
      fieldOfStudy: (formData.get("fieldOfStudy") as string) || null,
      startDate: formData.get("startDate")
        ? new Date(formData.get("startDate") as string)
        : null,
      endDate: formData.get("endDate")
        ? new Date(formData.get("endDate") as string)
        : null,
      graduationDate: formData.get("graduationDate")
        ? new Date(formData.get("graduationDate") as string)
        : null,
      status: (formData.get("status") as EducationStatus) || "IN_PROGRESS",
      gpa: formData.get("gpa")
        ? parseFloat(formData.get("gpa") as string)
        : null,
      isCurrent,
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/education");
  revalidatePath(`/education/${familyMemberId}`);
}

export async function updateEducationEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  if (!id || !familyMemberId) return;

  // Verify member belongs to household
  const member = await prisma.familyMember.findFirst({
    where: { id: familyMemberId, householdId },
  });
  if (!member) return;

  const isCurrent = formData.get("isCurrent") === "on";

  await prisma.educationEntry.update({
    where: { id },
    data: {
      institution: (formData.get("institution") as string) || undefined,
      degreeType: (formData.get("degreeType") as DegreeType) || null,
      fieldOfStudy: (formData.get("fieldOfStudy") as string) || null,
      startDate: formData.get("startDate")
        ? new Date(formData.get("startDate") as string)
        : null,
      endDate: formData.get("endDate")
        ? new Date(formData.get("endDate") as string)
        : null,
      graduationDate: formData.get("graduationDate")
        ? new Date(formData.get("graduationDate") as string)
        : null,
      status: (formData.get("status") as EducationStatus) || "IN_PROGRESS",
      gpa: formData.get("gpa")
        ? parseFloat(formData.get("gpa") as string)
        : null,
      isCurrent,
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/education");
  revalidatePath(`/education/${familyMemberId}`);
}

export async function deleteEducationEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  if (!id) return;

  // Verify member belongs to household
  const member = await prisma.familyMember.findFirst({
    where: { id: familyMemberId, householdId },
  });
  if (!member) return;

  // Cascade deletes grade reports and grade items
  await prisma.educationEntry.delete({ where: { id } });

  revalidatePath("/education");
  revalidatePath(`/education/${familyMemberId}`);
}

// ─── Grade Report Actions ───────────────────────────────

export async function addGradeReportAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const educationEntryId = formData.get("educationEntryId") as string;
  const schoolYear = formData.get("schoolYear") as string;
  const term = formData.get("term") as GradeTerm;
  if (!educationEntryId || !schoolYear || !term)
    return;

  // Verify education entry belongs to a member in this household
  const entry = await prisma.educationEntry.findFirst({
    where: { id: educationEntryId },
    include: { familyMember: { select: { householdId: true } } },
  });
  if (!entry || entry.familyMember.householdId !== householdId)
    return;

  // Parse dynamic grade items from form
  const gradeItems: {
    subject: string;
    grade: string;
    percentage: number | null;
    credits: number | null;
    teacher: string | null;
    notes: string | null;
  }[] = [];

  for (let i = 0; ; i++) {
    const subject = formData.get(`subject_${i}`) as string | null;
    if (!subject) break;
    const grade = formData.get(`grade_${i}`) as string;
    if (!grade) continue;

    const percentageStr = formData.get(`percentage_${i}`) as string;
    const creditsStr = formData.get(`credits_${i}`) as string;

    gradeItems.push({
      subject,
      grade,
      percentage: percentageStr ? parseFloat(percentageStr) : null,
      credits: creditsStr ? parseFloat(creditsStr) : null,
      teacher: (formData.get(`teacher_${i}`) as string) || null,
      notes: (formData.get(`notes_${i}`) as string) || null,
    });
  }

  if (gradeItems.length === 0)
    return;

  // Create grade report with items in a transaction
  await prisma.$transaction(async (tx) => {
    const report = await tx.gradeReport.create({
      data: {
        educationEntryId,
        schoolYear,
        term,
        reportDate: formData.get("reportDate")
          ? new Date(formData.get("reportDate") as string)
          : null,
        overallGpa: formData.get("overallGpa")
          ? parseFloat(formData.get("overallGpa") as string)
          : null,
        notes: (formData.get("reportNotes") as string) || null,
      },
    });

    await tx.gradeItem.createMany({
      data: gradeItems.map((item) => ({
        gradeReportId: report.id,
        ...item,
      })),
    });
  });

  const memberId = formData.get("familyMemberId") as string;
  revalidatePath("/education");
  revalidatePath("/education/grades");
  if (memberId) revalidatePath(`/education/${memberId}`);
}

export async function deleteGradeReportAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  if (!id) return;

  // Verify the grade report belongs to a member in this household
  const report = await prisma.gradeReport.findFirst({
    where: { id },
    include: {
      educationEntry: {
        include: { familyMember: { select: { householdId: true, id: true } } },
      },
    },
  });
  if (!report || report.educationEntry.familyMember.householdId !== householdId)
    return;

  await prisma.gradeReport.delete({ where: { id } });

  revalidatePath("/education");
  revalidatePath("/education/grades");
  revalidatePath(`/education/${report.educationEntry.familyMember.id}`);
}

// ─── Activity Actions ───────────────────────────────────

export async function addActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const familyMemberId = formData.get("familyMemberId") as string;
  const name = formData.get("name") as string;
  if (!familyMemberId || !name) return;

  const member = await prisma.familyMember.findFirst({
    where: { id: familyMemberId, householdId },
  });
  if (!member) return;

  const isCurrent = formData.get("isCurrent") === "on";

  await prisma.activity.create({
    data: {
      householdId,
      familyMemberId,
      name,
      category: (formData.get("category") as ActivityCategory) || "OTHER",
      organization: (formData.get("organization") as string) || null,
      startDate: formData.get("startDate")
        ? new Date(formData.get("startDate") as string)
        : null,
      endDate: formData.get("endDate")
        ? new Date(formData.get("endDate") as string)
        : null,
      isCurrent,
      schedule: (formData.get("schedule") as string) || null,
      cost: formData.get("cost")
        ? parseFloat(formData.get("cost") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/education");
  revalidatePath("/education/activities");
  revalidatePath(`/education/${familyMemberId}`);
}

export async function updateActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  if (!id) return;

  // Verify activity belongs to household
  const existing = await prisma.activity.findFirst({
    where: { id, householdId },
  });
  if (!existing) return;

  const isCurrent = formData.get("isCurrent") === "on";

  await prisma.activity.update({
    where: { id },
    data: {
      name: (formData.get("name") as string) || undefined,
      category: (formData.get("category") as ActivityCategory) || "OTHER",
      organization: (formData.get("organization") as string) || null,
      startDate: formData.get("startDate")
        ? new Date(formData.get("startDate") as string)
        : null,
      endDate: formData.get("endDate")
        ? new Date(formData.get("endDate") as string)
        : null,
      isCurrent,
      schedule: (formData.get("schedule") as string) || null,
      cost: formData.get("cost")
        ? parseFloat(formData.get("cost") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/education");
  revalidatePath("/education/activities");
  if (familyMemberId) revalidatePath(`/education/${familyMemberId}`);
}

export async function deleteActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  if (!id) return;

  const existing = await prisma.activity.findFirst({
    where: { id, householdId },
  });
  if (!existing) return;

  await prisma.activity.delete({ where: { id } });

  revalidatePath("/education");
  revalidatePath("/education/activities");
  if (familyMemberId) revalidatePath(`/education/${familyMemberId}`);
}

// ─── Achievement Actions ────────────────────────────────

export async function addAchievementAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const familyMemberId = formData.get("familyMemberId") as string;
  const title = formData.get("title") as string;
  if (!familyMemberId || !title) return;

  const member = await prisma.familyMember.findFirst({
    where: { id: familyMemberId, householdId },
  });
  if (!member) return;

  await prisma.achievement.create({
    data: {
      householdId,
      familyMemberId,
      activityId: (formData.get("activityId") as string) || null,
      title,
      description: (formData.get("description") as string) || null,
      dateEarned: formData.get("dateEarned")
        ? new Date(formData.get("dateEarned") as string)
        : null,
      issuer: (formData.get("issuer") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/education");
  revalidatePath(`/education/${familyMemberId}`);
}

export async function deleteAchievementAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  if (!id) return;

  const existing = await prisma.achievement.findFirst({
    where: { id, householdId },
  });
  if (!existing) return;

  await prisma.achievement.delete({ where: { id } });

  revalidatePath("/education");
  if (familyMemberId) revalidatePath(`/education/${familyMemberId}`);
}

// ─── Certification Actions ──────────────────────────────

export async function addCertificationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const familyMemberId = formData.get("familyMemberId") as string;
  const name = formData.get("name") as string;
  if (!familyMemberId || !name) return;

  const member = await prisma.familyMember.findFirst({
    where: { id: familyMemberId, householdId },
  });
  if (!member) return;

  await prisma.certification.create({
    data: {
      householdId,
      familyMemberId,
      name,
      issuingBody: (formData.get("issuingBody") as string) || null,
      credentialId: (formData.get("credentialId") as string) || null,
      issueDate: formData.get("issueDate")
        ? new Date(formData.get("issueDate") as string)
        : null,
      expirationDate: formData.get("expirationDate")
        ? new Date(formData.get("expirationDate") as string)
        : null,
      status: (formData.get("status") as CertificationStatus) || "ACTIVE",
      renewalCost: formData.get("renewalCost")
        ? parseFloat(formData.get("renewalCost") as string)
        : null,
      url: (formData.get("url") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/education");
  revalidatePath("/education/certifications");
  revalidatePath(`/education/${familyMemberId}`);
}

export async function updateCertificationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  if (!id) return;

  const existing = await prisma.certification.findFirst({
    where: { id, householdId },
  });
  if (!existing) return;

  await prisma.certification.update({
    where: { id },
    data: {
      name: (formData.get("name") as string) || undefined,
      issuingBody: (formData.get("issuingBody") as string) || null,
      credentialId: (formData.get("credentialId") as string) || null,
      issueDate: formData.get("issueDate")
        ? new Date(formData.get("issueDate") as string)
        : null,
      expirationDate: formData.get("expirationDate")
        ? new Date(formData.get("expirationDate") as string)
        : null,
      status: (formData.get("status") as CertificationStatus) || "ACTIVE",
      renewalCost: formData.get("renewalCost")
        ? parseFloat(formData.get("renewalCost") as string)
        : null,
      url: (formData.get("url") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/education");
  revalidatePath("/education/certifications");
  if (familyMemberId) revalidatePath(`/education/${familyMemberId}`);
}

export async function deleteCertificationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  if (!id) return;

  const existing = await prisma.certification.findFirst({
    where: { id, householdId },
  });
  if (!existing) return;

  await prisma.certification.delete({ where: { id } });

  revalidatePath("/education");
  revalidatePath("/education/certifications");
  if (familyMemberId) revalidatePath(`/education/${familyMemberId}`);
}
