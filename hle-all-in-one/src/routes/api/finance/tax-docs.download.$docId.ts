import { createFileRoute } from "@tanstack/react-router"
import { fileExistsOnDisk, readFileStream } from "@/server/file-storage"
import { authenticateFileRequest } from "@/server/home-care/documents"
import {
  getTaxDocumentFileForServing,
  mimeFromFilename,
} from "@/server/finance/taxes"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute("/api/finance/tax-docs/download/$docId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const auth = await authenticateFileRequest()
        if (!auth.ok) return auth.response

        const { docId } = params
        if (!UUID_RE.test(docId)) {
          return new Response("Not found", { status: 404 })
        }

        // Household-scoped lookup (through TaxYear) — the scope IS the
        // authorization check.
        const doc = await getTaxDocumentFileForServing(auth.householdId, docId)
        if (!doc) return new Response("Not found", { status: 404 })

        if (!(await fileExistsOnDisk(doc.storagePath))) {
          return new Response("File not found on disk", { status: 404 })
        }

        return new Response(readFileStream(doc.storagePath), {
          headers: {
            "Content-Type": mimeFromFilename(doc.uploadedFileName),
            "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.uploadedFileName)}"`,
          },
        })
      },
    },
  },
})
