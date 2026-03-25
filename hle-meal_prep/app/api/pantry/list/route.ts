import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type FilterTab = "all" | "in-stock" | "low-stock" | "out-of-stock" | "expiring";
type SortField = "name" | "quantity" | "expiration";

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
  const q = params.get("q")?.trim() || "";
  const filter = (params.get("filter") || "all") as FilterTab;
  const page = Math.max(1, parseInt(params.get("page") || "1"));
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "50"), 1), 200);
  const sort = (params.get("sort") || "name") as SortField;
  const dir = (params.get("dir") || "asc") as "asc" | "desc";

  // Build where clause
  const where: Prisma.PantryItemWhereInput = { householdId };

  // Search filter
  if (q) {
    where.product = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    };
  }

  // Stock status filter — applied post-query for low-stock/out-of-stock since
  // Prisma can't do computed column comparisons easily. For expiring, we can
  // filter at DB level.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 86400000);

  if (filter === "out-of-stock") {
    where.quantity = { lte: 0 };
  } else if (filter === "expiring") {
    where.expiresAt = { lte: sevenDaysFromNow };
  }
  // in-stock and low-stock are filtered post-query since they depend on minQuantity comparison

  // Build orderBy
  let orderBy: Prisma.PantryItemOrderByWithRelationInput[];
  switch (sort) {
    case "quantity":
      orderBy = [{ quantity: dir }];
      break;
    case "expiration":
      // nulls last: sort by expiresAt with nulls handled
      orderBy = [{ expiresAt: { sort: dir, nulls: "last" } }];
      break;
    case "name":
    default:
      orderBy = [{ product: { name: dir } }];
      break;
  }

  // For stats, we always need the full set (unfiltered by stock status or search)
  const allItems = await prisma.pantryItem.findMany({
    where: { householdId },
    select: {
      quantity: true,
      minQuantity: true,
      expiresAt: true,
    },
  });

  const totalItems = allItems.length;
  const lowStockCount = allItems.filter((item) => {
    const qty = Number(item.quantity);
    const min = item.minQuantity !== null ? Number(item.minQuantity) : null;
    return qty > 0 && min !== null && qty <= min;
  }).length;
  const outOfStockCount = allItems.filter(
    (item) => Number(item.quantity) <= 0
  ).length;
  const expiringCount = allItems.filter((item) => {
    if (!item.expiresAt) return false;
    return new Date(item.expiresAt) <= sevenDaysFromNow;
  }).length;

  // For low-stock and in-stock filters, we need to fetch all matching items
  // then filter in memory (Prisma can't compare two columns)
  let needsPostFilter = filter === "low-stock" || filter === "in-stock";

  let items;
  let totalCount: number;

  if (needsPostFilter) {
    // Fetch all matching items and filter in memory
    const allFiltered = await prisma.pantryItem.findMany({
      where,
      include: {
        product: {
          include: { category: true },
        },
      },
      orderBy,
    });

    const postFiltered = allFiltered.filter((item) => {
      const qty = Number(item.quantity);
      const min = item.minQuantity !== null ? Number(item.minQuantity) : null;
      if (filter === "low-stock") {
        return qty > 0 && min !== null && qty <= min;
      }
      // in-stock: quantity > 0 AND (no min OR quantity > min)
      if (filter === "in-stock") {
        return qty > 0 && (min === null || qty > min);
      }
      return true;
    });

    totalCount = postFiltered.length;
    const skip = (page - 1) * limit;
    items = postFiltered.slice(skip, skip + limit);
  } else {
    // Use Prisma pagination directly
    const [rawItems, count] = await Promise.all([
      prisma.pantryItem.findMany({
        where,
        include: {
          product: {
            include: { category: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pantryItem.count({ where }),
    ]);

    items = rawItems;
    totalCount = count;

    // Sort expiring items by expiration date when on expiring tab
    if (filter === "expiring") {
      items.sort((a, b) => {
        const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aExp - bExp;
      });
    }
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / limit));

  // Serialize items
  const serializedItems = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    quantity: Number(item.quantity),
    unit: item.unit,
    minQuantity: item.minQuantity !== null ? Number(item.minQuantity) : null,
    expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
    updatedAt: item.updatedAt.toISOString(),
    product: {
      id: item.product.id,
      name: item.product.name,
      brand: item.product.brand,
      defaultUnit: item.product.defaultUnit,
      category: item.product.category
        ? { id: item.product.category.id, name: item.product.category.name }
        : null,
    },
  }));

  // Fetch available products and active lists
  const [availableProducts, activeLists] = await Promise.all([
    prisma.product.findMany({
      where: {
        householdId,
        isActive: true,
        pantryItem: { is: null },
      },
      select: {
        id: true,
        name: true,
        brand: true,
        defaultUnit: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.shoppingList.findMany({
      where: {
        householdId,
        status: "ACTIVE",
        items: { some: { isChecked: true } },
      },
      include: {
        _count: { select: { items: { where: { isChecked: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    items: serializedItems,
    totalCount,
    page,
    pageCount,
    stats: {
      total: totalItems,
      inStock: totalItems - lowStockCount - outOfStockCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      expiring: expiringCount,
    },
    availableProducts: availableProducts.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      defaultUnit: p.defaultUnit,
    })),
    activeLists: activeLists.map((l) => ({
      id: l.id,
      name: l.name,
      checkedCount: l._count.items,
    })),
  });
}
