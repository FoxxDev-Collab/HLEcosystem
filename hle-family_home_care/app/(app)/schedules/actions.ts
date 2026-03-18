"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { MaintenanceFrequency } from "@prisma/client";

function computeNextDueDate(fromDate: Date, frequency: MaintenanceFrequency, customDays?: number | null): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case "WEEKLY": next.setDate(next.getDate() + 7); break;
    case "BI_WEEKLY": next.setDate(next.getDate() + 14); break;
    case "MONTHLY": next.setMonth(next.getMonth() + 1); break;
    case "QUARTERLY": next.setMonth(next.getMonth() + 3); break;
    case "SEMI_ANNUALLY": next.setMonth(next.getMonth() + 6); break;
    case "ANNUALLY": next.setFullYear(next.getFullYear() + 1); break;
    case "CUSTOM_DAYS": next.setDate(next.getDate() + (customDays ?? 30)); break;
  }
  return next;
}

export async function createScheduleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const title = (formData.get("title") as string).trim();
  if (!title) return;

  const frequency = (formData.get("frequency") as MaintenanceFrequency) || "MONTHLY";
  const customIntervalDays = formData.get("customIntervalDays") ? parseInt(formData.get("customIntervalDays") as string) : null;

  await prisma.maintenanceSchedule.create({
    data: {
      householdId,
      title,
      description: (formData.get("description") as string) || null,
      itemId: (formData.get("itemId") as string) || null,
      vehicleId: (formData.get("vehicleId") as string) || null,
      frequency,
      customIntervalDays,
      nextDueDate: formData.get("nextDueDate") ? new Date(formData.get("nextDueDate") as string) : null,
      estimatedCost: formData.get("estimatedCost") ? parseFloat(formData.get("estimatedCost") as string) : null,
      assignedTo: (formData.get("assignedTo") as string) || null,
    },
  });

  revalidatePath("/schedules");
  revalidatePath("/dashboard");
}

export async function updateScheduleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const frequency = (formData.get("frequency") as MaintenanceFrequency) || "MONTHLY";

  await prisma.maintenanceSchedule.update({
    where: { id, householdId },
    data: {
      title: (formData.get("title") as string).trim(),
      description: (formData.get("description") as string) || null,
      itemId: (formData.get("itemId") as string) || null,
      vehicleId: (formData.get("vehicleId") as string) || null,
      frequency,
      customIntervalDays: formData.get("customIntervalDays") ? parseInt(formData.get("customIntervalDays") as string) : null,
      nextDueDate: formData.get("nextDueDate") ? new Date(formData.get("nextDueDate") as string) : null,
      estimatedCost: formData.get("estimatedCost") ? parseFloat(formData.get("estimatedCost") as string) : null,
      assignedTo: (formData.get("assignedTo") as string) || null,
      isActive: formData.get("isActive") !== "false",
    },
  });

  revalidatePath("/schedules");
  revalidatePath("/dashboard");
}

export async function completeScheduleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const scheduleId = formData.get("scheduleId") as string;
  const completedDate = new Date(formData.get("completedDate") as string || new Date().toISOString().split("T")[0]);
  const completedBy = (formData.get("completedBy") as string) || null;
  const cost = formData.get("cost") ? parseFloat(formData.get("cost") as string) : null;
  const notes = (formData.get("notes") as string) || null;
  const mileageAtService = formData.get("mileageAtService") ? parseInt(formData.get("mileageAtService") as string) : null;

  const schedule = await prisma.maintenanceSchedule.findFirst({
    where: { id: scheduleId, householdId },
  });
  if (!schedule) return;

  // Create the maintenance log entry
  await prisma.maintenanceLog.create({
    data: {
      householdId,
      maintenanceScheduleId: scheduleId,
      itemId: schedule.itemId,
      vehicleId: schedule.vehicleId,
      title: schedule.title,
      completedDate,
      completedBy,
      status: "COMPLETED",
      cost,
      mileageAtService,
      notes,
    },
  });

  // Advance the schedule
  const nextDueDate = computeNextDueDate(completedDate, schedule.frequency, schedule.customIntervalDays);

  await prisma.maintenanceSchedule.update({
    where: { id: scheduleId },
    data: {
      lastCompletedDate: completedDate,
      nextDueDate,
    },
  });

  // If vehicle maintenance, update mileage
  if (schedule.vehicleId && mileageAtService) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: schedule.vehicleId } });
    if (vehicle && (!vehicle.currentMileage || mileageAtService > vehicle.currentMileage)) {
      await prisma.vehicle.update({
        where: { id: schedule.vehicleId },
        data: { currentMileage: mileageAtService, mileageAsOf: completedDate },
      });
    }
  }

  revalidatePath("/schedules");
  revalidatePath("/maintenance-log");
  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.maintenanceSchedule.delete({
    where: { id, householdId },
  });

  revalidatePath("/schedules");
  revalidatePath("/dashboard");
}
