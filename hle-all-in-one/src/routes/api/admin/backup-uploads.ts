import { createFileRoute } from "@tanstack/react-router"
import {
  authenticateAdminRequest,
  backupStamp,
  spawnUploadsArchive,
} from "@/server/backup"

// Gzipped tar of the uploads directory (file attachments across all
// modules). Pairs with /api/admin/backup-db for a full instance migration.
export const Route = createFileRoute("/api/admin/backup-uploads")({
  server: {
    handlers: {
      GET: async () => {
        const auth = await authenticateAdminRequest()
        if (!auth.ok) return auth.response

        const uploadDir = process.env.UPLOAD_DIR || "./uploads"
        return new Response(spawnUploadsArchive(uploadDir), {
          headers: {
            "Content-Type": "application/gzip",
            "Content-Disposition": `attachment; filename="hle-aio-uploads-${backupStamp()}.tar.gz"`,
          },
        })
      },
    },
  },
})
