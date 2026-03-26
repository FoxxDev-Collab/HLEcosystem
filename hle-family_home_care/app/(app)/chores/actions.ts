"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ChoreFrequency, RotationMode } from "@prisma/client";

// ─── Helpers ────────────────────────────────────────────────

function getChoreOccurrencesForWeek(
  frequency: ChoreFrequency,
  customIntervalDays: number | null,
  weekStart: Date,
  weekEnd: Date
): Date[] {
  const dates: Date[] = [];
  switch (frequency) {
    case "DAILY":
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      break;
    case "WEEKLY":
    case "BI_WEEKLY":
    case "MONTHLY":
    case "CUSTOM_DAYS":
      // For non-daily frequencies, one occurrence at the start of the week
      dates.push(new Date(weekStart));
      break;
  }
  return dates;
}

// ─── Chore CRUD ─────────────────────────────────────────────

export async function createChoreAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const frequency = (formData.get("frequency") as ChoreFrequency) || "WEEKLY";
  const rotationMode = (formData.get("rotationMode") as RotationMode) || "NONE";
  const pointValue = formData.get("pointValue") ? parseInt(formData.get("pointValue") as string) : 0;
  const estimatedMinutes = formData.get("estimatedMinutes") ? parseInt(formData.get("estimatedMinutes") as string) : null;
  const customIntervalDays = formData.get("customIntervalDays") ? parseInt(formData.get("customIntervalDays") as string) : null;

  // Parse assignee IDs and names from the form
  const assigneeIds = formData.getAll("assigneeId") as string[];
  const assigneeNames = formData.getAll("assigneeName") as string[];

  await prisma.chore.create({
    data: {
      householdId,
      title,
      description: (formData.get("description") as string) || null,
      roomId: (formData.get("roomId") as string) || null,
      frequency,
      customIntervalDays,
      rotationMode,
      pointValue,
      estimatedMinutes,
      assignments: {
        create: assigneeIds.map((id, idx) => ({
          assigneeId: id,
          assigneeName: assigneeNames[idx] || "Unknown",
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath("/chores");
  revalidatePath("/chores/manage");
}

export async function updateChoreAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const frequency = (formData.get("frequency") as ChoreFrequency) || "WEEKLY";
  const rotationMode = (formData.get("rotationMode") as RotationMode) || "NONE";
  const pointValue = formData.get("pointValue") ? parseInt(formData.get("pointValue") as string) : 0;
  const estimatedMinutes = formData.get("estimatedMinutes") ? parseInt(formData.get("estimatedMinutes") as string) : null;
  const customIntervalDays = formData.get("customIntervalDays") ? parseInt(formData.get("customIntervalDays") as string) : null;

  await prisma.chore.update({
    where: { id, householdId },
    data: {
      title,
      description: (formData.get("description") as string) || null,
      roomId: (formData.get("roomId") as string) || null,
      frequency,
      customIntervalDays,
      rotationMode,
      pointValue,
      estimatedMinutes,
    },
  });

  revalidatePath("/chores");
  revalidatePath("/chores/manage");
}

export async function deleteChoreAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.chore.delete({
    where: { id, householdId },
  });

  revalidatePath("/chores");
  revalidatePath("/chores/manage");
}

export async function toggleChoreActiveAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const chore = await prisma.chore.findFirst({ where: { id, householdId } });
  if (!chore) return;

  await prisma.chore.update({
    where: { id, householdId },
    data: { isActive: !chore.isActive },
  });

  revalidatePath("/chores");
  revalidatePath("/chores/manage");
}

// ─── Chore Assignments ─────────────────────────────────────

export async function addChoreAssignmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const choreId = formData.get("choreId") as string;
  const assigneeId = formData.get("assigneeId") as string;
  const assigneeName = formData.get("assigneeName") as string;

  // Verify chore belongs to household
  const chore = await prisma.chore.findFirst({ where: { id: choreId, householdId } });
  if (!chore) return;

  // Get max sortOrder
  const maxOrder = await prisma.choreAssignment.aggregate({
    where: { choreId },
    _max: { sortOrder: true },
  });

  await prisma.choreAssignment.create({
    data: {
      choreId,
      assigneeId,
      assigneeName,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/chores");
  revalidatePath("/chores/manage");
}

export async function removeChoreAssignmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  // Verify the assignment's chore belongs to household
  const assignment = await prisma.choreAssignment.findUnique({
    where: { id },
    include: { chore: { select: { householdId: true } } },
  });
  if (!assignment || assignment.chore.householdId !== householdId) return;

  await prisma.choreAssignment.delete({ where: { id } });

  revalidatePath("/chores");
  revalidatePath("/chores/manage");
}

// ─── Chore Completions ──────────────────────────────────────

export async function completeChoreAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const completionId = formData.get("completionId") as string;
  const notes = (formData.get("notes") as string) || null;

  const completion = await prisma.choreCompletion.findFirst({
    where: { id: completionId, householdId },
    include: {
      chore: {
        include: {
          assignments: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!completion) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.choreCompletion.update({
    where: { id: completionId },
    data: {
      status: "COMPLETED",
      completedDate: today,
      pointsEarned: completion.chore.pointValue,
      notes,
    },
  });

  // If rotation mode is not NONE, determine next assignee for future completions
  if (completion.chore.rotationMode !== "NONE" && completion.chore.assignments.length > 1) {
    const currentAssigneeIndex = completion.chore.assignments.findIndex(
      (a) => a.assigneeId === completion.completedById
    );
    if (currentAssigneeIndex >= 0) {
      const nextIndex = (currentAssigneeIndex + 1) % completion.chore.assignments.length;
      const nextAssignee = completion.chore.assignments[nextIndex];

      // Update future PENDING completions for this chore to the next assignee
      await prisma.choreCompletion.updateMany({
        where: {
          choreId: completion.choreId,
          householdId,
          status: "PENDING",
          dueDate: { gt: completion.dueDate },
        },
        data: {
          completedById: nextAssignee.assigneeId,
          completedByName: nextAssignee.assigneeName,
        },
      });
    }
  }

  revalidatePath("/chores");
}

export async function skipChoreAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const completionId = formData.get("completionId") as string;
  const notes = (formData.get("notes") as string) || null;

  const completion = await prisma.choreCompletion.findFirst({
    where: { id: completionId, householdId },
  });
  if (!completion) return;

  await prisma.choreCompletion.update({
    where: { id: completionId },
    data: {
      status: "SKIPPED",
      notes,
    },
  });

  revalidatePath("/chores");
}

export async function generateWeekChoresAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const weekStartStr = formData.get("weekStart") as string;
  const weekStart = new Date(weekStartStr);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const activeChores = await prisma.chore.findMany({
    where: { householdId, isActive: true },
    include: {
      assignments: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  for (const chore of activeChores) {
    const occurrences = getChoreOccurrencesForWeek(
      chore.frequency,
      chore.customIntervalDays,
      weekStart,
      weekEnd
    );

    for (const dueDate of occurrences) {
      // Check if completion already exists for this chore + date
      const existing = await prisma.choreCompletion.findFirst({
        where: {
          choreId: chore.id,
          householdId,
          dueDate,
        },
      });
      if (existing) continue;

      // Determine assignee: use first assignment or the rotation logic
      let assigneeId = "unassigned";
      let assigneeName = "Unassigned";

      if (chore.assignments.length > 0) {
        if (chore.rotationMode === "NONE" || chore.rotationMode === "ROUND_ROBIN") {
          // For round robin, figure out which assignee is next based on existing completions count
          if (chore.rotationMode === "ROUND_ROBIN" && chore.assignments.length > 1) {
            const completionCount = await prisma.choreCompletion.count({
              where: { choreId: chore.id, householdId },
            });
            const idx = completionCount % chore.assignments.length;
            assigneeId = chore.assignments[idx].assigneeId;
            assigneeName = chore.assignments[idx].assigneeName;
          } else {
            assigneeId = chore.assignments[0].assigneeId;
            assigneeName = chore.assignments[0].assigneeName;
          }
        } else if (chore.rotationMode === "WEEKLY_ROTATION") {
          // Rotate by week number
          const startOfYear = new Date(dueDate.getFullYear(), 0, 1);
          const weekNum = Math.floor(
            (dueDate.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );
          const idx = weekNum % chore.assignments.length;
          assigneeId = chore.assignments[idx].assigneeId;
          assigneeName = chore.assignments[idx].assigneeName;
        }
      }

      await prisma.choreCompletion.create({
        data: {
          householdId,
          choreId: chore.id,
          completedById: assigneeId,
          completedByName: assigneeName,
          dueDate,
          status: "PENDING",
        },
      });
    }
  }

  revalidatePath("/chores");
}

// ─── Rewards ────────────────────────────────────────────────

export async function createRewardAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const pointCost = parseInt(formData.get("pointCost") as string);
  if (isNaN(pointCost) || pointCost <= 0) return;

  await prisma.choreReward.create({
    data: {
      householdId,
      title,
      description: (formData.get("description") as string) || null,
      pointCost,
    },
  });

  revalidatePath("/chores/rewards");
}

export async function updateRewardAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const pointCost = parseInt(formData.get("pointCost") as string);
  if (isNaN(pointCost) || pointCost <= 0) return;

  await prisma.choreReward.update({
    where: { id, householdId },
    data: {
      title,
      description: (formData.get("description") as string) || null,
      pointCost,
      isActive: formData.get("isActive") !== "false",
    },
  });

  revalidatePath("/chores/rewards");
}

export async function deleteRewardAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.choreReward.delete({
    where: { id, householdId },
  });

  revalidatePath("/chores/rewards");
}

export async function redeemRewardAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const rewardId = formData.get("rewardId") as string;
  const redeemedById = formData.get("redeemedById") as string;
  const redeemedByName = formData.get("redeemedByName") as string;

  const reward = await prisma.choreReward.findFirst({
    where: { id: rewardId, householdId, isActive: true },
  });
  if (!reward) return { error: "Reward not found" };

  // Calculate point balance
  const earnedResult = await prisma.choreCompletion.aggregate({
    where: {
      householdId,
      completedById: redeemedById,
      status: "COMPLETED",
    },
    _sum: { pointsEarned: true },
  });
  const earned = earnedResult._sum.pointsEarned ?? 0;

  const spentResult = await prisma.rewardRedemption.aggregate({
    where: {
      householdId,
      redeemedById,
    },
    _sum: { pointsSpent: true },
  });
  const spent = spentResult._sum.pointsSpent ?? 0;

  const balance = earned - spent;

  if (balance < reward.pointCost) {
    return { error: `Not enough points. Balance: ${balance}, Cost: ${reward.pointCost}` };
  }

  await prisma.rewardRedemption.create({
    data: {
      householdId,
      rewardId,
      redeemedById,
      redeemedByName,
      pointsSpent: reward.pointCost,
    },
  });

  revalidatePath("/chores/rewards");
  revalidatePath("/chores");
  return {};
}
