import path from "node:path";
import { sql } from "./db";
import { param } from "./request";
import type { HouseholdContext } from "./auth";
import { isBlocked } from "./parental";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".ts": "video/mp2t",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
};

type FileRow = {
  path: string;
  sizeBytes: string | number; // bigint comes back as string
  movieId: string | null;
  movieRating: string | null;
  seriesId: string | null;
  seriesRating: string | null;
};

function resolveKind(row: FileRow): "movie" | "series" | null {
  if (row.movieRating !== null) return "movie";
  if (row.seriesRating !== null) return "series";
  return null;
}

/**
 * GET /api/stream/:fileId
 *
 * Direct-play of a MediaFile with HTTP Range support so the browser's
 * <video> can seek. Tenant boundary is enforced — the file is only
 * served if its `householdId` matches the request's household cookie.
 *
 * Browsers cannot play MKV / AVI natively. Phase 2 will add an on-demand
 * transcoder that fronts this endpoint; for now those files are served
 * with the correct Content-Type but most browsers will refuse them.
 */
export async function streamHandler(
  req: Request,
  ctx: HouseholdContext,
): Promise<Response> {
  const fileId = param(req, "fileId");
  if (!fileId) {
    return Response.json({ error: "missing_id" }, { status: 400 });
  }

  // Pull the file row alongside its parent Movie / Series so we can apply
  // the caller's parental profile here. Episodes inherit their rating from
  // the parent Series. An orphan file (no Movie / Episode linkage) is
  // treated as not found — it's not visible in the library either.
  const rows = (await sql`
    SELECT mf."path", mf."sizeBytes",
           m."contentRating" AS "movieRating",
           s."contentRating" AS "seriesRating"
    FROM media."MediaFile" mf
    LEFT JOIN media."Movie"   m  ON m."mediaFileId" = mf."id"
                                AND m."householdId"  = mf."householdId"
    LEFT JOIN media."Episode" e  ON e."mediaFileId" = mf."id"
                                AND e."householdId"  = mf."householdId"
    LEFT JOIN media."Season"  se ON se."id" = e."seasonId"
    LEFT JOIN media."Series"  s  ON s."id"  = se."seriesId"
    WHERE mf."id" = ${fileId} AND mf."householdId" = ${ctx.householdId}
    LIMIT 1
  `) as FileRow[];
  if (rows.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const row = rows[0]!;

  // Parental gate. Decide which rating ladder applies based on which
  // parent entity owns this file. If neither Movie nor Series resolved,
  // the file is orphaned — refuse to stream.
  const kind = resolveKind(row);
  if (kind === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const rating = kind === "movie" ? row.movieRating : row.seriesRating;
  if (isBlocked(ctx.parental, kind, rating)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const filePath = row.path;
  const totalSize = Number(row.sizeBytes);
  const contentType = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

  // HEAD: return headers only.
  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
    if (!m) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      });
    }
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : totalSize - 1;
    if (start > end || end >= totalSize) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      });
    }
    const slice = Bun.file(filePath).slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new Response(Bun.file(filePath), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(totalSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
