import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export type TimelineGroup = {
  date: string; // ISO date string (YYYY-MM-DD)
  label: string; // Human-readable label
  files: TimelineFile[];
};

export type TimelineFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdAt: string;
  width: number | null;
  height: number | null;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "No household selected" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const cursor = params.get("cursor") || null; // ISO date string to paginate from
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "100"), 1), 500);

  // Fetch image/video files sorted by creation date
  const where: Record<string, unknown> = {
    householdId,
    status: "ACTIVE",
    deletedAt: null,
    OR: [
      { mimeType: { startsWith: "image/" } },
      { mimeType: { startsWith: "video/" } },
    ],
  };

  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      createdAt: true,
      photoMetadata: {
        select: { width: true, height: true },
      },
    },
  });

  const hasMore = files.length > limit;
  const items = hasMore ? files.slice(0, limit) : files;
  const nextCursor = hasMore
    ? items[items.length - 1].createdAt.toISOString()
    : null;

  // Group by date
  const groups = new Map<string, TimelineFile[]>();
  for (const file of items) {
    const dateKey = file.createdAt.toISOString().split("T")[0];
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size.toString(),
      createdAt: file.createdAt.toISOString(),
      width: file.photoMetadata?.width ?? null,
      height: file.photoMetadata?.height ?? null,
    });
  }

  // Build timeline groups with human-readable labels
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];

  const timeline: TimelineGroup[] = [];
  for (const [dateKey, dateFiles] of groups) {
    let label: string;
    if (dateKey === today) {
      label = "Today";
    } else if (dateKey === yesterday) {
      label = "Yesterday";
    } else {
      const d = new Date(dateKey + "T00:00:00");
      const daysDiff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (daysDiff < 7) {
        label = d.toLocaleDateString("en-US", { weekday: "long" });
      } else if (d.getFullYear() === now.getFullYear()) {
        label = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      } else {
        label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }
    }

    timeline.push({ date: dateKey, label, files: dateFiles });
  }

  // Get total photo count
  const totalPhotos = await prisma.file.count({
    where: {
      householdId,
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { mimeType: { startsWith: "image/" } },
        { mimeType: { startsWith: "video/" } },
      ],
    },
  });

  return NextResponse.json({
    timeline,
    nextCursor,
    totalPhotos,
  });
}
