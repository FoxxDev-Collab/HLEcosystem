import { prisma } from "./prisma";

export type User = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: "ADMIN" | "MEMBER";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getUsers(): Promise<User[]> {
  return prisma.$queryRaw<User[]>`
    SELECT "id", "email", "name", "avatar", "role", "active", "createdAt", "updatedAt"
    FROM family_manager."User"
    WHERE "active" = true
    ORDER BY "name"
  `;
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await prisma.$queryRaw<User[]>`
    SELECT "id", "email", "name", "avatar", "role", "active", "createdAt", "updatedAt"
    FROM family_manager."User"
    WHERE "id" = ${id}
  `;
  return users[0] ?? null;
}

export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  return prisma.$queryRaw<User[]>`
    SELECT "id", "email", "name", "avatar", "role", "active", "createdAt", "updatedAt"
    FROM family_manager."User"
    WHERE "id" = ANY(${ids})
  `;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await prisma.$queryRaw<User[]>`
    SELECT "id", "email", "name", "avatar", "role", "active", "createdAt", "updatedAt"
    FROM family_manager."User"
    WHERE "email" = ${email}
  `;
  return users[0] ?? null;
}
