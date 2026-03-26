"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import type { ReservationType, ReservationStatus, Currency } from "@prisma/client";

export async function createReservationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const type = formData.get("type") as ReservationType;
  const providerName = formData.get("providerName") as string;
  const confirmationNumber = (formData.get("confirmationNumber") as string) || null;
  const startDateTime = formData.get("startDateTime") as string;
  const endDateTime = formData.get("endDateTime") as string;
  const location = (formData.get("location") as string) || null;
  const departureLocation = (formData.get("departureLocation") as string) || null;
  const arrivalLocation = (formData.get("arrivalLocation") as string) || null;
  const costStr = formData.get("cost") as string;
  const currency = (formData.get("currency") as Currency) || "USD";
  const isPaid = formData.get("isPaid") === "true";
  const bookingUrl = (formData.get("bookingUrl") as string) || null;
  const contactPhone = (formData.get("contactPhone") as string) || null;
  const contactEmail = (formData.get("contactEmail") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!tripId || !type || !providerName) {
    return { error: "Trip, type, and provider name are required" };
  }

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  try {
    await prisma.reservation.create({
      data: {
        tripId,
        type,
        providerName,
        confirmationNumber,
        startDateTime: startDateTime ? new Date(startDateTime) : null,
        endDateTime: endDateTime ? new Date(endDateTime) : null,
        location,
        departureLocation,
        arrivalLocation,
        cost: costStr ? parseFloat(costStr) : null,
        currency,
        isPaid,
        bookingUrl,
        contactPhone,
        contactEmail,
        notes,
      },
    });
    revalidatePath(`/trips/${tripId}`);
    return {};
  } catch {
    return { error: "Failed to create reservation" };
  }
}

export async function updateReservationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const reservationId = formData.get("reservationId") as string;
  const type = formData.get("type") as ReservationType;
  const status = formData.get("status") as ReservationStatus;
  const providerName = formData.get("providerName") as string;
  const confirmationNumber = (formData.get("confirmationNumber") as string) || null;
  const startDateTime = formData.get("startDateTime") as string;
  const endDateTime = formData.get("endDateTime") as string;
  const location = (formData.get("location") as string) || null;
  const departureLocation = (formData.get("departureLocation") as string) || null;
  const arrivalLocation = (formData.get("arrivalLocation") as string) || null;
  const costStr = formData.get("cost") as string;
  const currency = (formData.get("currency") as Currency) || "USD";
  const isPaid = formData.get("isPaid") === "true";
  const bookingUrl = (formData.get("bookingUrl") as string) || null;
  const contactPhone = (formData.get("contactPhone") as string) || null;
  const contactEmail = (formData.get("contactEmail") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!reservationId || !type || !providerName) {
    return { error: "Missing required fields" };
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!reservation || reservation.trip.householdId !== householdId) {
    return { error: "Reservation not found" };
  }

  try {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        type,
        status,
        providerName,
        confirmationNumber,
        startDateTime: startDateTime ? new Date(startDateTime) : null,
        endDateTime: endDateTime ? new Date(endDateTime) : null,
        location,
        departureLocation,
        arrivalLocation,
        cost: costStr ? parseFloat(costStr) : null,
        currency,
        isPaid,
        bookingUrl,
        contactPhone,
        contactEmail,
        notes,
      },
    });
    revalidatePath(`/trips/${reservation.tripId}`);
    return {};
  } catch {
    return { error: "Failed to update reservation" };
  }
}

export async function deleteReservationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const reservationId = formData.get("reservationId") as string;
  if (!reservationId) return { error: "Reservation ID required" };

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!reservation || reservation.trip.householdId !== householdId) {
    return { error: "Reservation not found" };
  }

  try {
    await prisma.reservation.delete({ where: { id: reservationId } });
    revalidatePath(`/trips/${reservation.tripId}`);
    return {};
  } catch {
    return { error: "Failed to delete reservation" };
  }
}
