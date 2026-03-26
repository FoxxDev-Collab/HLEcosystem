"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import type { TripStatus } from "@prisma/client";

export async function createTripAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const name = formData.get("name") as string;
  const destination = (formData.get("destination") as string) || null;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const description = (formData.get("description") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!name || !startDate || !endDate) {
    return { error: "Name, start date, and end date are required" };
  }

  if (new Date(endDate) < new Date(startDate)) {
    return { error: "End date must be after start date" };
  }

  try {
    await prisma.trip.create({
      data: {
        householdId,
        name,
        destination,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description,
        notes,
      },
    });
    revalidatePath("/trips");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to create trip" };
  }
}

export async function updateTripAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const name = formData.get("name") as string;
  const destination = (formData.get("destination") as string) || null;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const description = (formData.get("description") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!tripId || !name || !startDate || !endDate) {
    return { error: "Missing required fields" };
  }

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  try {
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        name,
        destination,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description,
        notes,
      },
    });
    revalidatePath(`/trips/${tripId}`);
    revalidatePath("/trips");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to update trip" };
  }
}

export async function updateTripStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const status = formData.get("status") as TripStatus;

  if (!tripId || !status) return { error: "Missing required fields" };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  const validStatuses: TripStatus[] = ["PLANNING", "BOOKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  if (!validStatuses.includes(status)) return { error: "Invalid status" };

  try {
    await prisma.trip.update({
      where: { id: tripId },
      data: { status },
    });
    revalidatePath(`/trips/${tripId}`);
    revalidatePath("/trips");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to update trip status" };
  }
}

export async function deleteTripAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  if (!tripId) return { error: "Trip ID required" };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  try {
    await prisma.trip.delete({ where: { id: tripId } });
    revalidatePath("/trips");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to delete trip" };
  }
}

export async function addTravelerAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const householdMemberId = formData.get("householdMemberId") as string;
  const displayName = formData.get("displayName") as string;

  if (!tripId || !householdMemberId || !displayName) {
    return { error: "Missing required fields" };
  }

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  try {
    await prisma.traveler.create({
      data: { tripId, householdMemberId, displayName },
    });
    revalidatePath(`/trips/${tripId}`);
    return {};
  } catch {
    return { error: "Traveler already added or creation failed" };
  }
}

export async function removeTravelerAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const travelerId = formData.get("travelerId") as string;
  const tripId = formData.get("tripId") as string;
  if (!travelerId || !tripId) return { error: "Missing required fields" };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  try {
    await prisma.traveler.delete({ where: { id: travelerId } });
    revalidatePath(`/trips/${tripId}`);
    return {};
  } catch {
    return { error: "Failed to remove traveler" };
  }
}
