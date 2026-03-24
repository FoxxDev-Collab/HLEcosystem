import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

type Member = {
  id: string;
  name: string;
  email: string;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 403 });

  const members = await prisma.$queryRaw<Member[]>`
    SELECT u."id", u."name", u."email"
    FROM family_manager."User" u
    JOIN family_manager."HouseholdMember" hm ON u."id" = hm."userId"
    WHERE hm."householdId" = ${householdId} AND u."active" = true
    ORDER BY u."name"
  `;

  return NextResponse.json({ members });
}
