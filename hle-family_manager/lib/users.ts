import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export type User = {
  id: string;
  email: string;
  name: string;
  password: string | null;
  avatar: string | null;
  role: "ADMIN" | "MEMBER";
  active: boolean;
  totpSecret: string | null;
  totpEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserPublic = Omit<User, "password" | "totpSecret">;

// Strip sensitive fields before a user object leaves the server.
// This is the only sanctioned way to convert a User to a UserPublic —
// do not spread/return a raw User row from any API, Server Action, or
// session handler. See SECURITY_CONTROLS.md §IA-5.
export function toPublic(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    active: user.active,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUsers(): Promise<UserPublic[]> {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
  });
  return users.map(toPublic);
}

export async function getActiveUsers(): Promise<UserPublic[]> {
  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return users.map(toPublic);
}

export async function getUserById(id: string): Promise<UserPublic | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublic(user) : null;
}

export async function getUserByIdWithPassword(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  role?: "ADMIN" | "MEMBER";
  avatar?: string;
}): Promise<UserPublic> {
  const hashedPassword = data.password
    ? await bcrypt.hash(data.password, 12)
    : null;

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role ?? "MEMBER",
      avatar: data.avatar ?? null,
    },
  });
  return toPublic(user);
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: "ADMIN" | "MEMBER";
    avatar?: string | null;
    active?: boolean;
  }
): Promise<UserPublic> {
  const user = await prisma.user.update({
    where: { id },
    data,
  });
  return toPublic(user);
}

export async function setPassword(id: string, password: string): Promise<void> {
  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id },
    data: { password: hashed },
  });
}

export async function removePassword(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { password: null },
  });
}

export async function verifyPassword(
  user: User,
  password: string
): Promise<boolean> {
  if (!user.password) return false;
  return bcrypt.compare(password, user.password);
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

export async function getUserCounts(): Promise<{
  total: number;
  active: number;
  inactive: number;
  admins: number;
  members: number;
  withPassword: number;
}> {
  const [total, active, admins, withPassword] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { password: { not: null } } }),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    admins,
    members: total - admins,
    withPassword,
  };
}
