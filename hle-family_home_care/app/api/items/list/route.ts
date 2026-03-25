import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 403 });

  const url = request.nextUrl;
  const q = url.searchParams.get("q")?.trim() || "";
  const roomId = url.searchParams.get("roomId") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const sort = url.searchParams.get("sort") || "name";
  const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";

  const where: Prisma.ItemWhereInput = {
    householdId,
    isArchived: false,
    ...(roomId ? { roomId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { manufacturer: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ItemOrderByWithRelationInput =
    sort === "room"
      ? { room: { name: dir } }
      : sort === "condition"
        ? { condition: dir }
        : sort === "warranty"
          ? { warrantyExpires: dir }
          : { name: dir };

  const [items, totalCount, rooms] = await Promise.all([
    prisma.item.findMany({
      where,
      include: { room: true },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
    prisma.room.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const warrantyAlerts = items.filter(
    (i) =>
      i.warrantyExpires &&
      i.warrantyExpires > now &&
      i.warrantyExpires <= thirtyDaysFromNow
  ).length;

  const pageCount = Math.ceil(totalCount / limit);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      purchasePrice: item.purchasePrice ? item.purchasePrice.toString() : null,
      purchaseDate: item.purchaseDate?.toISOString() ?? null,
      warrantyExpires: item.warrantyExpires?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      room: item.room
        ? {
            ...item.room,
            createdAt: item.room.createdAt.toISOString(),
            updatedAt: item.room.updatedAt.toISOString(),
          }
        : null,
    })),
    rooms: rooms.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    totalCount,
    page,
    pageCount,
    warrantyAlerts,
  });
}
