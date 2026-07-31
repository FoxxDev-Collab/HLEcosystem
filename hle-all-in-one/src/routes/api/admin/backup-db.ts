import { createFileRoute } from "@tanstack/react-router"
import {
  authenticateAdminRequest,
  backupStamp,
  spawnDbDump,
} from "@/server/backup"

// Full-database dump (pg_dump custom format). Instance-ADMIN only — the dump
// spans every household and includes credential hashes.
export const Route = createFileRoute("/api/admin/backup-db")({
  server: {
    handlers: {
      GET: async () => {
        const auth = await authenticateAdminRequest()
        if (!auth.ok) return auth.response

        return new Response(spawnDbDump(), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="hle-aio-${backupStamp()}.dump"`,
          },
        })
      },
    },
  },
})
