import { createFileRoute } from "@tanstack/react-router"
import { sql } from "@/server/db"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await sql`SELECT 1`
          return Response.json({ status: "ok" })
        } catch {
          return Response.json({ status: "degraded" }, { status: 503 })
        }
      },
    },
  },
})
