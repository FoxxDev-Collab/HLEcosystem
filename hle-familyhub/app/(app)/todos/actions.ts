"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

function revalidate() {
  revalidatePath("/todos");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

// ── List CRUD ──

export async function createListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const color = (formData.get("color") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;

  const list = await prisma.todoList.create({
    data: {
      householdId,
      name,
      description,
      color,
      createdById: user.id,
    },
  });

  revalidate();
  redirect(`/todos/${list.id}`);
}

export async function updateListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const listId = formData.get("listId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!listId || !name) return;

  const color = (formData.get("color") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;

  await prisma.todoList.update({
    where: { id: listId, householdId },
    data: { name, description, color },
  });

  revalidate();
}

export async function deleteListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const listId = formData.get("listId") as string;
  if (!listId) return;

  await prisma.todoList.delete({
    where: { id: listId, householdId },
  });

  revalidate();
  redirect("/todos");
}

// ── Item CRUD ──

export async function addItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const listId = formData.get("listId") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!listId || !title) return;

  const notes = (formData.get("notes") as string)?.trim() || null;
  const dueDateStr = formData.get("dueDate") as string;
  const assigneeId = (formData.get("assigneeId") as string) || null;

  // Verify list belongs to household
  const list = await prisma.todoList.findFirst({
    where: { id: listId, householdId },
  });
  if (!list) return;

  // Get next sort order
  const lastItem = await prisma.todoItem.findFirst({
    where: { listId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.todoItem.create({
    data: {
      listId,
      title,
      notes,
      dueDate: dueDateStr ? new Date(dueDateStr) : null,
      assigneeId,
      sortOrder: (lastItem?.sortOrder ?? -1) + 1,
      createdById: user.id,
    },
  });

  revalidate();
  revalidatePath(`/todos/${listId}`);
}

export async function updateItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const itemId = formData.get("itemId") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!itemId || !title) return;

  const notes = (formData.get("notes") as string)?.trim() || null;
  const dueDateStr = formData.get("dueDate") as string;
  const assigneeId = (formData.get("assigneeId") as string) || null;

  const item = await prisma.todoItem.findFirst({
    where: { id: itemId },
    include: { list: { select: { householdId: true } } },
  });
  if (!item || item.list.householdId !== householdId) return;

  await prisma.todoItem.update({
    where: { id: itemId },
    data: {
      title,
      notes,
      dueDate: dueDateStr ? new Date(dueDateStr) : null,
      assigneeId: assigneeId || null,
    },
  });

  revalidate();
  revalidatePath(`/todos/${item.listId}`);
}

export async function toggleItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const itemId = formData.get("itemId") as string;
  if (!itemId) return;

  const item = await prisma.todoItem.findFirst({
    where: { id: itemId },
    include: { list: { select: { householdId: true } } },
  });
  if (!item || item.list.householdId !== householdId) return;

  const newStatus = item.status === "DONE" ? "PENDING" : "DONE";

  await prisma.todoItem.update({
    where: { id: itemId },
    data: {
      status: newStatus,
      completedAt: newStatus === "DONE" ? new Date() : null,
    },
  });

  revalidate();
  revalidatePath(`/todos/${item.listId}`);
}

export async function deleteItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const itemId = formData.get("itemId") as string;
  if (!itemId) return;

  const item = await prisma.todoItem.findFirst({
    where: { id: itemId },
    include: { list: { select: { householdId: true, id: true } } },
  });
  if (!item || item.list.householdId !== householdId) return;

  await prisma.todoItem.delete({ where: { id: itemId } });

  revalidate();
  revalidatePath(`/todos/${item.listId}`);
}
