import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "No household" }, { status: 403 });
  }

  const parentFolderId = request.nextUrl.searchParams.get("parentFolderId") || null;

  const folders = await prisma.folder.findMany({
    where: {
      householdId,
      parentFolderId: parentFolderId || null,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      color: true,
      parentFolderId: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ folders });
}
