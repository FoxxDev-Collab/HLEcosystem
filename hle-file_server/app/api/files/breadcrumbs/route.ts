import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export type BreadcrumbItem = {
  id: string;
  name: string;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json(
      { error: "No household selected" },
      { status: 403 }
    );
  }

  const folderId = request.nextUrl.searchParams.get("folderId");
  if (!folderId) {
    return NextResponse.json([]);
  }

  // Recursive CTE to get all ancestors in a single query
  const ancestors = await prisma.$queryRaw<BreadcrumbItem[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, "parentFolderId"
      FROM file_server."Folder"
      WHERE id = ${folderId}
        AND "householdId" = ${householdId}
        AND "deletedAt" IS NULL
      UNION ALL
      SELECT f.id, f.name, f."parentFolderId"
      FROM file_server."Folder" f
      INNER JOIN ancestors a ON f.id = a."parentFolderId"
      WHERE f."deletedAt" IS NULL
    )
    SELECT id, name FROM ancestors
  `;

  // The CTE returns from child to root — reverse to get root-first order
  return NextResponse.json(ancestors.reverse());
}
