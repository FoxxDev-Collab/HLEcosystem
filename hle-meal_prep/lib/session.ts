import { prisma } from "./prisma";
import type { User } from "./users";

export async function validateSession(token: string): Promise<{ user: User } | null> {
  const rows = await prisma.$queryRaw<User[]>`
    SELECT u."id", u."email", u."name", u."avatar", u."role", u."active",
           u."createdAt", u."updatedAt"
    FROM family_manager."Session" s
    JOIN family_manager."User" u ON s."userId" = u."id"
    WHERE s."token" = ${token}
      AND s."expiresAt" > NOW()
      AND u."active" = true
  `;
  if (rows.length === 0) return null;
  return { user: rows[0] };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.$queryRaw`
    DELETE FROM family_manager."Session" WHERE "token" = ${token}
  `;
}
