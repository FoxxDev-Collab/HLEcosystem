"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";

export async function createTravelContactAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const name = formData.get("name") as string;
  const role = (formData.get("role") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const email = (formData.get("email") as string) || null;
  const address = (formData.get("address") as string) || null;
  const website = (formData.get("website") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!tripId || !name) return { error: "Trip and name are required" };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  const existingContacts = await prisma.travelContact.count({ where: { tripId } });

  try {
    await prisma.travelContact.create({
      data: {
        tripId,
        name,
        role,
        phone,
        email,
        address,
        website,
        notes,
        sortOrder: existingContacts,
      },
    });
    revalidatePath(`/trips/${tripId}`);
    return {};
  } catch {
    return { error: "Failed to create contact" };
  }
}

export async function updateTravelContactAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const contactId = formData.get("contactId") as string;
  const name = formData.get("name") as string;
  const role = (formData.get("role") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const email = (formData.get("email") as string) || null;
  const address = (formData.get("address") as string) || null;
  const website = (formData.get("website") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!contactId || !name) return { error: "Missing required fields" };

  const contact = await prisma.travelContact.findFirst({
    where: { id: contactId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!contact || contact.trip.householdId !== householdId) {
    return { error: "Contact not found" };
  }

  try {
    await prisma.travelContact.update({
      where: { id: contactId },
      data: { name, role, phone, email, address, website, notes },
    });
    revalidatePath(`/trips/${contact.tripId}`);
    return {};
  } catch {
    return { error: "Failed to update contact" };
  }
}

export async function deleteTravelContactAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const contactId = formData.get("contactId") as string;
  if (!contactId) return { error: "Contact ID required" };

  const contact = await prisma.travelContact.findFirst({
    where: { id: contactId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!contact || contact.trip.householdId !== householdId) {
    return { error: "Contact not found" };
  }

  try {
    await prisma.travelContact.delete({ where: { id: contactId } });
    revalidatePath(`/trips/${contact.tripId}`);
    return {};
  } catch {
    return { error: "Failed to delete contact" };
  }
}
