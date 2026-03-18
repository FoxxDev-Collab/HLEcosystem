import { cookies } from "next/headers";
import { getUserById, type User } from "./users";

const SESSION_COOKIE = "ff_user_id";

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  return getUserById(userId);
}

export async function setCurrentUser(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function clearCurrentUser() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
