"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { SetType } from "@prisma/client";

export async function createWorkoutAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  // Verify familyMember belongs to household
  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  const title = formData.get("title") as string;
  const date = formData.get("date") as string;
  const startTime = formData.get("startTime") as string || "08:00";
  const endTime = formData.get("endTime") as string;
  const description = formData.get("description") as string || null;

  const workout = await prisma.workout.create({
    data: {
      familyMemberId,
      title,
      startTime: new Date(`${date}T${startTime}`),
      endTime: endTime ? new Date(`${date}T${endTime}`) : null,
      description,
    },
  });

  revalidatePath("/workouts");
  redirect(`/workouts/${workout.id}`);
}

export async function deleteWorkoutAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.workout.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.workout.delete({ where: { id } });
  revalidatePath("/workouts");
  redirect("/workouts");
}

export async function addExerciseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const workoutId = formData.get("workoutId") as string;
  const exerciseName = formData.get("exerciseName") as string;
  const notes = formData.get("notes") as string || null;

  // Verify workout belongs to household
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, familyMember: { householdId } },
  });
  if (!workout) return;

  const lastExercise = await prisma.workoutExercise.findFirst({
    where: { workoutId },
    orderBy: { orderIndex: "desc" },
  });

  await prisma.workoutExercise.create({
    data: {
      workoutId,
      exerciseName,
      orderIndex: (lastExercise?.orderIndex ?? -1) + 1,
      notes,
    },
  });

  revalidatePath(`/workouts/${workoutId}`);
}

export async function deleteExerciseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const exercise = await prisma.workoutExercise.findFirst({
    where: { id, workout: { familyMember: { householdId } } },
  });
  if (!exercise) return;

  await prisma.workoutExercise.delete({ where: { id } });
  revalidatePath(`/workouts/${exercise.workoutId}`);
}

export async function addSetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const workoutExerciseId = formData.get("workoutExerciseId") as string;
  const setType = formData.get("setType") as SetType || "NORMAL";
  const weightLbs = formData.get("weightLbs") ? parseFloat(formData.get("weightLbs") as string) : null;
  const reps = formData.get("reps") ? parseInt(formData.get("reps") as string) : null;
  const distanceMiles = formData.get("distanceMiles") ? parseFloat(formData.get("distanceMiles") as string) : null;
  const durationSeconds = formData.get("durationSeconds") ? parseInt(formData.get("durationSeconds") as string) : null;
  const rpe = formData.get("rpe") ? parseFloat(formData.get("rpe") as string) : null;

  // Verify exercise belongs to household
  const exercise = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId, workout: { familyMember: { householdId } } },
  });
  if (!exercise) return;

  const lastSet = await prisma.exerciseSet.findFirst({
    where: { workoutExerciseId },
    orderBy: { setIndex: "desc" },
  });

  await prisma.exerciseSet.create({
    data: {
      workoutExerciseId,
      setIndex: (lastSet?.setIndex ?? -1) + 1,
      setType,
      weightLbs,
      reps,
      distanceMiles,
      durationSeconds,
      rpe,
    },
  });

  revalidatePath(`/workouts/${exercise.workoutId}`);
}

export async function deleteSetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const set = await prisma.exerciseSet.findFirst({
    where: { id, workoutExercise: { workout: { familyMember: { householdId } } } },
    include: { workoutExercise: true },
  });
  if (!set) return;

  await prisma.exerciseSet.delete({ where: { id } });
  revalidatePath(`/workouts/${set.workoutExercise.workoutId}`);
}
