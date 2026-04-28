import { sql } from "./db";

export type User = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: "ADMIN" | "MEMBER";
  active: boolean;
};

export async function getUserById(id: string): Promise<User | null> {
  const rows = (await sql`
    SELECT "id", "email", "name", "avatar", "role", "active"
    FROM family_manager."User"
    WHERE "id" = ${id}
  `) as User[];
  return rows[0] ?? null;
}
