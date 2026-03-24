import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 403 });

  const { fileId } = await params;

  const fileTags = await prisma.fileTag.findMany({
    where: { fileId, file: { householdId } },
    select: { tagId: true },
  });

  return NextResponse.json({ tagIds: fileTags.map((ft) => ft.tagId) });
}
