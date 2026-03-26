"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { PetAppointmentType, PetAppointmentStatus } from "@prisma/client";

export async function createPetAppointmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const petId = formData.get("petId") as string;
  const pet = await prisma.pet.findFirst({ where: { id: petId, householdId } });
  if (!pet) return;

  const appointmentDateTime = formData.get("appointmentDateTime") as string;
  if (!appointmentDateTime) return;

  await prisma.petAppointment.create({
    data: {
      petId,
      providerId: (formData.get("providerId") as string) || null,
      appointmentDateTime: new Date(appointmentDateTime),
      durationMinutes: formData.get("durationMinutes") ? parseInt(formData.get("durationMinutes") as string) : 30,
      appointmentType: (formData.get("appointmentType") as PetAppointmentType) || "OTHER",
      location: (formData.get("location") as string) || null,
      reasonForVisit: (formData.get("reasonForVisit") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets");
}

export async function updatePetAppointmentStatusAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const status = formData.get("status") as PetAppointmentStatus;

  const record = await prisma.petAppointment.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  const data: Record<string, unknown> = { status };

  // If completing, capture optional diagnosis/treatment/cost
  if (status === "COMPLETED") {
    const diagnosis = formData.get("diagnosis") as string;
    const treatmentNotes = formData.get("treatmentNotes") as string;
    const cost = formData.get("cost") as string;
    if (diagnosis) data.diagnosis = diagnosis;
    if (treatmentNotes) data.treatmentNotes = treatmentNotes;
    if (cost) data.cost = parseFloat(cost);
  }

  await prisma.petAppointment.update({ where: { id }, data });

  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}

export async function deletePetAppointmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petAppointment.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petAppointment.delete({ where: { id } });
  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}
