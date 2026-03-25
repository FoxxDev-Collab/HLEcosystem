"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function addApiKeyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const name = formData.get("name") as string;
  const apiKey = formData.get("apiKey") as string;

  if (!name || !apiKey) return;

  const keyPrefix = apiKey.substring(0, 12);
  const keyHash = await bcrypt.hash(apiKey, 12);

  await prisma.apiKey.create({
    data: { name, keyPrefix, keyHash },
  });

  revalidatePath("/api-keys");
  revalidatePath("/dashboard");
}

export async function toggleApiKeyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const keyId = formData.get("keyId") as string;
  if (!keyId) return;

  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key) return;

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: !key.isActive },
  });

  revalidatePath("/api-keys");
  revalidatePath("/dashboard");
}

export async function deleteApiKeyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const keyId = formData.get("keyId") as string;
  if (!keyId) return;

  await prisma.apiKey.delete({ where: { id: keyId } });

  revalidatePath("/api-keys");
  revalidatePath("/dashboard");
}
