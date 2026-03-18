"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createUser,
  updateUser,
  deleteUser,
  setPassword,
  removePassword,
} from "@/lib/users";

export async function createMemberAction(formData: FormData): Promise<void> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string | null;
  const role = (formData.get("role") as "ADMIN" | "MEMBER") || "MEMBER";

  if (!name || !email) return;

  await createUser({
    name,
    email,
    password: password || undefined,
    role,
  });

  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function updateMemberAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as "ADMIN" | "MEMBER";
  const avatar = (formData.get("avatar") as string) || null;

  if (!id || !name || !email) return;

  await updateUser(id, { name, email, role, avatar });

  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const currentActive = formData.get("active") === "true";

  if (!id) return;

  await updateUser(id, { active: !currentActive });

  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function setPasswordAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const password = formData.get("password") as string;

  if (!id || !password) return;

  await setPassword(id, password);

  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
}

export async function removePasswordAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;

  if (!id) return;

  await removePassword(id);

  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
}

export async function deleteMemberAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;

  if (!id) return;

  await deleteUser(id);

  revalidatePath("/members");
  revalidatePath("/dashboard");
  redirect("/members");
}
