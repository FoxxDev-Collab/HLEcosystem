"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verifyTOTP } from "@/lib/totp";
import { setSessionCookie, clearSession } from "@/lib/auth";
import { setCurrentHousehold } from "@/lib/household";
import { getUserByEmail, verifyPassword } from "@/lib/users";
import { createSession, deleteExpiredSessions } from "@/lib/session";

const ALLOWED_ORIGINS = [
  process.env.AUTH_URL,
  process.env.HUB_URL,
  process.env.FINANCE_URL,
  process.env.HEALTH_URL,
  process.env.HOMECARE_URL,
  process.env.FILES_URL,
  process.env.MEALS_URL,
  process.env.WIKI_URL,
].filter(Boolean) as string[];

function isAllowedRedirect(url: string): boolean {
  // Allow relative paths
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.some((origin) => {
      try {
        return new URL(origin).origin === parsed.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string | null;
  const totpCode = (formData.get("totpCode") as string | null)?.trim() || null;
  const redirectTo = (formData.get("redirect") as string | null) || null;

  const loginError = (msg: string, preserveEmail = false): never => {
    const params = new URLSearchParams({ error: msg });
    if (preserveEmail && email) params.set("email", email);
    if (redirectTo) params.set("redirect", redirectTo);
    redirect(`/login?${params.toString()}`);
  };

  if (!email || !password) {
    return loginError("Email and password are required");
  }

  const user = await getUserByEmail(email);
  if (!user || !user.active || !user.password) {
    return loginError("Invalid credentials");
  }

  const valid = await verifyPassword(user, password);
  if (!valid) {
    return loginError("Invalid credentials");
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return loginError("MFA code required", true);
    }
    const totpValid = verifyTOTP(totpCode, user.totpSecret);
    if (!totpValid) {
      return loginError("Invalid MFA code", true);
    }
  }

  const headerStore = await headers();
  const token = await createSession(
    user.id,
    headerStore.get("user-agent"),
    headerStore.get("x-forwarded-for")
  );
  await setSessionCookie(token);

  // Clean up expired sessions (non-blocking)
  deleteExpiredSessions().catch(() => {});

  // Redirect back to the originating app, or to FM dashboard
  // Validate redirect URL to prevent open redirect attacks
  if (redirectTo && isAllowedRedirect(redirectTo)) {
    redirect(redirectTo);
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function switchHouseholdAction(formData: FormData): Promise<void> {
  const householdId = formData.get("householdId") as string;
  if (!householdId) return;
  await setCurrentHousehold(householdId);
  redirect("/dashboard");
}
