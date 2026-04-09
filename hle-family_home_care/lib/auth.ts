import { cookies } from "next/headers";
import { validateSession, deleteSession } from "./session";
import type { User } from "./users";

const SESSION_COOKIE = "hle_session";

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await validateSession(token);
  if (!result) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }
  return result.user;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSession(token);
  }
  const domain = process.env.AUTH_DOMAIN || undefined;
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES !== "false" && process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
    ...(domain ? { domain } : {}),
  });
}
