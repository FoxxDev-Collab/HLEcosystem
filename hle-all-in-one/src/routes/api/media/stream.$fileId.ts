// Range-aware direct-play of a MediaFile, ported from
// hle-media/src/server/stream.ts. Auth follows the api/documents serve
// pattern: authenticateFileRequest re-verifies the session + household
// membership, then the household-scoped DB lookup IS the authorization
// check. The served path comes only from the DB row the scanner wrote —
// never from the request.
//
// Browsers cannot play MKV / AVI natively. Those files are served with the
// correct Content-Type but most browsers will refuse them (legacy "Phase 2
// transcoder" caveat still applies).
import path from "node:path"
import { createFileRoute } from "@tanstack/react-router"
import { authenticateFileRequest } from "@/server/home-care/documents"
import { getParentalProfile, isBlocked } from "@/server/media/parental"
import {
  STREAM_MIME,
  getStreamFile,
  resolveStreamKind,
} from "@/server/media/stream"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleStream(
  request: Request,
  fileId: string
): Promise<Response> {
  const auth = await authenticateFileRequest()
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(fileId)) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  // Household-scoped lookup — the scope IS the authorization check.
  const row = await getStreamFile(auth.householdId, fileId)
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  // Parental gate. Decide which rating ladder applies based on which parent
  // entity owns this file. If neither Movie nor Series resolved, the file is
  // orphaned — refuse to stream (it isn't visible in the library either).
  const kind = resolveStreamKind(row)
  if (kind === null) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  const rating = kind === "movie" ? row.movieRating : row.seriesRating
  const parental = await getParentalProfile(auth.userId, auth.householdId)
  if (isBlocked(parental, kind, rating)) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  const filePath = row.path
  const totalSize = Number(row.sizeBytes)
  const contentType =
    STREAM_MIME[path.extname(filePath).toLowerCase()] ??
    "application/octet-stream"

  // HEAD: return headers only.
  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
      },
    })
  }

  const range = request.headers.get("range")
  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range.trim())
    if (!m) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      })
    }
    const start = Number(m[1])
    const end = m[2] ? Number(m[2]) : totalSize - 1
    if (start > end || end >= totalSize) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      })
    }
    const slice = Bun.file(filePath).slice(start, end + 1)
    return new Response(slice, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    })
  }

  return new Response(Bun.file(filePath), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(totalSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  })
}

export const Route = createFileRoute("/api/media/stream/$fileId")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleStream(request, params.fileId),
      HEAD: ({ request, params }) => handleStream(request, params.fileId),
    },
  },
})
