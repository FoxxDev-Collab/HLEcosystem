import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export type MemoryGroup = {
  yearsAgo: number;
  label: string;
  files: {
    id: string;
    name: string;
    mimeType: string;
    createdAt: string;
  }[];
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "No household selected" }, { status: 403 });
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  // Look for photos from the same day in previous years (up to 10 years back)
  // We use raw SQL for date part extraction
  const memories = await prisma.$queryRaw<
    { id: string; name: string; mimeType: string; createdAt: Date }[]
  >`
    SELECT "id", "name", "mimeType", "createdAt"
    FROM file_server."File"
    WHERE "householdId" = ${householdId}
      AND "status" = 'ACTIVE'
      AND "deletedAt" IS NULL
      AND ("mimeType" LIKE 'image/%' OR "mimeType" LIKE 'video/%')
      AND EXTRACT(MONTH FROM "createdAt") = ${currentMonth}
      AND EXTRACT(DAY FROM "createdAt") = ${currentDay}
      AND EXTRACT(YEAR FROM "createdAt") < ${now.getFullYear()}
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  // Group by year
  const yearGroups = new Map<number, typeof memories>();
  for (const file of memories) {
    const year = file.createdAt.getFullYear();
    const yearsAgo = now.getFullYear() - year;
    if (!yearGroups.has(yearsAgo)) {
      yearGroups.set(yearsAgo, []);
    }
    yearGroups.get(yearsAgo)!.push(file);
  }

  const groups: MemoryGroup[] = [];
  for (const [yearsAgo, files] of Array.from(yearGroups.entries()).sort((a, b) => a[0] - b[0])) {
    groups.push({
      yearsAgo,
      label: yearsAgo === 1 ? "1 year ago" : `${yearsAgo} years ago`,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  }

  return NextResponse.json({ memories: groups, date: now.toISOString() });
}
