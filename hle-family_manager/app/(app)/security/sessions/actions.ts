"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, getSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) return;

  // Only allow revoking own sessions
  await prisma.session.deleteMany({
    where: { id: sessionId, userId: user.id },
  });

  redirect("/security/sessions");
}

export async function revokeAllOtherSessionsAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const currentToken = await getSessionToken();
  if (!currentToken) redirect("/login");

  // Delete all sessions except the current one
  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      token: { not: currentToken },
    },
  });

  redirect("/security/sessions");
}
