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
  excerpt?: string | null; // content-search excerpt with [[...]] highlight markers
  hasContent?: boolean;    // true if document text has been indexed
};

export type SerializedFolder = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
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

// ---------------------------------------------------------------------------
// Full-text content search — runs when ?q= is present on a normal browse.
// Combines:
//   • tsvector full-text match against indexed document content (ts_rank)
//   • pg_trgm ILIKE match against filename / description
// Results are ranked by relevance descending and returned as a flat list
// (no cursor pagination — search results are typically small).
// Searches all files the user can access: household (ownerId IS NULL) and
// their own personal files (ownerId = userId).
// ---------------------------------------------------------------------------
type ContentSearchRow = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  uploadedByUserId: string;
  description: string | null;
  hasContent: boolean;
  excerpt: string | null;
  rank: number;
};

async function contentSearch(params: {
  q: string;
  householdId: string;
  userId: string;
  limit: number;
}): Promise<NextResponse> {
  const { q, householdId, userId, limit } = params;
  // Escape ILIKE wildcards in the raw input
  const likeQ = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

  const rows = await prisma.$queryRaw<ContentSearchRow[]>`
    SELECT
      f.id,
      f.name,
      f."mimeType",
      f.size::text                  AS size,
      f."createdAt",
      f."updatedAt",
      f."deletedAt",
      f."uploadedByUserId",
      f.description,
      (fc."rawText" IS NOT NULL)    AS "hasContent",
      CASE
        WHEN fc."searchVector" IS NOT NULL
         AND fc."searchVector" @@ websearch_to_tsquery('english', ${q})
        THEN ts_headline(
          'english',
          fc."rawText",
          websearch_to_tsquery('english', ${q}),
          'MaxWords=30, MinWords=15, StartSel=[[, StopSel=]], ShortWord=3'
        )
        ELSE NULL
      END                           AS excerpt,
      GREATEST(
        COALESCE(
          CASE
            WHEN fc."searchVector" IS NOT NULL
             AND fc."searchVector" @@ websearch_to_tsquery('english', ${q})
            THEN ts_rank(fc."searchVector", websearch_to_tsquery('english', ${q}))
            ELSE NULL
          END,
          0.0
        ),
        CASE WHEN f.name        ILIKE ${likeQ} THEN 0.3 ELSE 0.0 END,
        CASE WHEN f.description ILIKE ${likeQ} THEN 0.1 ELSE 0.0 END
      )                             AS rank
    FROM   file_server."File"        f
    LEFT JOIN file_server."FileContent" fc ON fc."fileId" = f.id
    WHERE  f."householdId" = ${householdId}
      AND  f.status         = 'ACTIVE'
      AND  f."deletedAt"    IS NULL
      AND  (f."ownerId" IS NULL OR f."ownerId" = ${userId})
      AND  (
             f.name         ILIKE ${likeQ}
          OR f.description  ILIKE ${likeQ}
          OR f."originalName" ILIKE ${likeQ}
          OR (
               fc."searchVector" IS NOT NULL
               AND fc."searchVector" @@ websearch_to_tsquery('english', ${q})
             )
           )
    ORDER  BY rank DESC, f."updatedAt" DESC
    LIMIT  ${limit}
  `;

  const uploaderIds = [...new Set(rows.map((r) => r.uploadedByUserId))];
  const userList = await getUsersByIds(uploaderIds);
  const userMap = new Map(userList.map((u) => [u.id, u.name]));

  const fileIds = rows.map((r) => r.id);
  const tagRows = fileIds.length > 0
    ? await prisma.fileTag.findMany({
        where: { fileId: { in: fileIds } },
        include: { tag: { select: { id: true, name: true, color: true } } },
      })
    : [];
  const tagsByFile = new Map<string, { id: string; name: string; color: string | null }[]>();
  for (const ft of tagRows) {
    const arr = tagsByFile.get(ft.fileId) ?? [];
    arr.push({ id: ft.tag.id, name: ft.tag.name, color: ft.tag.color });
    tagsByFile.set(ft.fileId, arr);
  }

  const files: SerializedFile[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    mimeType: r.mimeType,
    size: r.size,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
    deletedAt: r.deletedAt ? new Date(r.deletedAt).toISOString() : null,
    uploadedByUserId: r.uploadedByUserId,
    uploadedByName: userMap.get(r.uploadedByUserId) ?? "Unknown",
    description: r.description,
    tags: tagsByFile.get(r.id) ?? [],
    excerpt: r.excerpt ?? null,
    hasContent: Boolean(r.hasContent),
  }));

  const response: FileListResponse = {
    files,
    folders: [],
    nextCursor: null,
    totalCount: files.length,
  };

  return NextResponse.json(response);
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

  // Full-text content search — bypasses the Prisma path entirely
  if (q && status === "ACTIVE" && !mode) {
    return contentSearch({ q, householdId, userId: user.id, limit });
  }

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

    if (tag) {
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
      icon: f.icon,
      isSystem: f.isSystem,
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
      icon: f.icon,
      isSystem: f.isSystem,
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
