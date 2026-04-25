"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { BudgetPlannerProjectStatus } from "@prisma/client";

export async function createProjectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const description = formData.get("description") as string || null;
  const targetDate = formData.get("targetDate") as string;
  const color = formData.get("color") as string || "#6366f1";

  const project = await prisma.budgetPlannerProject.create({
    data: {
      householdId,
      name,
      description,
      targetDate: targetDate ? new Date(targetDate) : null,
      color,
    },
  });

  revalidatePath("/budget-planner");
  redirect(`/budget-planner/${project.id}`);
}

export async function updateProjectStatusAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const status = formData.get("status") as BudgetPlannerProjectStatus;

  await prisma.budgetPlannerProject.update({
    where: { id, householdId },
    data: { status },
  });

  revalidatePath("/budget-planner");
}

export async function addItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string || "1");
  const unitCost = parseFloat(formData.get("unitCost") as string);
  const referenceUrl = formData.get("referenceUrl") as string || null;

  const project = await prisma.budgetPlannerProject.findFirst({
    where: { id: projectId, householdId },
  });
  if (!project) return;

  const lineTotal = quantity * unitCost;

  await prisma.budgetPlannerItem.create({
    data: { projectId, name, quantity, unitCost, lineTotal, referenceUrl },
  });

  // Recalculate project total
  const items = await prisma.budgetPlannerItem.findMany({ where: { projectId } });
  const totalCost = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
  await prisma.budgetPlannerProject.update({
    where: { id: projectId },
    data: { totalCost },
  });

  revalidatePath(`/budget-planner/${projectId}`);
  revalidatePath("/budget-planner");
}

export async function toggleItemPurchasedAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const isPurchased = formData.get("isPurchased") === "true";

  const existing = await prisma.budgetPlannerItem.findFirst({
    where: { id, project: { householdId } },
  });
  if (!existing) return;

  const item = await prisma.budgetPlannerItem.update({
    where: { id },
    data: { isPurchased: !isPurchased },
  });

  revalidatePath(`/budget-planner/${item.projectId}`);
}

export async function duplicateProjectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const sourceId = formData.get("id") as string;
  const source = await prisma.budgetPlannerProject.findFirst({
    where: { id: sourceId, householdId },
    include: { items: true },
  });
  if (!source) return;

  const newProject = await prisma.budgetPlannerProject.create({
    data: {
      householdId,
      name: `${source.name} (Copy)`,
      description: source.description,
      color: source.color,
      totalCost: source.totalCost,
      status: "PLANNING",
    },
  });

  await prisma.budgetPlannerItem.createMany({
    data: source.items.map((item) => ({
      projectId: newProject.id,
      name: item.name,
      quantity: item.quantity,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
      referenceUrl: item.referenceUrl,
      description: item.description,
      sortOrder: item.sortOrder,
    })),
  });

  revalidatePath("/budget-planner");
  redirect(`/budget-planner/${newProject.id}`);
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const existing = await prisma.budgetPlannerItem.findFirst({
    where: { id, project: { householdId } },
  });
  if (!existing) return;

  const item = await prisma.budgetPlannerItem.delete({ where: { id } });

  // Recalculate
  const items = await prisma.budgetPlannerItem.findMany({ where: { projectId: item.projectId } });
  const totalCost = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
  await prisma.budgetPlannerProject.update({
    where: { id: item.projectId },
    data: { totalCost },
  });

  revalidatePath(`/budget-planner/${item.projectId}`);
  revalidatePath("/budget-planner");
}

export async function updateProjectAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const targetDate = formData.get("targetDate") as string;
  const color = (formData.get("color") as string) || "#6366f1";

  const existing = await prisma.budgetPlannerProject.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return { error: "Project not found" };
  }

  await prisma.budgetPlannerProject.update({
    where: { id },
    data: {
      name,
      description,
      targetDate: targetDate ? new Date(targetDate) : null,
      color,
    },
  });

  revalidatePath(`/budget-planner/${id}`);
  revalidatePath("/budget-planner");
  return {};
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const existing = await prisma.budgetPlannerProject.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) return;

  // Items cascade-delete via Prisma schema
  await prisma.budgetPlannerItem.deleteMany({ where: { projectId: id } });
  await prisma.budgetPlannerProject.delete({ where: { id } });

  revalidatePath("/budget-planner");
  redirect("/budget-planner");
}

export async function updateItemAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string || "1");
  const unitCost = parseFloat(formData.get("unitCost") as string);
  const referenceUrl = (formData.get("referenceUrl") as string) || null;
  const description = (formData.get("description") as string) || null;
  const lineTotal = quantity * unitCost;

  const existing = await prisma.budgetPlannerItem.findFirst({
    where: { id, project: { householdId } },
  });
  if (!existing) return { error: "Item not found" };

  const item = await prisma.budgetPlannerItem.update({
    where: { id },
    data: { name, quantity, unitCost, lineTotal, referenceUrl, description },
  });

  // Recalculate project total
  const items = await prisma.budgetPlannerItem.findMany({ where: { projectId: item.projectId } });
  const totalCost = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
  await prisma.budgetPlannerProject.update({
    where: { id: item.projectId },
    data: { totalCost },
  });

  revalidatePath(`/budget-planner/${item.projectId}`);
  revalidatePath("/budget-planner");
  return {};
}
