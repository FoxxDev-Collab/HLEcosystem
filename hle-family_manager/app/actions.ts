"use server";

import { redirect } from "next/navigation";
import { setCurrentUser, clearCurrentUser } from "@/lib/auth";
import { setCurrentHousehold } from "@/lib/household";
import { getUserByEmail, verifyPassword, createUser } from "@/lib/users";

export async function loginAction(formData: FormData): Promise<void> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string | null;

  if (!email) {
    redirect("/login?error=Email is required");
  }

  if (!password) {
    redirect("/login?error=Password is required");
  }

  const user = await getUserByEmail(email);
  if (!user || !user.active) {
    redirect("/login?error=User not found");
  }

  if (!user.password) {
    redirect("/login?error=No password set for this account");
  }

  const valid = await verifyPassword(user, password);
  if (!valid) {
    redirect("/login?error=Incorrect password");
  }

  await setCurrentUser(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearCurrentUser();
  redirect("/login");
}

export async function registerAction(formData: FormData): Promise<void> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;
  const role = (formData.get("role") as "ADMIN" | "MEMBER") || "MEMBER";

  if (!name || !email) return;

  if (password && password !== confirmPassword) return;

  const existing = await getUserByEmail(email);
  if (existing) return;

  const user = await createUser({
    name,
    email,
    password: password || undefined,
    role,
  });

  await setCurrentUser(user.id);
  redirect("/dashboard");
}

export async function switchHouseholdAction(formData: FormData): Promise<void> {
  const householdId = formData.get("householdId") as string;
  if (!householdId) return;
  await setCurrentHousehold(householdId);
  redirect("/dashboard");
}
