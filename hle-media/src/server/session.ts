import { sql } from "./db";
import type { User } from "./users";

export const SESSION_COOKIE = "hle_session";

export async function validateSession(token: string): Promise<User | null> {
  const rows = (await sql`
    SELECT u."id", u."email", u."name", u."avatar", u."role", u."active"
    FROM family_manager."Session" s
    JOIN family_manager."User" u ON s."userId" = u."id"
    WHERE s."token" = ${token}
      AND s."expiresAt" > NOW()
      AND u."active" = true
  `) as User[];
  return rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await sql`
    DELETE FROM family_manager."Session" WHERE "token" = ${token}
  `;
}
