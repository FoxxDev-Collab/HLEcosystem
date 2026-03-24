import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 403 });

  const tags = await prisma.tag.findMany({
    where: { householdId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ tags });
}
