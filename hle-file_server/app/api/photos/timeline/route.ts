import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type TimelineGroup = {
  date: string;   // YYYY-MM-DD
  label: string;
  files: TimelineFile[];
};

export type TimelineFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdAt: string;
  effectiveDate: string; // EXIF dateTaken if available, otherwise createdAt
  width: number | null;
  height: number | null;
  dateTaken: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
};

type RawRow = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdAt: Date;
  effectiveDate: Date;
  width: number | null;
  height: number | null;
  dateTaken: Date | null;
  cameraMake: string | null;
  cameraModel: string | null;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household selected" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const cursor = params.get("cursor") || null;
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "100"), 1), 500);

  // Use raw SQL so we can ORDER BY the COALESCE expression.
  // Prisma cannot order by a field on a related model.
  const cursorClause = cursor
    ? Prisma.sql`AND COALESCE(pm."dateTaken", f."createdAt") < ${new Date(cursor)}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      f.id,
      f.name,
      f."mimeType",
      f.size::text                               AS size,
      f."createdAt",
      COALESCE(pm."dateTaken", f."createdAt")    AS "effectiveDate",
      pm.width,
      pm.height,
      pm."dateTaken",
      pm."cameraMake",
      pm."cameraModel"
    FROM   file_server."File"         f
    LEFT JOIN file_server."PhotoMetadata" pm ON pm."fileId" = f.id
    WHERE  f."householdId" = ${householdId}
      AND  f.status         = 'ACTIVE'
      AND  f."deletedAt"    IS NULL
      AND  (f."mimeType" LIKE 'image/%' OR f."mimeType" LIKE 'video/%')
      ${cursorClause}
    ORDER  BY COALESCE(pm."dateTaken", f."createdAt") DESC
    LIMIT  ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? new Date(items[items.length - 1].effectiveDate).toISOString()
    : null;

  // Group by effective date (EXIF date preferred over upload date)
  const groups = new Map<string, TimelineFile[]>();
  for (const row of items) {
    const dateKey = new Date(row.effectiveDate).toISOString().split("T")[0];
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push({
      id: row.id,
      name: row.name,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: new Date(row.createdAt).toISOString(),
      effectiveDate: new Date(row.effectiveDate).toISOString(),
      width: row.width ?? null,
      height: row.height ?? null,
      dateTaken: row.dateTaken ? new Date(row.dateTaken).toISOString() : null,
      cameraMake: row.cameraMake ?? null,
      cameraModel: row.cameraModel ?? null,
    });
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().split("T")[0];

  const timeline: TimelineGroup[] = [];
  for (const [dateKey, dateFiles] of groups) {
    let label: string;
    if (dateKey === today) {
      label = "Today";
    } else if (dateKey === yesterday) {
      label = "Yesterday";
    } else {
      const d = new Date(dateKey + "T00:00:00");
      const daysDiff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
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

  const totalPhotos = await prisma.file.count({
    where: {
      householdId,
      status: "ACTIVE",
      deletedAt: null,
      OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
    },
  });

  return NextResponse.json({ timeline, nextCursor, totalPhotos });
}
