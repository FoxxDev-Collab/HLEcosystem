"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { AppointmentType, AppointmentStatus } from "@prisma/client";

export async function createAppointmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const familyMemberId = formData.get("familyMemberId") as string;
  const providerId = formData.get("providerId") as string || null;
  const date = formData.get("date") as string;
  const time = formData.get("time") as string || "09:00";
  const durationMinutes = parseInt(formData.get("durationMinutes") as string || "30");
  const appointmentType = formData.get("appointmentType") as AppointmentType;
  const location = formData.get("location") as string || null;
  const reasonForVisit = formData.get("reasonForVisit") as string || null;

  const appointmentDateTime = new Date(`${date}T${time}`);

  await prisma.appointment.create({
    data: {
      familyMemberId,
      providerId: providerId || null,
      appointmentDateTime,
      durationMinutes,
      appointmentType,
      location,
      reasonForVisit,
    },
  });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function updateAppointmentStatusAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const status = formData.get("status") as AppointmentStatus;

  await prisma.appointment.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function deleteAppointmentAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
