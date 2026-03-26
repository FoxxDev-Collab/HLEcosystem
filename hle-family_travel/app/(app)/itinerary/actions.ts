"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";

export async function createItineraryDayAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const date = formData.get("date") as string;
  const title = (formData.get("title") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!tripId || !date) return { error: "Trip and date are required" };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  const existingDays = await prisma.itineraryDay.count({ where: { tripId } });

  try {
    await prisma.itineraryDay.create({
      data: {
        tripId,
        date: new Date(date),
        title,
        notes,
        sortOrder: existingDays,
      },
    });
    revalidatePath(`/trips/${tripId}`);
    return {};
  } catch {
    return { error: "A day with this date already exists for this trip" };
  }
}

export async function updateItineraryDayAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const dayId = formData.get("dayId") as string;
  const title = (formData.get("title") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!dayId) return { error: "Day ID required" };

  const day = await prisma.itineraryDay.findFirst({
    where: { id: dayId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!day || day.trip.householdId !== householdId) return { error: "Day not found" };

  try {
    await prisma.itineraryDay.update({
      where: { id: dayId },
      data: { title, notes },
    });
    revalidatePath(`/trips/${day.tripId}`);
    return {};
  } catch {
    return { error: "Failed to update day" };
  }
}

export async function deleteItineraryDayAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const dayId = formData.get("dayId") as string;
  if (!dayId) return { error: "Day ID required" };

  const day = await prisma.itineraryDay.findFirst({
    where: { id: dayId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!day || day.trip.householdId !== householdId) return { error: "Day not found" };

  try {
    await prisma.itineraryDay.delete({ where: { id: dayId } });
    revalidatePath(`/trips/${day.tripId}`);
    return {};
  } catch {
    return { error: "Failed to delete day" };
  }
}

export async function createItineraryActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const itineraryDayId = formData.get("itineraryDayId") as string;
  const title = formData.get("title") as string;
  const startTime = (formData.get("startTime") as string) || null;
  const endTime = (formData.get("endTime") as string) || null;
  const location = (formData.get("location") as string) || null;
  const address = (formData.get("address") as string) || null;
  const bookingRef = (formData.get("bookingRef") as string) || null;
  const costStr = formData.get("cost") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!itineraryDayId || !title) return { error: "Day and title are required" };

  const day = await prisma.itineraryDay.findFirst({
    where: { id: itineraryDayId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!day || day.trip.householdId !== householdId) return { error: "Day not found" };

  const existingActivities = await prisma.itineraryActivity.count({ where: { itineraryDayId } });

  try {
    await prisma.itineraryActivity.create({
      data: {
        itineraryDayId,
        title,
        startTime,
        endTime,
        location,
        address,
        bookingRef,
        cost: costStr ? parseFloat(costStr) : null,
        notes,
        sortOrder: existingActivities,
      },
    });
    revalidatePath(`/trips/${day.tripId}`);
    return {};
  } catch {
    return { error: "Failed to create activity" };
  }
}

export async function updateItineraryActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const activityId = formData.get("activityId") as string;
  const title = formData.get("title") as string;
  const startTime = (formData.get("startTime") as string) || null;
  const endTime = (formData.get("endTime") as string) || null;
  const location = (formData.get("location") as string) || null;
  const address = (formData.get("address") as string) || null;
  const bookingRef = (formData.get("bookingRef") as string) || null;
  const costStr = formData.get("cost") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!activityId || !title) return { error: "Missing required fields" };

  const activity = await prisma.itineraryActivity.findFirst({
    where: { id: activityId },
    include: { itineraryDay: { include: { trip: { select: { householdId: true } } } } },
  });
  if (!activity || activity.itineraryDay.trip.householdId !== householdId) {
    return { error: "Activity not found" };
  }

  try {
    await prisma.itineraryActivity.update({
      where: { id: activityId },
      data: {
        title,
        startTime,
        endTime,
        location,
        address,
        bookingRef,
        cost: costStr ? parseFloat(costStr) : null,
        notes,
      },
    });
    revalidatePath(`/trips/${activity.itineraryDay.tripId}`);
    return {};
  } catch {
    return { error: "Failed to update activity" };
  }
}

export async function deleteItineraryActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const activityId = formData.get("activityId") as string;
  if (!activityId) return { error: "Activity ID required" };

  const activity = await prisma.itineraryActivity.findFirst({
    where: { id: activityId },
    include: { itineraryDay: { include: { trip: { select: { householdId: true } } } } },
  });
  if (!activity || activity.itineraryDay.trip.householdId !== householdId) {
    return { error: "Activity not found" };
  }

  try {
    await prisma.itineraryActivity.delete({ where: { id: activityId } });
    revalidatePath(`/trips/${activity.itineraryDay.tripId}`);
    return {};
  } catch {
    return { error: "Failed to delete activity" };
  }
}
