import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import type { Prisma } from "@prisma/client";

export type FileListParams = {
  folderId?: string | null;
  ownerId?: string | null;
  cursor?: string | null;
  limit?: number;
  sort?: "name" | "size" | "date" | "type";
  dir?: "asc" | "desc";
  type?: string | null;
  tag?: string | null;
  q?: string | null;
  status?: "ACTIVE" | "DELETED";
  mode?: "shared-with" | "shared-by" | "favorites" | null;
};

export type SerializedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  uploadedByUserId: string;
  uploadedByName: string;
  description: string | null;
  tags: { id: string; name: string; color: string | null }[];
};

export type SerializedFolder = {
  id: string;
  name: string;
  color: string | null;
  _count: { files: number; subFolders: number };
  updatedAt: string;
};

export type FileListResponse = {
  files: SerializedFile[];
  folders: SerializedFolder[];
  nextCursor: string | null;
  totalCount: number;
};

// MIME type prefix map for type filtering
const TYPE_PREFIXES: Record<string, string[]> = {
  image: ["image/"],
  video: ["video/"],
  audio: ["audio/"],
  pdf: ["application/pdf"],
  document: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml",
    "application/rtf",
    "text/csv",
  ],
  archive: [
    "application/zip",
    "application/x-tar",
    "application/gzip",
    "application/x-7z",
    "application/x-rar",
  ],
  code: [
    "application/json",
    "application/xml",
    "application/javascript",
    "text/html",
    "text/css",
    "text/javascript",
    "text/x-python",
    "text/markdown",
    "text/yaml",
  ],
};

function buildMimeTypeFilter(
  type: string
): Prisma.FileWhereInput | undefined {
  if (type === "other") {
    // "other" = not matching any known category
    const allPrefixes = Object.values(TYPE_PREFIXES).flat();
    return {
      AND: allPrefixes.map((prefix) => ({
        NOT: { mimeType: { startsWith: prefix } },
      })),
    };
  }

  const prefixes = TYPE_PREFIXES[type];
  if (!prefixes) return undefined;

  if (prefixes.length === 1) {
    return { mimeType: { startsWith: prefixes[0] } };
  }

  return {
    OR: prefixes.map((prefix) => ({
      mimeType: { startsWith: prefix },
    })),
  };
}

function getSortField(sort: string): string {
  switch (sort) {
    case "name":
      return "name";
    case "size":
      return "size";
    case "type":
      return "mimeType";
    case "date":
    default:
      return "updatedAt";
  }
}

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

  const params = request.nextUrl.searchParams;
  const folderId = params.get("folderId") || null;
  const ownerId = params.get("ownerId") || null;
  const cursor = params.get("cursor") || null;
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "50"), 1), 200);
  const sort = (params.get("sort") || "date") as FileListParams["sort"];
  const dir = (params.get("dir") || "desc") as "asc" | "desc";
  const type = params.get("type") || null;
  const tag = params.get("tag") || null;
  const q = params.get("q")?.trim() || null;
  const status = (params.get("status") || "ACTIVE") as "ACTIVE" | "DELETED";
  const mode = params.get("mode") as FileListParams["mode"] || null;

  // Build file WHERE clause
  const where: Prisma.FileWhereInput = { householdId };

  if (mode === "shared-with") {
    // Files shared with this user (via FileShare)
    where.shares = { some: { sharedWithUserId: user.id } };
    where.status = "ACTIVE";
    where.deletedAt = null;
  } else if (mode === "shared-by") {
    where.shares = { some: { sharedByUserId: user.id } };
    where.status = "ACTIVE";
    where.deletedAt = null;
  } else if (mode === "favorites") {
    where.favorites = { some: { userId: user.id } };
    where.status = "ACTIVE";
    where.deletedAt = null;
  } else if (status === "DELETED") {
    where.status = "DELETED";
    where.deletedAt = { not: null };
  } else {
    where.status = "ACTIVE";
    where.deletedAt = null;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { originalName: { contains: q, mode: "insensitive" } },
      ];
    } else if (tag) {
      where.tags = { some: { tagId: tag } };
    } else {
      where.folderId = folderId || null;
    }

    if (ownerId) {
      where.ownerId = ownerId;
    } else if (!mode) {
      where.ownerId = null;
    }
  }

  // Type filter
  if (type) {
    const mimeFilter = buildMimeTypeFilter(type);
    if (mimeFilter) {
      Object.assign(where, mimeFilter);
    }
  }

  // Sort
  const sortFieldName = getSortField(sort || "date");
  const orderBy: Prisma.FileOrderByWithRelationInput[] = [
    { [sortFieldName]: dir },
    { id: dir }, // tiebreaker for cursor pagination
  ];

  // Cursor pagination
  const findArgs: Prisma.FileFindManyArgs = {
    where,
    orderBy,
    take: limit + 1, // fetch one extra to determine if there's a next page
    include: {
      tags: {
        include: { tag: { select: { id: true, name: true, color: true } } },
      },
    },
  };

  if (cursor) {
    findArgs.cursor = { id: cursor };
    findArgs.skip = 1; // skip the cursor itself
  }

  // Fetch files + total count in parallel
  const [rawFiles, totalCount] = await Promise.all([
    prisma.file.findMany(findArgs),
    prisma.file.count({ where }),
  ]);

  // Determine next cursor
  const hasMore = rawFiles.length > limit;
  const files = hasMore ? rawFiles.slice(0, limit) : rawFiles;
  const nextCursor = hasMore ? files[files.length - 1].id : null;

  // Batch user lookup
  const uploaderIds = [...new Set(files.map((f) => f.uploadedByUserId))];
  const users = await getUsersByIds(uploaderIds);
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  // Serialize files
  const serializedFiles: SerializedFile[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size.toString(),
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    deletedAt: f.deletedAt?.toISOString() ?? null,
    uploadedByUserId: f.uploadedByUserId,
    uploadedByName: userMap.get(f.uploadedByUserId) ?? "Unknown",
    description: f.description,
    tags: (f as unknown as { tags: { tag: { id: string; name: string; color: string | null } }[] }).tags.map(
      (ft) => ({
        id: ft.tag.id,
        name: ft.tag.name,
        color: ft.tag.color,
      })
    ),
  }));

  // Fetch folders — only on first page, only for browse/my-files (not search/tag/special modes)
  let serializedFolders: SerializedFolder[] = [];
  if (!cursor && !q && !tag && !mode && status === "ACTIVE") {
    const folders = await prisma.folder.findMany({
      where: {
        householdId,
        parentFolderId: folderId || null,
        ownerId: ownerId || null,
        deletedAt: null,
      },
      include: {
        _count: { select: { files: true, subFolders: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    serializedFolders = folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      _count: f._count,
      updatedAt: f.updatedAt.toISOString(),
    }));
  }

  // For trash mode, also fetch trashed folders on first page
  if (!cursor && status === "DELETED") {
    const trashedFolders = await prisma.folder.findMany({
      where: {
        householdId,
        deletedAt: { not: null },
      },
      include: {
        _count: { select: { files: true, subFolders: true } },
      },
      orderBy: { deletedAt: "desc" },
    });

    serializedFolders = trashedFolders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      _count: f._count,
      updatedAt: f.deletedAt?.toISOString() ?? f.updatedAt.toISOString(),
    }));
  }

  const response: FileListResponse = {
    files: serializedFiles,
    folders: serializedFolders,
    nextCursor,
    totalCount,
  };

  return NextResponse.json(response);
}
