"use server";

import { redirect } from "next/navigation";
import { generateSecret, verifyTOTP, generateURI } from "@/lib/totp";
import { getCurrentUser } from "@/lib/auth";
import { getUserByIdWithPassword, verifyPassword } from "@/lib/users";
import { prisma } from "@/lib/prisma";

export async function generateTotpAction(): Promise<{
  secret: string;
  uri: string;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const secret = generateSecret();
  const uri = generateURI(user.email, secret);

  // Store secret but don't enable yet
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret },
  });

  return { secret, uri };
}

export async function verifyAndEnableTotpAction(
  formData: FormData
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const code = (formData.get("code") as string)?.trim();
  if (!code || code.length !== 6) {
    return { error: "Enter a 6-digit code" };
  }

  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fullUser?.totpSecret) {
    return { error: "No TOTP secret found. Please start setup again." };
  }

  const valid = verifyTOTP(code, fullUser.totpSecret);

  if (!valid) {
    return { error: "Invalid code. Check your authenticator app and try again." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });

  redirect("/security");
}

export async function disableTotpAction(
  formData: FormData
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const password = formData.get("password") as string;
  if (!password) {
    return { error: "Password is required" };
  }

  const fullUser = await getUserByIdWithPassword(user.id);
  if (!fullUser?.password) {
    return { error: "No password set on this account" };
  }

  const valid = await verifyPassword(fullUser, password);
  if (!valid) {
    return { error: "Incorrect password" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null },
  });

  redirect("/security");
}
